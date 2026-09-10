from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.pricing import effective_rules
from models.schemas import DealerRules, DealerRulesInput, VinOverride

router = APIRouter(prefix="/dealer", tags=["dealer"])


@router.get("/rules", response_model=DealerRules)
async def get_rules():
    doc = await db.dealer_rules.find_one({"id": "dealership"}, {"_id": 0})
    if not doc:
        doc = DealerRules().model_dump()
        await db.dealer_rules.insert_one(dict(doc))
    return DealerRules(**doc)


@router.put("/rules", response_model=DealerRules)
async def update_rules(payload: DealerRulesInput):
    await db.dealer_rules.update_one({"id": "dealership"}, {"$set": payload.model_dump()}, upsert=True)
    doc = await db.dealer_rules.find_one({"id": "dealership"}, {"_id": 0})
    return DealerRules(**doc)


@router.get("/overrides", response_model=list[VinOverride])
async def list_overrides():
    docs = await db.vin_overrides.find({}, {"_id": 0}).to_list(100)
    return [VinOverride(**d) for d in docs]


@router.put("/overrides/{vin}", response_model=VinOverride)
async def upsert_override(vin: str, payload: VinOverride):
    data = payload.model_dump()
    data["vin"] = vin
    await db.vin_overrides.update_one({"vin": vin}, {"$set": data}, upsert=True)
    return VinOverride(**data)


@router.delete("/overrides/{vin}")
async def delete_override(vin: str):
    res = await db.vin_overrides.delete_one({"vin": vin})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="override not found")
    return {"deleted": vin}


@router.get("/effective-rules/{vin}")
async def get_effective(vin: str):
    vehicle = await db.vehicles.find_one({"vin": vin}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="vehicle not found")
    dealer = await db.dealer_rules.find_one({"id": "dealership"}, {"_id": 0}) or {}
    override = await db.vin_overrides.find_one({"vin": vin}, {"_id": 0})
    return effective_rules(vehicle, dealer, override)
