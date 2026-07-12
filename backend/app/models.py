import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


class ShipmentStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    IN_TRANSIT = "IN_TRANSIT"
    AT_RISK = "AT_RISK"
    DELAYED = "DELAYED"
    DELIVERED = "DELIVERED"
    CLOSED = "CLOSED"


class ExceptionSeverity(str, enum.Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"


class ExceptionStatus(str, enum.Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"


class Shipment(Base):
    __tablename__ = "shipments"

    shipment_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    po_number: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32), default=ShipmentStatus.PLANNED.value, index=True)
    supplier_name: Mapped[str] = mapped_column(String(128))
    carrier_name: Mapped[str] = mapped_column(String(128))
    lane_name: Mapped[str] = mapped_column(String(128), index=True)
    origin_city: Mapped[str] = mapped_column(String(64))
    dest_city: Mapped[str] = mapped_column(String(64))
    origin_lat: Mapped[float] = mapped_column(Float)
    origin_lng: Mapped[float] = mapped_column(Float)
    dest_lat: Mapped[float] = mapped_column(Float)
    dest_lng: Mapped[float] = mapped_column(Float)
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    part_criticality: Mapped[str] = mapped_column(String(16), default="STANDARD")
    planned_pickup: Mapped[datetime] = mapped_column(DateTime)
    planned_delivery: Mapped[datetime] = mapped_column(DateTime, index=True)
    actual_pickup: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    actual_delivery: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delay_risk_score: Mapped[int] = mapped_column(Integer, default=0)
    health_score: Mapped[int] = mapped_column(Integer, default=100)
    predicted_delivery: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    eta_confidence: Mapped[float] = mapped_column(Float, default=0.8)
    flags: Mapped[list] = mapped_column(JSON, default=list)
    references: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    events: Mapped[list["MilestoneEvent"]] = relationship(back_populates="shipment", cascade="all, delete-orphan")
    exceptions: Mapped[list["ExceptionRecord"]] = relationship(back_populates="shipment", cascade="all, delete-orphan")


class MilestoneEvent(Base):
    __tablename__ = "events"

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    shipment_id: Mapped[str] = mapped_column(String(36), ForeignKey("shipments.shipment_id"), index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    source: Mapped[str] = mapped_column(String(64))
    event_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    received_time: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
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
    message: Mapped[str] = mapped_column(Text)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    raised_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    shipment: Mapped["Shipment"] = relationship(back_populates="exceptions")
