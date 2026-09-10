from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.pricing import garage_value, now_utc, round2
from models.schemas import GarageVehicle, MileageInput

router = APIRouter(prefix="/garage", tags=["garage"])


@router.get("", response_model=list[GarageVehicle])
async def list_garage():
    docs = await db.garage.find({}, {"_id": 0}).sort("added_at", -1).to_list(100)
    return [GarageVehicle(**d) for d in docs]


async def _load(gid: str) -> dict:
    doc = await db.garage.find_one({"id": gid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="garage vehicle not found")
    return doc


def _revalue(doc: dict) -> dict:
    """Anchor to this vehicle's own baseline; fall back to current value for legacy docs."""
    base_value = float(doc.get("base_value") or doc.get("estimated_value") or 0.0)
    base_mileage = int(doc.get("base_mileage") or doc.get("mileage") or 0)
    doc["base_value"] = base_value
    doc["base_mileage"] = base_mileage
    doc["estimated_value"] = garage_value(base_value, base_mileage, doc["mileage"])
    doc["equity"] = round2(doc["estimated_value"] - float(doc.get("payoff") or 0.0))
    return doc


@router.patch("/{gid}/mileage", response_model=GarageVehicle)
async def update_mileage(gid: str, payload: MileageInput):
    doc = await _load(gid)
    doc["mileage"] = payload.mileage
    doc = _revalue(doc)
    await db.garage.replace_one({"id": gid}, doc)
    return GarageVehicle(**doc)


@router.post("/{gid}/refresh", response_model=GarageVehicle)
async def refresh_value(gid: str):
    doc = await _load(gid)
    doc = _revalue(doc)
    doc["refreshed_at"] = now_utc()
    await db.garage.replace_one({"id": gid}, doc)
    return GarageVehicle(**doc)
