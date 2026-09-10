from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.pricing import now_utc, round2, trade_estimate
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


@router.patch("/{gid}/mileage", response_model=GarageVehicle)
async def update_mileage(gid: str, payload: MileageInput):
    doc = await _load(gid)
    doc["mileage"] = payload.mileage
    est = trade_estimate(doc["year"], payload.mileage, "clean")
    doc["estimated_value"] = est["value"]
    doc["equity"] = round2(est["value"] - doc.get("payoff", 0.0))
    await db.garage.replace_one({"id": gid}, doc)
    return GarageVehicle(**doc)


@router.post("/{gid}/refresh", response_model=GarageVehicle)
async def refresh_value(gid: str):
    doc = await _load(gid)
    est = trade_estimate(doc["year"], doc["mileage"], "clean")
    doc["estimated_value"] = est["value"]
    doc["equity"] = round2(est["value"] - doc.get("payoff", 0.0))
    doc["refreshed_at"] = now_utc()
    await db.garage.replace_one({"id": gid}, doc)
    return GarageVehicle(**doc)
