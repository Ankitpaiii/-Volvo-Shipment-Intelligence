import enum
import uuid
from datetime import datetime, timedelta

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.database import Base
from app.timeutils import utcnow


def new_uuid() -> str:
    return str(uuid.uuid4())


class ContainerStatus(str, enum.Enum):
    IN_TRANSIT = "IN_TRANSIT"
    AT_GATE = "AT_GATE"
    YARD_STACKED = "YARD_STACKED"
    DEPARTED = "DEPARTED"


class ShipmentStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    IN_TRANSIT = "IN_TRANSIT"
    AT_RISK = "AT_RISK"
    AT_GATE = "AT_GATE"
    DELAYED = "DELAYED"
    DELIVERED = "DELIVERED"
    CLOSED = "CLOSED"


class InspectionStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FLAGGED = "FLAGGED"
    PENDING = "PENDING"


class ExceptionSeverity(str, enum.Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class ExceptionStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class Container(Base):
    __tablename__ = "containers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    container_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    size_teu: Mapped[int] = mapped_column(Integer, default=20)  # 20 or 40
    weight_tier: Mapped[str] = mapped_column(String(16), default="MEDIUM")  # LIGHT, MEDIUM, HEAVY
    hazard: Mapped[bool] = mapped_column(Boolean, default=False)
    destination: Mapped[str] = mapped_column(String(64))
    priority: Mapped[str] = mapped_column(String(16), default="STANDARD")  # STANDARD, HIGH, URGENT
    status: Mapped[str] = mapped_column(String(32), default=ContainerStatus.IN_TRANSIT.value, index=True)
    current_slot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("yard_slots.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    current_slot: Mapped["YardSlot"] = relationship("YardSlot", foreign_keys=[current_slot_id])


class YardSlot(Base):
    __tablename__ = "yard_slots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # e.g., "A-01-01-1"
    block: Mapped[str] = mapped_column(String(8), index=True)      # A, B, C, D
    bay: Mapped[int] = mapped_column(Integer, index=True)          # 1..6
    row: Mapped[int] = mapped_column(Integer, index=True)          # 1..4
    tier: Mapped[int] = mapped_column(Integer, default=1)          # 1..2
    is_occupied: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    container_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("containers.id"), nullable=True)

    container: Mapped["Container"] = relationship("Container", foreign_keys=[container_id])


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    container_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("containers.id"), nullable=True, index=True)
    po_number: Mapped[str] = mapped_column(String(64), index=True, default=lambda: f"PO-{new_uuid()[:8].upper()}")
    status: Mapped[str] = mapped_column(String(32), default=ShipmentStatus.PLANNED.value, index=True)
    supplier_name: Mapped[str] = mapped_column(String(128), default="Volvo Logistics Partner")
    carrier_name: Mapped[str] = mapped_column(String(128), default="Maersk / Volvo Transport")
    lane_name: Mapped[str] = mapped_column(String(128), index=True, default="Inbound -> Volvo Yard")
    origin_city: Mapped[str] = mapped_column(String(64), default="Gothenburg")
    dest_city: Mapped[str] = mapped_column(String(64), default="Gothenburg Yard")
    origin_lat: Mapped[float] = mapped_column(Float, default=57.7089)
    origin_lng: Mapped[float] = mapped_column(Float, default=11.9746)
    dest_lat: Mapped[float] = mapped_column(Float, default=57.7089)
    dest_lng: Mapped[float] = mapped_column(Float, default=11.9746)
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    part_criticality: Mapped[str] = mapped_column(String(16), default="STANDARD")
    planned_pickup: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    planned_delivery: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, default=lambda: utcnow() + timedelta(days=2))
    actual_pickup: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delay_risk_score: Mapped[int] = mapped_column(Integer, default=0)
    health_score: Mapped[int] = mapped_column(Integer, default=100)
    predicted_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    eta_confidence: Mapped[float] = mapped_column(Float, default=0.8)
    flags: Mapped[list] = mapped_column(JSON, default=list)
    references: Mapped[dict] = mapped_column(JSON, default=dict)

    # ML & Yard transit metrics
    distance: Mapped[float] = mapped_column(Float, default=500.0)
    current_progress: Mapped[float] = mapped_column(Float, default=0.0)
    current_speed: Mapped[float] = mapped_column(Float, default=60.0)
    dwell_time: Mapped[float] = mapped_column(Float, default=0.0)
    yard_congestion: Mapped[float] = mapped_column(Float, default=0.5)
    historical_delay: Mapped[float] = mapped_column(Float, default=0.0)
    predicted_delay: Mapped[float] = mapped_column(Float, default=0.0)
    predicted_eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    id = synonym("shipment_id")
    origin = synonym("origin_city")
    destination = synonym("dest_city")


    # Relationships
    events: Mapped[list["MilestoneEvent"]] = relationship(back_populates="shipment", cascade="all, delete-orphan")
    exceptions: Mapped[list["ExceptionRecord"]] = relationship(back_populates="shipment", cascade="all, delete-orphan")
    container: Mapped["Container"] = relationship("Container", foreign_keys=[container_id])
    predictions: Mapped[list["MLPredictionLog"]] = relationship(back_populates="shipment", cascade="all, delete-orphan")


class MilestoneEvent(Base):
    __tablename__ = "events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    shipment_id: Mapped[str] = mapped_column(String(36), ForeignKey("shipments.shipment_id"), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    source: Mapped[str] = mapped_column(String(64))
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

    shipment: Mapped["Shipment"] = relationship(back_populates="events")


class ExceptionRecord(Base):
    __tablename__ = "exceptions"

    exception_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    shipment_id: Mapped[str] = mapped_column(String(36), ForeignKey("shipments.shipment_id"), index=True)
    exception_type: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(8), default=ExceptionSeverity.P2.value)
    root_cause: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default=ExceptionStatus.OPEN.value, index=True)
    business_impact_score: Mapped[int] = mapped_column(Integer, default=50)
    message: Mapped[Text] = mapped_column(Text)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    shipment: Mapped["Shipment"] = relationship(back_populates="exceptions")


class GateInspection(Base):
    __tablename__ = "gate_inspections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    image_path: Mapped[str] = mapped_column(String(256))
    raw_ocr_text: Mapped[str] = mapped_column(String(128))
    validated_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(16), default=InspectionStatus.SUCCESS.value)
    detected_box: Mapped[list] = mapped_column(JSON, default=list)  # [ymin, xmin, ymax, xmax]


class AuditLog(Base):
    """Append-only activity trail (P5.1): who did what, to which entity, when."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    actor: Mapped[str] = mapped_column(String(128), default="anonymous", index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(32), index=True)
    entity_id: Mapped[str] = mapped_column(String(64), index=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)


class MLPredictionLog(Base):
    __tablename__ = "ml_prediction_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    shipment_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("shipments.shipment_id"), nullable=True, index=True)
    model_name: Mapped[str] = mapped_column(String(64), index=True)
    predicted_delay_minutes: Mapped[float] = mapped_column(Float)
    actual_delay_minutes: Mapped[float | None] = mapped_column(Float, nullable=True)
    features_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    shipment: Mapped["Shipment"] = relationship(back_populates="predictions")
