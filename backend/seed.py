"""Idempotent seed data for DealDrive. Run: cd /app/backend && python seed.py"""

import asyncio
from datetime import datetime, timezone

from lib.db import db, ensure_indexes
from lib.pricing import round2, trade_estimate

DEALER = "Summit Motors Group"
ADDRESS = "4820 Grand River Ave, Novi, MI 48375"

VEHICLES = [
    {
        "id": "veh-gmc-sierra-denali",
        "vin": "3GTUUGED5PG100411",
        "year": 2024,
        "make": "GMC",
        "model": "Sierra 1500",
        "trim": "Denali",
        "condition": "used",
        "price": 68995.0,
        "msrp": 72900.0,
        "incentives": 3250.0,
        "mileage": 12840,
        "distance_mi": 8.2,
        "features": ["Crew Cab", "6.2L V8", "Sunroof", "Heated & Cooled Seats", "Adaptive Cruise", "Bose Audio"],
        "image": "https://images.unsplash.com/photo-1601252300554-4ad551483bd2?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
        "exterior": "Onyx Black",
        "drivetrain": "4WD",
        "engine": "6.2L V8",
        "dealer_name": DEALER,
        "dealer_address": ADDRESS,
    },
    {
        "id": "veh-ford-f150-lariat",
        "vin": "1FTFW1E85PFA23901",
        "year": 2023,
        "make": "Ford",
        "model": "F-150",
        "trim": "Lariat",
        "condition": "used",
        "price": 59900.0,
        "msrp": 63500.0,
        "incentives": 2000.0,
        "mileage": 21460,
        "distance_mi": 14.6,
        "features": ["SuperCrew", "3.5L EcoBoost", "Pro Power Onboard", "B&O Sound", "360 Camera"],
        "image": "https://images.unsplash.com/photo-1624339024061-b435d9261c1d?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
        "exterior": "Rapid Red",
        "drivetrain": "4x4",
        "engine": "3.5L EcoBoost V6",
        "dealer_name": DEALER,
        "dealer_address": ADDRESS,
    },
    {
        "id": "veh-ram-1500-limited",
        "vin": "1C6SRFHT8PN560022",
        "year": 2024,
        "make": "Ram",
        "model": "1500",
        "trim": "Limited",
        "condition": "used",
        "price": 66200.0,
        "msrp": 70100.0,
        "incentives": 2750.0,
        "mileage": 9310,
        "distance_mi": 22.9,
        "features": ["Crew Cab", "5.7L HEMI", "Air Suspension", "12in Uconnect", "Panoramic Roof"],
        "image": "https://images.unsplash.com/photo-1649793395985-967862a3b73f?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
        "exterior": "Billet Silver",
        "drivetrain": "4WD",
        "engine": "5.7L HEMI V8",
        "dealer_name": DEALER,
        "dealer_address": ADDRESS,
    },
    {
        "id": "veh-toyota-tundra-1794",
        "vin": "5TFMA5DB9PX123845",
        "year": 2023,
        "make": "Toyota",
        "model": "Tundra",
        "trim": "1794 Edition",
        "condition": "used",
        "price": 62750.0,
        "msrp": 65900.0,
        "incentives": 1500.0,
        "mileage": 17205,
        "distance_mi": 31.4,
        "features": ["CrewMax", "i-FORCE Twin-Turbo V6", "Ventilated Leather", "JBL Premium Audio", "Tow Package"],
        "image": "https://images.unsplash.com/photo-1605504835488-e8c6d37beb43?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
        "exterior": "Smoked Mesquite",
        "drivetrain": "4x4",
        "engine": "3.4L Twin-Turbo V6",
        "dealer_name": DEALER,
        "dealer_address": ADDRESS,
    },
]

RULES = {
    "id": "dealership",
    "dealer_name": DEALER,
    "ai_discount_authority": 2500.0,
    "manager_threshold": 4000.0,
    "hard_floor": 61000.0,
    "max_deviation_pct": 18.0,
}

OVERRIDES = [
    # Demo rules for the Sierra: advertised 68,995 / AI authority 1,000 below advertised /
    # manager review zone between the AI authority and the hard floor / hard floor 65,500 /
    # max customer offer deviation 8%.
    {
        "vin": "3GTUUGED5PG100411",
        "label": "2024 GMC Sierra 1500 Denali (high demand)",
        "ai_discount_authority": 1000.0,
        "manager_threshold": 3495.0,  # 68,995 - 65,500 -> everything above the floor escalates
        "hard_floor": 65500.0,
        "max_deviation_pct": 8.0,
    }
]

GARAGE = [
    {
        "id": "garage-seed-silverado",
        "vin": "1GCUYDED5MZ118874",
        "year": 2021,
        "make": "Chevrolet",
        "model": "Silverado 1500",
        "trim": "LT Trail Boss",
        "image": "https://images.unsplash.com/photo-1605504835488-e8c6d37beb43?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
        "mileage": 58400,
        "payoff": 24800.0,
        "source": "trade",
    }
]


async def main():
    await db.vehicles.delete_many({})
    await db.vehicles.insert_many([dict(v) for v in VEHICLES])

    await db.dealer_rules.replace_one({"id": "dealership"}, dict(RULES), upsert=True)

    await db.vin_overrides.delete_many({})
    await db.vin_overrides.insert_many([dict(o) for o in OVERRIDES])

    await db.deals.delete_many({})

    await db.garage.delete_many({})
    for g in GARAGE:
        est = trade_estimate(g["year"], g["mileage"], "clean")
        doc = dict(g)
        doc["estimated_value"] = est["value"]
        doc["equity"] = round2(est["value"] - g["payoff"])
        doc["base_value"] = est["value"]
        doc["base_mileage"] = g["mileage"]
        doc["added_at"] = datetime.now(timezone.utc)
        await db.garage.insert_one(doc)

    await ensure_indexes()
    print("seeded:", len(VEHICLES), "vehicles,", len(OVERRIDES), "vin overrides,", len(GARAGE), "garage vehicles")


if __name__ == "__main__":
    asyncio.run(main())
