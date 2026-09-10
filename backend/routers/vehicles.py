import re

from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.llm import interpret_query
from lib.pricing import compute_deal
from models.schemas import Quote, SearchResponse, Vehicle, VehicleMatch

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

# Keyword/alias mapping — "GMC Denali 1500" → "GMC Sierra 1500 Denali"
ALIASES = [
    (r"\bgmc\b.*\bdenali\b.*\b1500\b|\bgmc\b.*\b1500\b.*\bdenali\b", "GMC Sierra 1500 Denali"),
    (r"\bsierra\b", "GMC Sierra 1500 Denali"),
    (r"\bdenali\b", "GMC Sierra 1500 Denali"),
    (r"\bf[- ]?150\b|\blariat\b", "Ford F-150 Lariat"),
    (r"\bram\b|\b1500 limited\b", "Ram 1500 Limited"),
    (r"\btundra\b|\b1794\b", "Toyota Tundra 1794 Edition"),
]

# Words that carry no vehicle identity, so they must not decide exactness.
STOP = {
    "the", "a", "an", "with", "and", "or", "under", "over", "below", "above", "for", "in",
    "truck", "trucks", "pickup", "new", "used", "car", "vehicle", "edition", "trim", "cab",
    "crew", "double", "single", "k", "miles", "mile", "near", "me", "any", "looking", "want",
}


