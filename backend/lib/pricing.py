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
    """Full breakdown. Three DISTINCT totals, never conflated:

      estimated_otd          — price - incentives + fees + tax (what the vehicle costs)
      cash_due_at_delivery   — the customer's down payment (cash out of pocket)
      amount_financed        — OTD - trade equity - down payment (what a lender would carry)
    """
    incentives = float(vehicle.get("incentives", 0.0))
    taxable = max(0.0, selling_price - incentives)
    tax = taxable * TAX_RATE
    trade_value = float(trade.get("estimated_value", 0.0)) if trade else 0.0
    payoff = float(trade.get("payoff", 0.0)) if trade else 0.0
    equity = trade_value - payoff
    down = float(down_payment or 0.0)
    otd = selling_price - incentives + DOC_FEE + TITLE_FEE + tax
    financed = otd - equity - down
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
        "down_payment": round2(down),
        "estimated_otd": round2(otd),
        "cash_due_at_delivery": round2(down),
        "amount_financed": round2(financed),
        # kept as an alias so older callers keep working; equals amount_financed
        "amount_due": round2(financed),
    }


def _apply_rule_values(rules: dict, override: dict | None):
    """Apply only explicitly configured rule values, preserving inheritance."""
    if not override:
        return

    for key in (
        "ai_discount_authority",
        "manager_threshold",
        "hard_floor",
        "max_deviation_pct",
    ):
        if override.get(key) is not None:
            rules[key] = float(override[key])


def _matches(value, expected):
    """Case-insensitive exact match for rule selectors."""
    if expected is None:
        return True
    return str(value or "").strip().lower() == str(expected).strip().lower()


def effective_rules(
    vehicle: dict,
    dealer_rules: dict,
    vin_override: dict | None,
    scoped_rules: list[dict] | None = None,
):
    """
    Resolve negotiation rules from broadest to most specific:

    dealership -> condition -> model -> trim -> VIN

    Each level only overrides values explicitly configured at that level.
    """
    advertised = float(vehicle["price"])

    dealer_floor = dealer_rules.get("hard_floor")
    if dealer_floor is None:
        dealer_floor = advertised - DEFAULT_RULES["hard_floor_offset"]

    rules = {
        "advertised_price": advertised,
        "ai_discount_authority": float(
            dealer_rules.get(
                "ai_discount_authority",
                DEFAULT_RULES["ai_discount_authority"],
            )
        ),
        "manager_threshold": float(
            dealer_rules.get(
                "manager_threshold",
                DEFAULT_RULES["manager_threshold"],
            )
        ),
        "hard_floor": float(dealer_floor),
        "max_deviation_pct": float(
            dealer_rules.get(
                "max_deviation_pct",
                DEFAULT_RULES["max_deviation_pct"],
            )
        ),
        "source": "dealership_default",
        "applied_sources": ["dealership_default"],
    }

    vehicle_condition = vehicle.get("condition", "used")
    vehicle_make = vehicle.get("make", "")
    vehicle_model = vehicle.get("model", "")
    vehicle_trim = vehicle.get("trim", "")

    scoped_rules = scoped_rules or []

    # Broadest scoped rule first: New / Used.
    for rule in scoped_rules:
        if (
            rule.get("level") == "condition"
            and _matches(vehicle_condition, rule.get("condition"))
        ):
            _apply_rule_values(rules, rule)
            rules["source"] = "condition_rule"
            rules["applied_sources"].append(rule.get("id", "condition_rule"))

    # Model rules are brand-aware so "1500" or similar names do not collide.
    for rule in scoped_rules:
        if (
            rule.get("level") == "model"
            and _matches(vehicle_make, rule.get("make"))
            and _matches(vehicle_model, rule.get("model"))
        ):
            _apply_rule_values(rules, rule)
            rules["source"] = "model_rule"
            rules["applied_sources"].append(rule.get("id", "model_rule"))

    # Trim rules inherit the condition + model rules above them.
    for rule in scoped_rules:
        if (
            rule.get("level") == "trim"
            and _matches(vehicle_make, rule.get("make"))
            and _matches(vehicle_model, rule.get("model"))
            and _matches(vehicle_trim, rule.get("trim"))
        ):
            _apply_rule_values(rules, rule)
            rules["source"] = "trim_rule"
            rules["applied_sources"].append(rule.get("id", "trim_rule"))

    # A VIN override always has final authority.
    if vin_override:
        _apply_rule_values(rules, vin_override)
        rules["source"] = "vin_override"
        rules["applied_sources"].append("vin_override")

    # A dollar floor must never be at or above this vehicle's advertised price.
    if rules["hard_floor"] >= advertised:
        rules["hard_floor"] = round2(
            max(0.0, advertised - DEFAULT_RULES["hard_floor_offset"])
        )

    # Neither automatic authority nor the manager zone may extend below the floor.
    available_discount = max(0.0, advertised - rules["hard_floor"])
    rules["ai_discount_authority"] = min(
        rules["ai_discount_authority"],
        available_discount,
    )
    rules["manager_threshold"] = min(
        rules["manager_threshold"],
        available_discount,
    )

    return rules


