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
| `/` | NL search hero + 4 matching trucks (match %, price, mileage, distance, features, Build Deal, Compare) |
| `/compare` | `?ids=a,b&equity=` — two trucks side by side, OTD + amount due + est. payment, "Lowest cost" badge |
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

`GET /vehicles/search?q=`, `GET /vehicles/quote?ids=&down_payment=&trade_equity=`,
`GET /vehicles/{id}`, `POST /deals`, `GET /deals`, `GET /deals/{id}`,
`PUT /deals/{id}/trade`, `POST /deals/{id}/coach`, `POST /deals/{id}/offer`,
`POST /deals/{id}/accept-counter`,
`POST /deals/{id}/decline`, `POST /deals/{id}/appointment`, `POST /deals/{id}/dealer-action`,
`GET|PUT /dealer/rules`, `GET /dealer/overrides`, `PUT|DELETE /dealer/overrides/{vin}`,
`GET /dealer/effective-rules/{vin}`, `GET /garage`, `PATCH /garage/{gid}/mileage`,
`POST /garage/{gid}/refresh`

> `/vehicles/quote` **must stay declared above** `/vehicles/{vehicle_id}` in
> `routers/vehicles.py`, or FastAPI captures `"quote"` as a vehicle id.

## The four follow-on features

- **Monthly Payment** (`components/PaymentEstimator.jsx` + `lib/finance.js`) — term (48–84mo)
  and APR (0–15%) range sliders beside the OTD on Build Deal and Negotiate. Amortisation runs
  client-side for instant slider feedback; `lib/pricing.monthly_payment()` is the identical
  server-side helper (verified to the cent). Estimate only, no lender connected.
- **Deal Comparison** (`pages/Compare.jsx`) — "Compare" checkbox on each result card, a floating
  compare bar (max 2, oldest swaps out), then `/compare?ids=a,b`. Powered by `GET /vehicles/quote`,
  which computes breakdowns **without creating deals**. Cheapest `amount_due` gets a
  "Lowest cost" badge. Carries garage equity through via `&equity=`.
- **Negotiation Coach** (`POST /deals/{id}/coach` + `components/OfferCoach.jsx`) — "Check My Offer
  First" returns a **band only** (`strong` / `possible` / `unlikely`) plus a hint. Bands come from
  `pricing.coach_band()`; ChatGPT rephrases (fallback = canned copy). The response body is
  `{band, hint, amount}` and **never** contains rule values; the hint is regex-guarded against
  rule vocabulary. The endpoint is **read-only** — it does not touch deal status or messages.
- **Dealer Notifications** (`lib/useDealerAlerts.js`) — shared hook polling `GET /deals` every 8s
  (`refetchIntervalInBackground`). `needsHuman(deal)` = open AND (`manager_review` OR `taken_over`).
  Drives a header bell with a count, a "Needs a Human" stat, an amber alert list, and amber row
  borders. The dashboard owns the toasts (`notify: true`) so a deal is never announced twice; the
  first load adopts existing alerts without toasting history.

## ChatGPT integration (`backend/lib/llm.py`)

OpenAI **gpt-5.2** via `emergentintegrations` + `EMERGENT_LLM_KEY` in `backend/.env`.
Server-side only. Every call is wrapped so that **any** error/timeout (20s) returns `None`
and the caller silently falls back to the deterministic rules engine — the deal flow never
breaks and the UI never shows an AI error.

1. **Search interpretation** (`interpret_query`) — free-form query → JSON
   `{canonical, make, model, trim, max_price, min_price, required_features[], note}`.
   Results are **memoised in `search_interpretations`** (`_id` = lowercased query) so repeat
   searches are instant and cost nothing. Fallback: the regex `ALIASES` map.
   - **price is a HARD filter** (`under 60k` never shows a $68k truck);
   - **features are a SOFT ranking signal** (blended into match %, never remove results);
   - if the budget matches nothing, all trucks are returned with an explanatory note — the
     results page is never empty.