def _norm(text: str) -> str:
    """'F-150' and 'f150' must compare equal."""
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def _squash(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def interpret(query: str):
    """Deterministic fallback interpretation — used whenever ChatGPT is unavailable."""
    q = (query or "").strip()
    if not q:
        return "", "Showing all available trucks near you."
    low = _norm(q)
    for pattern, canonical in ALIASES:
        if re.search(pattern, low):
            return canonical, f'Interpreted as {canonical}'
    return q, f'We searched inventory for "{q}".'


def _haystack(vehicle: dict) -> str:
    return _norm(f"{vehicle['make']} {vehicle['model']} {vehicle['trim']}")


def _identity_tokens(canonical: str, inventory: list[dict]) -> list[str]:
    """Tokens from the interpreted query that actually identify a vehicle."""
    known = set()
    for v in inventory:
        known.update(_haystack(v).split())
    tokens = []
    for t in _norm(canonical).split():
        if t in STOP or len(t) < 2:
            continue
        # a bare 4+ digit number is a budget ("60000"), not a model, unless inventory uses it
        if t.isdigit() and len(t) >= 4 and t not in known:
            continue
        tokens.append(t)
    return tokens


def _names_a_vehicle(tokens: list[str], inventory: list[dict], ai: dict | None = None) -> bool:
    """True when the shopper named a make/model, not just features or a budget.

    Includes brands we do NOT stock — searching "Honda Ridgeline" must report
    "No exact matches found." rather than silently listing unrelated trucks as matches.
    """
    if ai and (ai.get("make") or ai.get("model")):
        return True
    makes = {_norm(v["make"]) for v in inventory}
    models = set()
    for v in inventory:
        models.update(_norm(v["model"]).split())
    return any(t in makes or t in models for t in tokens)


def _is_exact(vehicle: dict, tokens: list[str], ai: dict | None) -> bool:
    """Every identifying token must be present, so a Sierra 1500 Denali search can never
    promote a Yukon Denali — the model token guards the category."""
    hay = _haystack(vehicle)
    hay_squashed = _squash(f"{vehicle['make']}{vehicle['model']}{vehicle['trim']}")
    if not all(t in hay.split() or t in hay_squashed for t in tokens):
        return False
    # If ChatGPT identified a make/model explicitly, honour it as a hard category check.
    if ai:
        if ai.get("make") and _norm(ai["make"]) != _norm(vehicle["make"]):
            return False
        if ai.get("model") and _squash(ai["model"]) not in _squash(vehicle["model"]) \
                and _squash(vehicle["model"]) not in _squash(ai["model"]):
            return False
    return True


def score(vehicle: dict, canonical: str) -> int:
    if not canonical:
        return 88
    tokens = [t for t in _norm(canonical).split() if t not in STOP]
    hay = _haystack(vehicle) + " " + _norm(" ".join(vehicle.get("features", [])))
    hit = sum(1 for t in tokens if t in hay)
    pct = 60 + int(38 * (hit / max(1, len(tokens))))
    return min(99, pct)


async def _cached_ai_interpretation(q: str):
    """ChatGPT interpretation, memoised per query so repeat searches stay instant."""
    key = q.strip().lower()
    if not key:
        return None
    cached = await db.search_interpretations.find_one({"_id": key}, {"_id": 0})
    if cached:
        return cached
    parsed = await interpret_query(q)
    if parsed:
        await db.search_interpretations.update_one({"_id": key}, {"$set": parsed}, upsert=True)
    return parsed


def _price_ok(vehicle: dict, ai: dict) -> bool:
    """Price is a HARD constraint — a shopper who says 'under 60k' must never see 68k."""
    if ai.get("max_price") and vehicle["price"] > float(ai["max_price"]):
        return False
    if ai.get("min_price") and vehicle["price"] < float(ai["min_price"]):
        return False
    return True


def _feature_hits(vehicle: dict, ai: dict) -> int:
    """Features are a SOFT signal — they rank results, they don't remove them."""
    feats = ai.get("required_features") or []
    if not feats:
        return 0
    hay = _norm(f"{vehicle['make']} {vehicle['model']} {vehicle['trim']} "
                f"{' '.join(vehicle.get('features', []))} {vehicle.get('drivetrain', '')} {vehicle.get('engine', '')}")
    return sum(1 for f in feats if _norm(f) in hay)


@router.get("/search", response_model=SearchResponse)
async def search_vehicles(q: str = ""):
    inventory = await db.vehicles.find({}, {"_id": 0}).to_list(100)
    docs = list(inventory)

    ai = await _cached_ai_interpretation(q)
    if ai:
        canonical = ai["canonical"]
        note = ai.get("note") or f"Interpreted as {canonical}"
        in_budget = [d for d in docs if _price_ok(d, ai)]
        if in_budget:
            docs = in_budget
        elif ai.get("max_price"):
            note += f" Nothing in stock is under ${float(ai['max_price']):,.0f}, so here are the closest trucks."
    else:
        canonical, note = interpret(q)

    tokens = _identity_tokens(canonical, inventory) if canonical else []
    model_search = bool(canonical) and _names_a_vehicle(tokens, inventory, ai)

    def build(d):
        pct = score(d, canonical)
        feats = (ai or {}).get("required_features") or []
        if feats:
            hits = _feature_hits(d, ai)
            pct = int(round(0.45 * pct + 0.55 * (60 + 39 * (hits / len(feats)))))
        return VehicleMatch(**d, match_pct=min(99, pct))

    if model_search:
        exact = [build(d) for d in docs if _is_exact(d, tokens, ai)]
        alts = [build(d) for d in docs if not _is_exact(d, tokens, ai)]
        # An exact match is always the primary result, never outranked by an alternative.
        for m in exact:
            m.match_pct = max(m.match_pct, 96)
        exact.sort(key=lambda m: (-m.match_pct, m.price))
        alts.sort(key=lambda m: (-m.match_pct, m.price))
        if not exact:
            note = f"No exact matches found for {canonical}."
        results = exact + alts
    else:
        results = [build(d) for d in docs]
        results.sort(key=lambda m: (-m.match_pct, m.price))
        exact, alts = results, []

    return SearchResponse(
        query=q,
        interpreted_as=canonical or q,
        interpretation_note=note,
        model_search=model_search,
        has_exact=bool(exact) if model_search else True,
        exact_matches=exact,
        alternatives=alts,
        results=results,
    )


@router.get("/quote", response_model=list[Quote])
async def quote_vehicles(ids: str = "", down_payment: float = 0.0, trade_equity: float = 0.0):
    """Side-by-side OTD quotes without creating deals. Declared above /{vehicle_id} so
    FastAPI does not capture "quote" as a vehicle id."""
    wanted = [i for i in (ids or "").split(",") if i.strip()][:4]
    if not wanted:
        raise HTTPException(status_code=422, detail="ids query parameter is required")
    docs = await db.vehicles.find({"id": {"$in": wanted}}, {"_id": 0}).to_list(10)
    if not docs:
        raise HTTPException(status_code=404, detail="no matching vehicles")
    by_id = {d["id"]: d for d in docs}
    # synthetic trade carries the equity the shopper brings from My Garage
    trade = {"estimated_value": float(trade_equity), "payoff": 0.0} if trade_equity else None
    return [
        Quote(vehicle=Vehicle(**by_id[i]), breakdown=compute_deal(by_id[i], float(by_id[i]["price"]), trade, down_payment))
        for i in wanted
        if i in by_id
    ]


@router.get("/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str):
    doc = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="vehicle not found")
    return Vehicle(**doc)