def coach_band(offer: float, rules: dict):
    """Private likelihood hint for the CUSTOMER. Returns (band, canned_hint).

    Deliberately coarse and number-free: it must never disclose the hard floor, the AI
    discount authority, or the approval threshold.
    """
    advertised = rules["advertised_price"]
    discount = advertised - offer

    if discount <= 0:
        return ("strong", "At or above asking — this should be accepted right away.")
    if discount <= rules["ai_discount_authority"]:
        return ("strong", "This is in a range the store can usually approve on the spot.")
    if discount <= rules["manager_threshold"]:
        return ("possible", "This is worth sending, but expect the store to counter a little higher.")
    if offer >= rules["hard_floor"]:
        return ("unlikely", "This is an aggressive offer — the store will likely counter well above it.")
    return ("unlikely", "This is below what the store can realistically do on this truck; expect a firm counter.")


def monthly_payment(principal: float, apr_pct: float, months: int) -> float:
    """Standard amortised payment. Estimate only — no lender is connected."""
    p = max(0.0, float(principal))
    n = max(1, int(months))
    r = float(apr_pct) / 100.0 / 12.0
    if p == 0:
        return 0.0
    if r == 0:
        return round2(p / n)
    factor = (1 + r) ** n
    return round2(p * r * factor / (factor - 1))


def garage_value(base_value: float, base_mileage: int, mileage: int) -> float:
    """Revalue a garage vehicle from ITS OWN baseline, not the generic trade formula.

    Using trade_estimate() here made a $69k truck revalue to $42k the moment its mileage was
    edited. Depreciate from the recorded baseline instead: $210 per additional 1,000 miles,
    floored at 12% of the baseline so the number stays believable.
    """
    base = max(0.0, float(base_value))
    delta_miles = max(0, int(mileage) - int(base_mileage))
    value = base - (delta_miles / 1000.0) * 210.0
    return round2(max(base * 0.12, value))


def negotiate(offer: float, rules: dict):
    """Return (decision, counter_price_or_None, dealer_message, status).

    decision is one of: accepted | countered | escalated.
    Rules stay invisible to the consumer — no message ever names the floor or the authority.
    """
    advertised = rules["advertised_price"]
    floor = rules["hard_floor"]
    discount = advertised - offer
    deviation_pct = (discount / advertised) * 100 if advertised else 0

    # At or above asking — nothing to negotiate.
    if discount <= 0:
        return ("accepted", round2(offer), "Great news — we can do that. Your offer is accepted at $%s." % f"{offer:,.0f}", "accepted")

    # Unreasonably low: counter professionally, never disclose the floor.
    if offer < floor or deviation_pct > rules["max_deviation_pct"]:
        # Sit a little above the floor so the quoted counter never IS the floor, and never
        # exceed our own asking price.
        counter = round2(min(advertised, max(floor + 400.0, advertised - rules["ai_discount_authority"])))
        return (
            "countered",
            counter,
            "Thanks for the offer. We're not able to get to that number on this truck, but we can put "
            "together $%s today." % f"{counter:,.0f}",
            "customer_countered",
        )

    # Inside the AI's own authority — it can say yes on the spot.
    if discount <= rules["ai_discount_authority"]:
        return ("accepted", round2(offer), "Done — we can meet you at $%s. Let's get your paperwork started." % f"{offer:,.0f}", "accepted")

    # Manager zone: the AI does NOT counter. The complete deal goes to the Dealer Desk.
    if discount <= rules["manager_threshold"]:
        return (
            "escalated",
            None,
            "Thank you — your offer of $%s is with our sales manager for review right now. "
            "You'll see their response here as soon as it's in." % f"{offer:,.0f}",
            "manager_review",
        )

    counter = round2(min(advertised, max(floor + 400.0, advertised - rules["ai_discount_authority"])))
    return (
        "countered",
        counter,
        "We appreciate the offer. Right now we can work at $%s — this trim is in high demand." % f"{counter:,.0f}",
        "customer_countered",
    )
