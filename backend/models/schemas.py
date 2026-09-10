import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


def new_id() -> str:
    return str(uuid.uuid4())


class Vehicle(BaseModel):
    id: str = Field(default_factory=new_id)
    vin: str
    year: int
    make: str
    model: str
    trim: str
    price: float
    msrp: float
    incentives: float = 0.0
    mileage: int
    distance_mi: float
    features: list[str] = []
    image: str
    exterior: str = ""
    drivetrain: str = ""
    engine: str = ""
    dealer_name: str = ""
    dealer_address: str = ""


class VehicleMatch(Vehicle):
    match_pct: int = 90


class SearchResponse(BaseModel):
    query: str
    interpreted_as: str
    interpretation_note: str
    results: list[VehicleMatch]


class Trade(BaseModel):
    vin: str = ""
    year: int
    make: str
    model: str
    mileage: int
    payoff: float = 0.0
    condition: str = "clean"
    photos: list[str] = []
    estimated_low: float = 0.0
    estimated_high: float = 0.0
    estimated_value: float = 0.0


class Message(BaseModel):
    id: str = Field(default_factory=new_id)
    sender: Literal["customer", "dealer", "system"]
    text: str
    amount: Optional[float] = None
    created_at: datetime


class Appointment(BaseModel):
    date: str
    time: str
    type: str = "Test Drive & Delivery"
    location: str = ""


class Deal(BaseModel):
    id: str = Field(default_factory=new_id)
    vehicle: Vehicle
    customer_name: str = "Alex Rivera"
    status: str = "building"
    selling_price: float
    down_payment: float = 0.0
    trade: Optional[Trade] = None
    breakdown: dict[str, Any]
    latest_offer: Optional[float] = None
    latest_counter: Optional[float] = None
    agreed_price: Optional[float] = None
    taken_over: bool = False
    messages: list[Message] = []
    appointment: Optional[Appointment] = None
    created_at: datetime


class DealCreate(BaseModel):
    vehicle_id: str
    customer_name: str = "Alex Rivera"


class TradeInput(BaseModel):
    vin: str = ""
    year: int
    make: str
    model: str
    mileage: int
    payoff: float = 0.0
    condition: str = "clean"
    photos: list[str] = []


class OfferInput(BaseModel):
    amount: float
    down_payment: float = 0.0


class DealerActionInput(BaseModel):
    action: Literal["accept", "counter", "decline", "takeover"]
    amount: Optional[float] = None
    note: str = ""


class AppointmentInput(BaseModel):
    date: str
    time: str
    type: str = "Test Drive & Delivery"


class DealerRules(BaseModel):
    id: str = "dealership"
    dealer_name: str = "Summit Motors Group"
    ai_discount_authority: float = 2500.0
    manager_threshold: float = 4000.0
    hard_floor: Optional[float] = None
    max_deviation_pct: float = 18.0


class DealerRulesInput(BaseModel):
    ai_discount_authority: float
    manager_threshold: float
    hard_floor: Optional[float] = None
    max_deviation_pct: float


class VinOverride(BaseModel):
    vin: str
    label: str = ""
    ai_discount_authority: Optional[float] = None
    manager_threshold: Optional[float] = None
    hard_floor: Optional[float] = None
    max_deviation_pct: Optional[float] = None


class GarageVehicle(BaseModel):
    id: str = Field(default_factory=new_id)
    vin: str
    year: int
    make: str
    model: str
    trim: str = ""
    image: str = ""
    mileage: int
    payoff: float = 0.0
    estimated_value: float
    equity: float
    source: str = "purchase"
    added_at: datetime


class MileageInput(BaseModel):
    mileage: int
