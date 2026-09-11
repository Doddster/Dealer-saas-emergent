"""ChatGPT (OpenAI gpt-5.2) layer for DealDrive.

Two server-side uses, both returning `None` on ANY failure so callers fall back to the
deterministic rules engine in lib/pricing.py. Dealer rules are sent to the model but are
NEVER allowed into customer-facing output — the caller re-validates every number.
"""

import asyncio
import json
import logging
import os
import re

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.6-luna")
TIMEOUT_S = float(os.environ.get("LLM_TIMEOUT_S", 20.0))

FEATURE_VOCAB = [
    "crew cab", "supercrew", "crewmax", "sunroof", "panoramic roof", "heated seats",
    "cooled seats", "ventilated leather", "adaptive cruise", "360 camera", "tow package",
    "air suspension", "premium audio", "v8", "ecoboost", "hemi", "twin-turbo", "4wd", "4x4",
]


def _key():
    return os.environ.get("OPENAI_API_KEY")


def _parse_json(text: str):
    """Models sometimes wrap JSON in prose or code fences."""
    if not text:
        return None
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


async def _ask(system_message: str, prompt: str):
    """One-shot structured call. Returns parsed JSON dict or None."""
    key = _key()

    if not key:
        logger.warning("llm: OPENAI_API_KEY missing — using rules engine")
        return None

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=key,
            timeout=TIMEOUT_S,
        )

        response = await asyncio.wait_for(
            client.responses.create(
                model=MODEL,
                instructions=system_message,
                input=prompt,
            ),
            timeout=TIMEOUT_S,
        )

        return _parse_json(response.output_text)

    except asyncio.TimeoutError:
        logger.warning("llm: timed out after %ss — using rules engine", TIMEOUT_S)
        return None

    except Exception as exc:
        logger.warning("llm: call failed (%s) — using rules engine", exc)
        return None

# ---------------------------------------------------------------- search interpretation

SEARCH_SYSTEM = """You interpret car-shopping queries for an automotive marketplace.
Correct the way real shoppers mis-order trim names: "GMC Denali 1500" means "GMC Sierra 1500 Denali".

Reply with ONLY a JSON object, no prose:
{
  "canonical": "corrected full vehicle name, or the cleaned-up query if no specific model is named",
  "make": "brand or null",
  "model": "model or null",
  "trim": "trim or null",
  "max_price": number or null,
  "min_price": number or null,
  "required_features": ["lowercase feature phrases the shopper explicitly asked for"],
  "note": "one short friendly sentence telling the shopper how you read their request"
}
Interpret "under 60k" as max_price 60000. Only list a feature if the shopper actually asked for it."""


async def interpret_query(query: str):
    """Free-form query -> structured filters. None on failure."""
    if not (query or "").strip():
        return None
    data = await _ask(
        SEARCH_SYSTEM,
        f'Shopper query: "{query}"\nKnown feature vocabulary: {", ".join(FEATURE_VOCAB)}',
    )
    if not isinstance(data, dict) or not data.get("canonical"):
        return None
    feats = data.get("required_features") or []
    return {
        "canonical": str(data["canonical"]),
        "make": data.get("make") or None,
        "model": data.get("model") or None,
        "trim": data.get("trim") or None,
        "max_price": data.get("max_price") if isinstance(data.get("max_price"), (int, float)) else None,
        "min_price": data.get("min_price") if isinstance(data.get("min_price"), (int, float)) else None,
        "required_features": [str(f).lower() for f in feats if isinstance(f, (str, int, float))][:6],
        "note": str(data.get("note") or ""),
        "source": "ai",
    }


# ---------------------------------------------------------------- negotiation phrasing

NEGOTIATE_SYSTEM = """You are the digital sales desk for a car dealership, messaging a customer
who has made an offer. Your internal pricing rules are CONFIDENTIAL.

ABSOLUTE RULES:
- NEVER reveal, hint at, or describe your hard floor, discount authority, approval thresholds,
  deviation limits, or that rules/AI govern your pricing.
- NEVER quote any price other than the exact `required_price` you are given.
- Never invent financing, warranty, trade values, or fees.

Write 1-2 warm, confident, human sentences. Reference the specific truck or the customer's
trade when it helps. If accepting, be congratulatory. If countering, be respectful and make
`required_price` feel like a genuinely strong number. No greetings like "Dear customer", no
signatures, no bullet points, no emojis.

Reply with ONLY JSON: {"message": "your reply to the customer"}"""


