# DealDrive — Living Spec

Automotive marketplace **prototype**. Consumer shops vehicles in plain language, builds a full
out-the-door deal, adds a trade, negotiates against a rules-based AI desk, and is handed off to
the dealer. Dealer side manages the incoming deal queue and negotiation rules.

All data is fake/sample. No credit bureau, lender, DMV, payment processor, KBB, J.D. Power, or
real dealer system is connected.

## Access

No login. A header **role switcher** flips between Consumer (`/`) and Dealer (`/dealer`).

## Routes

| Route | Purpose |
|---|---|
| `/` | NL search hero + 4 matching trucks (match %, price, mileage, distance, features, Build Deal) |
| `/vehicle/:vehicleId` | Vehicle detail (specs, VIN, features, incentives, Build Deal) |
| `/deal/:dealId` | Build Deal: OTD breakdown, down payment, Add Trade flow, submit offer |
| `/negotiate/:dealId` | Negotiation thread, Accept/Counter/Decline, Deal Accepted + appointment scheduling |
| `/garage` | My Garage: est. value, payoff, equity, Update Mileage, Refresh Value, Shop With This Vehicle |
| `/dealer` | Dealer dashboard + incoming deals list with status badges |
| `/dealer/deals/:dealId` | Deal detail: offer, trade, deal structure, active rules, Accept/Counter/Decline/Take Over |
| `/dealer/settings` | Dealership default rules + per-VIN overrides |

## Data model (MongoDB, string uuid `id`)

- **vehicles** — vin, year, make, model, trim, price, msrp, incentives, mileage, distance_mi,
  features[], image, exterior, drivetrain, engine, dealer_name, dealer_address
- **deals** — vehicle (embedded), customer_name, status, selling_price, down_payment, trade,
  breakdown, latest_offer, latest_counter, agreed_price, taken_over, messages[], appointment
- **dealer_rules** — single doc `id: "dealership"`: ai_discount_authority, manager_threshold,
  hard_floor, max_deviation_pct
- **vin_overrides** — per-VIN partial rule overrides (win over dealership defaults)
- **garage** — vin, year/make/model/trim, mileage, payoff, estimated_value, equity, source

## Key API endpoints (all on `api_router`, prefix `/api`)

`GET /vehicles/search?q=`, `GET /vehicles/{id}`, `POST /deals`, `GET /deals`, `GET /deals/{id}`,
`PUT /deals/{id}/trade`, `POST /deals/{id}/offer`, `POST /deals/{id}/accept-counter`,
`POST /deals/{id}/decline`, `POST /deals/{id}/appointment`, `POST /deals/{id}/dealer-action`,
`GET|PUT /dealer/rules`, `GET /dealer/overrides`, `PUT|DELETE /dealer/overrides/{vin}`,
`GET /dealer/effective-rules/{vin}`, `GET /garage`, `PATCH /garage/{gid}/mileage`,
`POST /garage/{gid}/refresh`

## Business logic (`backend/lib/pricing.py`)

- **Search interpretation**: regex alias map. `"GMC Denali 1500"` → `GMC Sierra 1500 Denali`.
  Match % = token overlap against year/make/model/trim/features.
- **Deal math**: doc fee $699, title $185, tax 7.5% on (price − incentives).
  `OTD = price − incentives + fees + tax`; `amount_due = OTD − trade_equity − down_payment`;
  `trade_equity = trade_value − payoff` (can be negative).
- **Trade valuation**: deterministic — base $52,000 − (age × $3,200) − (mileage/1000 × $210),
  × condition factor (excellent 1.06, clean 1.0, fair 0.9); range = ±6%.
- **Negotiation** (rules invisible to consumer): discount = advertised − offer.
  offer ≥ advertised → accept. offer < hard_floor OR deviation > max_deviation_pct → counter at
  `max(floor, advertised − ai_authority)`. discount ≤ ai_authority → accept.
  discount ≤ manager_threshold → counter at midpoint, status `manager_review`.
  Otherwise counter at `advertised − ai_authority`.
  If a dealer has hit **Take Over**, offers no longer auto-respond — status goes `manager_review`.
- **Appointment booking** closes the deal and inserts the vehicle into My Garage.

## Statuses

`building` → `pending_ai` / `customer_countered` (Dealer Countered) / `manager_review` →
`accepted` → `closed` (scheduled); or `declined`.

## Seed facts (`cd /app/backend && python seed.py`, idempotent)

- 4 vehicles: GMC Sierra 1500 Denali $68,450 (VIN `3GTUUGED5PG100411`),
  Ford F-150 Lariat $59,900, Ram 1500 Limited $66,200, Toyota Tundra 1794 $62,750
- Dealership rules: AI authority $2,500, manager threshold $4,000, hard floor $61,000, max dev 18%
- 1 VIN override on the Denali: AI authority $1,500, floor $64,500, max dev 10%
- 1 garage vehicle: 2021 Chevrolet Silverado 1500 LT Trail Boss, 58,400 mi, payoff $24,800
- `deals` starts empty
