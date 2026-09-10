import re

from fastapi import APIRouter, HTTPException

from lib.db import db
from models.schemas import SearchResponse, Vehicle, VehicleMatch

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

# Keyword/alias mapping — "GMC Denali 1500" → "GMC Sierra 1500 Denali"
ALIASES = [
    (r"\bgmc\b.*\bdenali\b.*\b1500\b|\bgmc\b.*\b1500\b.*\bdenali\b", "GMC Sierra 1500 Denali"),
    (r"\bdenali\b", "GMC Sierra 1500 Denali"),
    (r"\bf[- ]?150\b", "Ford F-150 Lariat"),
    (r"\blariat\b", "Ford F-150 Lariat"),
    (r"\bram\b|\b1500 limited\b", "Ram 1500 Limited"),
    (r"\btundra\b|\b1794\b", "Toyota Tundra 1794 Edition"),
    (r"\bsierra\b", "GMC Sierra 1500 Denali"),
]

TERM_WEIGHTS = ["make", "model", "trim"]


def interpret(query: str):
    q = (query or "").strip()
    if not q:
        return "", "Showing all available trucks near you."
    low = q.lower()
    for pattern, canonical in ALIASES:
        if re.search(pattern, low):
            note = f'We read "{q}" as {canonical}.'
            return canonical, note
    return q, f'We searched inventory for "{q}".'


def score(vehicle: dict, canonical: str) -> int:
    if not canonical:
        return 88
    tokens = [t for t in re.split(r"[\s-]+", canonical.lower()) if t]
    hay = f"{vehicle['year']} {vehicle['make']} {vehicle['model']} {vehicle['trim']}".lower()
    hay += " " + " ".join(vehicle.get("features", [])).lower()
    hit = sum(1 for t in tokens if t in hay)
    pct = 60 + int(38 * (hit / max(1, len(tokens))))
    return min(99, pct)


@router.get("/search", response_model=SearchResponse)
async def search_vehicles(q: str = ""):
    canonical, note = interpret(q)
    docs = await db.vehicles.find({}, {"_id": 0}).to_list(100)
    matches = [VehicleMatch(**d, match_pct=score(d, canonical)) for d in docs]
    matches.sort(key=lambda m: (-m.match_pct, m.price))
    return SearchResponse(query=q, interpreted_as=canonical or q, interpretation_note=note, results=matches)


@router.get("/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str):
    doc = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="vehicle not found")
    return Vehicle(**doc)