COACH_SYSTEM = """You are a private buying coach working for the CUSTOMER, not the dealership.
You are told a likelihood band for the offer they are about to send.

ABSOLUTE RULES:
- You do NOT know the dealership's internal limits. Never state or guess a hard floor,
  a minimum price, a discount cap, or "the lowest they will go".
- Never quote a specific alternative price and never tell them the exact number to offer.
- Never mention rules, thresholds, algorithms, or that you are an AI.

Give 1-2 short, plain, encouraging sentences: how likely this offer is to land and what to
expect next. Speak directly to the customer as "you".

Reply with ONLY JSON: {"hint": "your coaching sentence"}"""


async def coach_hint(*, band: str, offer: float, vehicle: dict, trade: dict | None):
    """Conversational phrasing for a likelihood band the rules engine already decided."""
    trade_line = "none"
    if trade:
        trade_line = f"{trade.get('year')} {trade.get('make')} {trade.get('model')} with a payoff of ${float(trade.get('payoff') or 0):,.0f}"

    prompt = f"""Truck: {vehicle.get('year')} {vehicle.get('make')} {vehicle.get('model')} {vehicle.get('trim')}
Advertised price: ${float(vehicle.get('price', 0)):,.0f}
The offer the customer is about to send: ${float(offer):,.0f}
Their trade: {trade_line}
Likelihood band: {band}  (strong = likely accepted, possible = likely countered slightly, unlikely = likely countered well above)

Coach the customer on this offer."""

    data = await _ask(COACH_SYSTEM, prompt)
    if not isinstance(data, dict):
        return None
    hint = str(data.get("hint") or "").strip()
    if not hint or len(hint) > 400:
        return None
    banned = ("hard floor", "discount authority", "approval threshold", "deviation",
              "as an ai", "manager threshold", "lowest they")
    if any(b in hint.lower() for b in banned):
        logger.warning("llm: coach hint leaked rule vocabulary — using canned text")
        return None
    return hint


async def negotiation_message(*, decision: str, required_price: float, vehicle: dict, offer: float,
                              trade: dict | None, history: list[dict]):
    """Conversational phrasing for a counter/accept the RULES ENGINE already decided.

    The price is fixed by the caller — the model only writes the words, so the hard floor can
    never be breached by the model. Returns a string, or None to use the canned text.
    """
    convo = "\n".join(
        f"{'Customer' if m.get('sender') == 'customer' else 'You'}: {m.get('text', '')}"
        for m in (history or [])[-6:]
        if m.get("sender") in ("customer", "dealer")
    ) or "(no prior messages)"

    trade_line = "none"
    if trade:
        trade_line = (
            f"{trade.get('year')} {trade.get('make')} {trade.get('model')}, "
            f"{trade.get('mileage')} miles, our appraisal ${float(trade.get('estimated_value') or 0):,.0f}, "
            f"customer still owes ${float(trade.get('payoff') or 0):,.0f}"
        )

    prompt = f"""Vehicle: {vehicle.get('year')} {vehicle.get('make')} {vehicle.get('model')} {vehicle.get('trim')}
Advertised price: ${float(vehicle.get('price', 0)):,.0f}
Customer's latest offer: ${float(offer):,.0f}
Customer's trade: {trade_line}

Recent conversation:
{convo}

Your decision: {decision}
required_price: ${float(required_price):,.0f}

Write the customer-facing message quoting ${float(required_price):,.0f} and no other price."""

    data = await _ask(NEGOTIATE_SYSTEM, prompt)
    if not isinstance(data, dict):
        return None
    msg = str(data.get("message") or "").strip()
    if not msg or len(msg) > 700:
        return None

    # Guard: reject any reply that leaks rule vocabulary despite the system prompt.
    banned = ("hard floor", "discount authority", "approval threshold", "deviation",
              "my rules", "i am an ai", "as an ai", "manager threshold")
    low = msg.lower()
    if any(b in low for b in banned):
        logger.warning("llm: negotiation reply leaked rule vocabulary — using canned text")
        return None
    return msg
