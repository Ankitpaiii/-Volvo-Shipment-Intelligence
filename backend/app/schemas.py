from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ShipmentReference(BaseModel):
    ref_type: str
    ref_value: str


class ShipmentCreate(BaseModel):
    po_number: str
    supplier_name: str
    carrier_name: str
    lane_name: str
    origin_city: str
    dest_city: str
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    part_criticality: str = "STANDARD"
    planned_pickup: datetime
    planned_delivery: datetime
    references: dict[str, str] = Field(default_factory=dict)


class ShipmentUpdate(BaseModel):
    status: str | None = None
    carrier_name: str | None = None
    delay_risk_score: int | None = None
    health_score: int | None = None


class ShipmentSummary(BaseModel):
    shipment_id: str
    po_number: str
    status: str
    supplier_name: str
    carrier_name: str
    lane_name: str
    origin_city: str
    dest_city: str
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    current_lat: float | None
    current_lng: float | None
    part_criticality: str
    planned_pickup: datetime
    planned_delivery: datetime
    delay_risk_score: int
    health_score: int
    predicted_delivery: datetime | None
    eta_confidence: float
    flags: list[str]

    model_config = {"from_attributes": True}


class ShipmentDetail(ShipmentSummary):
    actual_pickup: datetime | None
    actual_delivery: datetime | None
    references: dict[str, str]
    created_at: datetime



class EventCreate(BaseModel):
    event_type: str
    source: str = "manual"
    event_time: datetime | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class EventResponse(BaseModel):
    event_id: str
    shipment_id: str
    event_type: str
    source: str
    event_time: datetime
    received_time: datetime
    payload: dict[str, Any]

    model_config = {"from_attributes": True}


class ETAResponse(BaseModel):
    shipment_id: str
    predicted_delivery: datetime | None
    confidence: float
    delay_risk_score: int
    health_score: int
    last_event: dict[str, Any] | None
    flags: list[str]


class ExceptionResponse(BaseModel):
    exception_id: str
    shipment_id: str
    po_number: str | None = None
    lane_name: str | None = None
    dest_city: str | None = None
    exception_type: str
    severity: str
    root_cause: str | None
    status: str
    business_impact_score: int
    message: str
    recommended_action: str | None
    raised_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class ExceptionAction(BaseModel):
    action: str
    approved_by: str | None = None
    notes: str | None = None


class CopilotRequest(BaseModel):
    question: str
    session_id: str = "default"


class CopilotResponse(BaseModel):
    answer: str
    sources: list[str] = Field(default_factory=list)


class KPIResponse(BaseModel):
    shipments_in_transit: int
    at_risk_count: int
    missing_milestone_count: int
    open_exceptions: int
    avg_health_score: float


class ExtendedKPIResponse(KPIResponse):
    otif_pct: float
    on_time_pickup_pct: float
    avg_dwell_hours: float
    carrier_compliance_pct: float
    critical_at_risk: int   # JIT/JIS shipments at risk
    total_shipments: int


class CarrierScorecard(BaseModel):
    carrier_name: str
    total_shipments: int
    at_risk_count: int
    avg_risk_score: float
    on_time_rate: float
    compliance_rate: float
    p1_exception_count: int


class LanePerformance(BaseModel):
    lane_name: str
    origin_city: str
    dest_city: str
    total_shipments: int
    avg_risk_score: float
    on_time_rate: float
    avg_milestone_completeness: float
    active_exceptions: int


class PaginatedShipments(BaseModel):
    items: list[ShipmentSummary]
    total: int
    page: int
    limit: int
