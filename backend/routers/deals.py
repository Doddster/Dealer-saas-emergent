from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.llm import coach_hint, negotiation_message
from lib.pricing import coach_band, compute_deal, effective_rules, negotiate, now_utc, round2, trade_estimate
from models.schemas import (
    AppointmentInput,
    CoachInput,
    CoachResponse,
    Deal,
    DealCreate,
    DealerActionInput,
    Message,
    OfferInput,
    TermsInput,
    Trade,
    TradeInput,
)

router = APIRouter(prefix="/deals", tags=["deals"])


async def _load(deal_id: str) -> dict:
    doc = await db.deals.find_one({"id": deal_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="deal not found")
    return doc


async def _rules_for(vehicle: dict) -> dict:
    dealer = await db.dealer_rules.find_one({"id": "dealership"}, {"_id": 0}) or {}
    override = await db.vin_overrides.find_one({"vin": vehicle["vin"]}, {"_id": 0})
    return effective_rules(vehicle, dealer, override)


def _msg(sender: str, text: str, amount=None) -> dict:
    return Message(sender=sender, text=text, amount=amount, created_at=now_utc()).model_dump()


async def _save(deal: dict):
    await db.deals.replace_one({"id": deal["id"]}, deal)
    return Deal(**deal)


@router.post("", response_model=Deal)
async def create_deal(payload: DealCreate):
    vehicle = await db.vehicles.find_one({"id": payload.vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="vehicle not found")
    deal = Deal(
        vehicle=vehicle,
        customer_name=payload.customer_name,
        status="building",
        selling_price=float(vehicle["price"]),
        breakdown=compute_deal(vehicle, float(vehicle["price"]), None, 0.0),
        messages=[],
        created_at=now_utc(),
    ).model_dump()
    await db.deals.insert_one(dict(deal))
    return Deal(**deal)


@router.get("", response_model=list[Deal])
async def list_deals():
    docs = await db.deals.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [Deal(**d) for d in docs]


@router.get("/{deal_id}", response_model=Deal)
async def get_deal(deal_id: str):
    return Deal(**await _load(deal_id))


@router.put("/{deal_id}/trade", response_model=Deal)
async def set_trade(deal_id: str, payload: TradeInput):
    deal = await _load(deal_id)
    est = trade_estimate(payload.year, payload.mileage, payload.condition)
    trade = Trade(
        **payload.model_dump(),
        estimated_low=est["low"],
        estimated_high=est["high"],
        estimated_value=est["value"],
    ).model_dump()
    deal["trade"] = trade
    deal["breakdown"] = compute_deal(deal["vehicle"], deal["selling_price"], trade, deal.get("down_payment", 0.0))
    equity = deal["breakdown"]["trade_equity"]
    label = "positive equity" if equity >= 0 else "negative equity"
    deal["messages"].append(
        _msg("system", f"Trade added: {payload.year} {payload.make} {payload.model}. Estimated ${est['low']:,.0f} – ${est['high']:,.0f} ({label} of ${abs(equity):,.0f}).")
    )
    return await _save(deal)


@router.post("/{deal_id}/offer", response_model=Deal)
async def submit_offer(deal_id: str, payload: OfferInput):
    deal = await _load(deal_id)
    if deal["status"] in ("accepted", "declined", "closed"):
        raise HTTPException(status_code=400, detail="deal is already closed")
    deal["down_payment"] = round2(payload.down_payment)
    deal["latest_offer"] = round2(payload.amount)
    deal["messages"].append(_msg("customer", f"I'd like to buy it at ${payload.amount:,.0f}.", payload.amount))

    if deal.get("taken_over"):
        deal["status"] = "manager_review"
        deal["messages"].append(_msg("system", "A product specialist has taken over this conversation and will respond shortly."))
        return await _save(deal)

    # The rules engine is authoritative for the decision AND the price, so the hard floor can
    # never be breached. ChatGPT only rephrases that outcome conversationally; on any failure
    # we keep the deterministic canned text.
    rules = await _rules_for(deal["vehicle"])
    decision, price, text, status = negotiate(float(payload.amount), rules)

    if decision == "escalated":
        # Manager zone: no AI counter. The complete deal lands on the Dealer Desk.
        deal["status"] = status
        deal["latest_counter"] = None
        deal["messages"].append(_msg("dealer", text, None))
        deal["messages"].append(_msg("system", "Sent to the sales manager for review."))
        deal["breakdown"] = compute_deal(deal["vehicle"], deal["selling_price"], deal.get("trade"), deal["down_payment"])
        return await _save(deal)

    ai_text = await negotiation_message(
        decision=decision,
        required_price=price,
        vehicle=deal["vehicle"],
        offer=float(payload.amount),
        trade=deal.get("trade"),
        history=deal["messages"],
    )
    if ai_text and f"{price:,.0f}" in ai_text:
        text = ai_text
    deal["messages"].append(_msg("dealer", text, price))
    deal["status"] = status
    if decision == "accepted":
        deal["agreed_price"] = price
        deal["selling_price"] = price
        deal["latest_counter"] = None
    else:
        deal["latest_counter"] = price
    deal["breakdown"] = compute_deal(deal["vehicle"], deal.get("agreed_price") or deal["selling_price"], deal.get("trade"), deal["down_payment"])
    return await _save(deal)


@router.patch("/{deal_id}/terms", response_model=Deal)
async def update_terms(deal_id: str, payload: TermsInput):
    """Down-payment change -> server recalculates the whole breakdown."""
    deal = await _load(deal_id)
    deal["down_payment"] = round2(payload.down_payment)
    deal["breakdown"] = compute_deal(
        deal["vehicle"],
        deal.get("agreed_price") or deal["selling_price"],
        deal.get("trade"),
        deal["down_payment"],
    )
    return await _save(deal)


@router.post("/{deal_id}/coach", response_model=CoachResponse)
async def coach_offer(deal_id: str, payload: CoachInput):
    """Private pre-submit hint for the customer. Never returns dealer rule values."""
    deal = await _load(deal_id)
    rules = await _rules_for(deal["vehicle"])
    band, canned = coach_band(float(payload.amount), rules)
    ai = await coach_hint(
        band=band,
        offer=float(payload.amount),
        vehicle=deal["vehicle"],
        trade=deal.get("trade"),
    )
    return CoachResponse(band=band, hint=ai or canned, amount=round2(payload.amount))


@router.post("/{deal_id}/accept-counter", response_model=Deal)
async def accept_counter(deal_id: str):
    deal = await _load(deal_id)
    price = deal.get("latest_counter") or deal.get("agreed_price") or deal["selling_price"]
    deal["agreed_price"] = round2(price)
    deal["selling_price"] = round2(price)
    deal["status"] = "accepted"
    deal["breakdown"] = compute_deal(deal["vehicle"], deal["selling_price"], deal.get("trade"), deal.get("down_payment", 0.0))
    deal["messages"].append(_msg("customer", f"I accept ${price:,.0f}.", price))
    deal["messages"].append(_msg("dealer", "Deal accepted. Let's schedule your delivery appointment."))
    return await _save(deal)


@router.post("/{deal_id}/decline", response_model=Deal)
async def decline(deal_id: str):
    deal = await _load(deal_id)
    deal["status"] = "declined"
    deal["messages"].append(_msg("customer", "I'm going to pass for now."))
    return await _save(deal)


@router.post("/{deal_id}/appointment", response_model=Deal)
async def book_appointment(deal_id: str, payload: AppointmentInput):
    deal = await _load(deal_id)
    if deal["status"] != "accepted":
        raise HTTPException(status_code=400, detail="deal must be accepted before scheduling")
    deal["appointment"] = {
        **payload.model_dump(),
        "location": deal["vehicle"].get("dealer_address", ""),
    }
    deal["status"] = "closed"
    deal["messages"].append(_msg("system", f"Appointment confirmed for {payload.date} at {payload.time}."))

    v = deal["vehicle"]
    b = deal["breakdown"]
    existing = await db.garage.find_one({"vin": v["vin"]})
    if not existing:
        await db.garage.insert_one(
            {
                "id": deal["id"] + "-g",
                "vin": v["vin"],
                "year": v["year"],
                "make": v["make"],
                "model": v["model"],
                "trim": v["trim"],
                "image": v["image"],
                "mileage": v["mileage"],
                "payoff": round2(max(0.0, b["amount_due"])),
                "estimated_value": round2(b["selling_price"] * 0.97),
                "equity": round2(b["selling_price"] * 0.97 - max(0.0, b["amount_due"])),
                "base_value": round2(b["selling_price"] * 0.97),
                "base_mileage": v["mileage"],
                "source": "purchase",
                "added_at": now_utc(),
            }
        )
    return await _save(deal)


@router.post("/{deal_id}/dealer-action", response_model=Deal)
async def dealer_action(deal_id: str, payload: DealerActionInput):
    deal = await _load(deal_id)
    if payload.action == "accept":
        price = deal.get("latest_offer") or deal["selling_price"]
        deal["agreed_price"] = round2(price)
        deal["selling_price"] = round2(price)
        deal["status"] = "accepted"
        deal["latest_counter"] = None
        deal["messages"].append(_msg("dealer", f"We accept your offer of ${price:,.0f}. Congratulations!", price))
    elif payload.action == "counter":
        if payload.amount is None:
            raise HTTPException(status_code=422, detail="amount required for counter")
        deal["latest_counter"] = round2(payload.amount)
        deal["status"] = "customer_countered"
        note = f" {payload.note}" if payload.note else ""
        deal["messages"].append(_msg("dealer", f"Our best number is ${payload.amount:,.0f}.{note}", payload.amount))
    elif payload.action == "decline":
        deal["status"] = "declined"
        deal["messages"].append(_msg("dealer", "We're too far apart on this one. Thanks for the opportunity."))
    else:  # takeover
        deal["taken_over"] = True
        deal["status"] = "manager_review"
        deal["messages"].append(_msg("system", "A dealership specialist has taken over this deal from the AI."))
    deal["breakdown"] = compute_deal(deal["vehicle"], deal.get("agreed_price") or deal["selling_price"], deal.get("trade"), deal.get("down_payment", 0.0))
    return await _save(deal)
