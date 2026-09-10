"""Deterministic deal math + rules-based negotiation engine. All fake/sample logic."""

from datetime import datetime, timezone

DOC_FEE = 699.0
TITLE_FEE = 185.0
TAX_RATE = 0.075

DEFAULT_RULES = {
    "ai_discount_authority": 2500.0,
    "manager_threshold": 4000.0,
    "hard_floor_offset": 6500.0,  # advertised - offset = hard floor when no explicit floor
    "max_deviation_pct": 18.0,
}

CONDITION_FACTOR = {"excellent": 1.06, "clean": 1.0, "fair": 0.9}


def now_utc():
    return datetime.now(timezone.utc)


def round2(v):
    return round(float(v) + 0.0, 2)


def trade_estimate(year: int, mileage: int, condition: str):
    """Fake but deterministic trade valuation."""
    age = max(0, datetime.now(timezone.utc).year - int(year))
    base = 52000.0 - (age * 3200.0) - (int(mileage) / 1000.0 * 210.0)
    base = max(3500.0, base)
    base *= CONDITION_FACTOR.get((condition or "clean").lower(), 1.0)
    low = round2(base * 0.94)
    high = round2(base * 1.06)
    return {"low": low, "high": high, "value": round2(base)}


def compute_deal(vehicle: dict, selling_price: float, trade: dict | None, down_payment: float = 0.0):
    """Full OTD breakdown. Trade equity = trade value - payoff."""
    incentives = float(vehicle.get("incentives", 0.0))
    taxable = max(0.0, selling_price - incentives)
    tax = taxable * TAX_RATE
    trade_value = float(trade.get("estimated_value", 0.0)) if trade else 0.0
    payoff = float(trade.get("payoff", 0.0)) if trade else 0.0
    equity = trade_value - payoff
    otd = selling_price - incentives + DOC_FEE + TITLE_FEE + tax
    amount_due = otd - equity - float(down_payment or 0.0)
    return {
        "selling_price": round2(selling_price),
        "incentives": round2(incentives),
        "doc_fee": DOC_FEE,
        "title_fee": TITLE_FEE,
        "tax_rate": TAX_RATE,
        "estimated_tax": round2(tax),
        "trade_value": round2(trade_value),
        "trade_payoff": round2(payoff),
        "trade_equity": round2(equity),
        "down_payment": round2(down_payment or 0.0),
        "estimated_otd": round2(otd),
        "amount_due": round2(amount_due),
    }


def effective_rules(vehicle: dict, dealer_rules: dict, vin_override: dict | None):
    advertised = float(vehicle["price"])
    r = {
        "advertised_price": advertised,
        "ai_discount_authority": float(dealer_rules.get("ai_discount_authority", DEFAULT_RULES["ai_discount_authority"])),
        "manager_threshold": float(dealer_rules.get("manager_threshold", DEFAULT_RULES["manager_threshold"])),
        "hard_floor": float(dealer_rules.get("hard_floor", advertised - DEFAULT_RULES["hard_floor_offset"])),
        "max_deviation_pct": float(dealer_rules.get("max_deviation_pct", DEFAULT_RULES["max_deviation_pct"])),
        "source": "dealership_default",
    }
    if vin_override:
        for k in ("ai_discount_authority", "manager_threshold", "hard_floor", "max_deviation_pct"):
            if vin_override.get(k) is not None:
                r[k] = float(vin_override[k])
        r["source"] = "vin_override"
    return r


def negotiate(offer: float, rules: dict):
    """Return (decision, counter_price, dealer_message, status). Rules stay invisible to the consumer."""
    advertised = rules["advertised_price"]
    floor = rules["hard_floor"]
    discount = advertised - offer
    deviation_pct = (discount / advertised) * 100 if advertised else 0

    if discount <= 0:
        return ("accepted", round2(offer), "Great news — we can do that. Your offer is accepted at $%s." % f"{offer:,.0f}", "accepted")

    if offer < floor or deviation_pct > rules["max_deviation_pct"]:
        counter = round2(max(floor, advertised - rules["ai_discount_authority"]))
        return (
            "countered",
            counter,
            "That's further than we can go on this truck. The best we can put together right now is $%s." % f"{counter:,.0f}",
            "customer_countered",
        )

    if discount <= rules["ai_discount_authority"]:
        return ("accepted", round2(offer), "Done — we can meet you at $%s. Let's get your paperwork started." % f"{offer:,.0f}", "accepted")

    if discount <= rules["manager_threshold"]:
        counter = round2(max(floor, (offer + (advertised - rules["ai_discount_authority"])) / 2))
        return (
            "countered",
            counter,
            "I ran this past our desk. We can come down to $%s today — that's a strong number on this unit." % f"{counter:,.0f}",
            "manager_review",
        )

    counter = round2(max(floor, advertised - rules["ai_discount_authority"]))
    return (
        "countered",
        counter,
        "We appreciate the offer. Right now we can work at $%s — this trim is in high demand." % f"{counter:,.0f}",
        "customer_countered",
    )