2. **Negotiation phrasing** (`negotiation_message`) — the **rules engine stays authoritative
   for the decision AND the price**, so the hard floor can never be breached by the model.
   ChatGPT only rewrites that fixed outcome into 1–2 conversational sentences, given the
   vehicle, the trade, and the last 6 turns. Guards before the text is accepted: it must quote
   the required price, be ≤700 chars, and contain no rule vocabulary (`hard floor`,
   `discount authority`, `approval threshold`, `deviation`, `as an AI`…). Any failure → the
   original canned text. **Dealer rules are never exposed to the customer.**

## Business logic (`backend/lib/pricing.py`)

- **Search interpretation fallback**: regex alias map. `"GMC Denali 1500"` →
  `GMC Sierra 1500 Denali`. Match % = token overlap against year/make/model/trim/features.
- **Exact vs alternatives**: when the query names a make/model (`model_search`), results split
  into `exact_matches` (every identifying token present + AI make/model agreement, forced to
  ≥96% so an exact always ranks first) and `alternatives`. A model token guards the category —
  a Sierra 1500 Denali search can never promote a Yukon Denali. Zero exact matches →
  `has_exact: false` and "No exact matches found." with the alternatives clearly labelled.
  Feature/budget queries with no named model skip the split entirely.
- **Deal math**: doc fee $699, title $185, tax 7.5% on (price − incentives).
  `OTD = price − incentives + fees + tax`; `amount_due = OTD − trade_equity − down_payment`;
  `trade_equity = trade_value − payoff` (can be negative).
- **Trade valuation**: deterministic — base $52,000 − (age × $3,200) − (mileage/1000 × $210),
  × condition factor (excellent 1.06, clean 1.0, fair 0.9); range = ±6%.
- **Garage revaluation** (`pricing.garage_value`): anchored to each vehicle's OWN recorded
  `base_value` / `base_mileage`, depreciating $210 per additional 1,000 miles, floored at 12%
  of the baseline. Never re-run `trade_estimate()` on a garage vehicle — that made a $69k
  Denali revalue to ~$42k as soon as its mileage was edited.
- **Effective rules guard**: a dealership-wide dollar `hard_floor` can exceed a cheaper unit's
  advertised price, which made the desk counter ABOVE its own asking price. `effective_rules`
  now falls back to `advertised − 6,500` whenever the configured floor ≥ advertised, and clamps
  authority/threshold to the advertised−floor spread.
- **Counter pricing**: a lowball counter sits at `min(advertised, max(floor + 400, advertised −
  authority))` — never above asking, and never exactly ON the floor (quoting the floor would
  disclose it).
- **Negotiation** (rules invisible to consumer): discount = advertised − offer.
  offer ≥ advertised → **accept**. offer < hard_floor OR deviation > max_deviation_pct →
  **counter** (professional, floor never named). discount ≤ ai_authority → **accept**.
  discount ≤ manager_threshold → **escalate**: the AI does NOT counter, `latest_counter` stays
  `None`, status becomes `manager_review`, and the complete deal lands on the Dealer Desk for a
  human. Otherwise **counter** at `advertised − ai_authority`.
  If a dealer has hit **Take Over**, offers no longer auto-respond — status goes `manager_review`.
- **Appointment booking** closes the deal and inserts the vehicle into My Garage.

## Statuses

`building` → `pending_ai` / `customer_countered` (Dealer Countered) / `manager_review` →
`accepted` → `closed` (scheduled); or `declined`.

## Seed facts (`cd /app/backend && python seed.py`, idempotent)

- 4 vehicles: GMC Sierra 1500 Denali **$68,995** (VIN `3GTUUGED5PG100411`),
  Ford F-150 Lariat $59,900, Ram 1500 Limited $66,200, Toyota Tundra 1794 $62,750
- Dealership rules: AI authority $2,500, manager threshold $4,000, hard floor $61,000, max dev 18%
- **Sierra VIN override (the demo rules)**: AI authority **$1,000**, manager threshold $3,495,
  hard floor **$65,500**, max deviation **8%**. So on the Sierra: offer ≥ $67,995 → AI accepts;
  $65,500–$67,995 → manager review on the Dealer Desk; below $65,500 (or >8% off) → AI counters.
- 1 garage vehicle: 2021 Chevrolet Silverado 1500 LT Trail Boss, 58,400 mi, payoff $24,800
- `deals` starts empty
