from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.constants import CRITICALITY_WEIGHT, MILESTONE_SLA_HOURS, MILESTONE_TEMPLATE
from app.models import ExceptionRecord, ExceptionSeverity, ExceptionStatus, MilestoneEvent, Shipment, ShipmentStatus


def _elapsed_fraction(shipment: Shipment, now: datetime) -> float:
    total = (shipment.planned_delivery - shipment.planned_pickup).total_seconds()
    if total <= 0:
        return 1.0
    elapsed = (now - shipment.planned_pickup).total_seconds()
    return max(0.0, min(1.0, elapsed / total))


def _milestone_completeness(events: list[MilestoneEvent]) -> float:
    completed = {e.event_type for e in events}
    required = set(MILESTONE_TEMPLATE)
    if not required:
        return 1.0
    return len(completed & required) / len(required)


def _gps_stale_minutes(events: list[MilestoneEvent], now: datetime) -> float:
    """Returns how many minutes since the last GPS ping, or 0 if recent."""
    last_gps: Optional[datetime] = None
    for e in sorted(events, key=lambda x: x.event_time, reverse=True):
        if e.event_type == "GPS_PING":
            last_gps = e.event_time
            break
    if not last_gps:
        return 0.0
    return (now - last_gps).total_seconds() / 60


def _count_consecutive_gps_gaps(events: list[MilestoneEvent]) -> int:
    """Count consecutive GPS_PING events that have gaps > 30 min (sign of device issues)."""
    gps_events = sorted([e for e in events if e.event_type == "GPS_PING"], key=lambda x: x.event_time)
    gaps = 0
    consecutive = 0
    for i in range(1, len(gps_events)):
        diff = (gps_events[i].event_time - gps_events[i - 1].event_time).total_seconds() / 60
        if diff > 30:
            consecutive += 1
            gaps = max(gaps, consecutive)
        else:
            consecutive = 0
    return gaps


def _sla_breached_milestones(shipment: Shipment, events: list[MilestoneEvent], now: datetime) -> list[str]:
    """Return list of milestone types that have breached their SLA window."""
    completed = {e.event_type for e in events}
    breached = []
    for milestone, sla_hours in MILESTONE_SLA_HOURS.items():
        if milestone not in completed:
            # Only check if we're past the expected time for this milestone
            expected_after = shipment.planned_pickup + timedelta(hours=sla_hours)
            if now > expected_after and shipment.status not in (
                ShipmentStatus.DELIVERED.value,
                ShipmentStatus.CLOSED.value,
            ):
                breached.append(milestone)
    return breached


def compute_dwell_time_hours(shipment: Shipment, events: list[MilestoneEvent]) -> Optional[float]:
    """Compute dwell time (gate arrival -> unload complete) in hours for delivered shipments."""
    gate_time: Optional[datetime] = None
    unload_time: Optional[datetime] = None
    for e in events:
        if e.event_type == "GATE_ARRIVAL" and gate_time is None:
            gate_time = e.event_time
        if e.event_type == "UNLOAD_COMPLETE" and unload_time is None:
            unload_time = e.event_time
    if gate_time and unload_time and unload_time > gate_time:
        return (unload_time - gate_time).total_seconds() / 3600
    return None


def compute_risk_and_health(
    shipment: Shipment,
    events: list[MilestoneEvent],
    now: Optional[datetime] = None,
) -> tuple[int, int, list[str], Optional[datetime], float]:
    now = now or datetime.utcnow()
    flags: list[str] = []

    elapsed_frac = _elapsed_fraction(shipment, now)
    completeness = _milestone_completeness(events)
    crit_weight = CRITICALITY_WEIGHT.get(shipment.part_criticality, 1.0)

    risk = 0

    # === Milestone Progress vs. Elapsed Time ===
    if elapsed_frac > 0.6 and completeness < 0.5:
        risk += int(40 * crit_weight)
        flags.append("low_milestone_progress")
    if elapsed_frac > 0.8 and completeness < 0.7:
        risk += int(25 * crit_weight)
        flags.append("behind_schedule")

    # === GPS Staleness ===
    stale_mins = _gps_stale_minutes(events, now)
    if stale_mins > 90:
        risk += 30
        flags.append("gps_stale_90min")
    elif stale_mins > 45:
        risk += 20
        flags.append("gps_stale_45min")

    # === Consecutive GPS Gaps (device issue) ===
    consecutive_gaps = _count_consecutive_gps_gaps(events)
    if consecutive_gaps >= 3:
        risk += 15
        flags.append("gps_device_issue")

    # === Past Planned Delivery ===
    if now > shipment.planned_delivery and shipment.status not in (
        ShipmentStatus.DELIVERED.value,
        ShipmentStatus.CLOSED.value,
    ):
        overdue_hours = (now - shipment.planned_delivery).total_seconds() / 3600
        risk += min(40, int(20 + overdue_hours * 2))
        flags.append("past_planned_delivery")

    # === SLA Breach Per Milestone ===
    breached = _sla_breached_milestones(shipment, events, now)
    if breached:
        risk += min(20, len(breached) * 5)
        flags.append(f"sla_breached:{','.join(breached[:3])}")

    # === Carrier Compliance Penalty (no pickup confirmation) ===
    event_types = {e.event_type for e in events}
    if "BOOKING_CONFIRMED" in event_types and "PICKUP_COMPLETED" not in event_types:
        pickup_sla_deadline = shipment.planned_pickup + timedelta(hours=MILESTONE_SLA_HOURS.get("PICKUP_COMPLETED", 2))
        if now > pickup_sla_deadline:
            risk += int(15 * crit_weight)
            flags.append("carrier_non_compliant")

    risk = min(100, risk)
    health = max(0, 100 - risk)

    # === Predicted ETA ===
    remaining = max(0.0, 1.0 - elapsed_frac)
    transit_hours = (shipment.planned_delivery - shipment.planned_pickup).total_seconds() / 3600
    delay_factor = 1.0 + (risk / 150.0)  # more moderate delay factor
    predicted = now + timedelta(hours=transit_hours * remaining * delay_factor)
    confidence = max(0.35, 0.92 - (risk / 180.0))

    return risk, health, flags, predicted, confidence


def update_shipment_scores(db: Session, shipment: Shipment) -> None:
    events = db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == shipment.shipment_id).all()
    risk, health, flags, predicted, confidence = compute_risk_and_health(shipment, events)
    shipment.delay_risk_score = risk
    shipment.health_score = health
    shipment.flags = flags
    shipment.predicted_delivery = predicted
    shipment.eta_confidence = confidence

    if shipment.actual_delivery:
        shipment.status = ShipmentStatus.DELIVERED.value
    elif not shipment.actual_pickup and not shipment.current_lat:
        shipment.status = ShipmentStatus.PLANNED.value
    elif risk >= 70:
        shipment.status = ShipmentStatus.AT_RISK.value
    elif risk >= 40 and shipment.status != ShipmentStatus.DELAYED.value:
        shipment.status = ShipmentStatus.IN_TRANSIT.value
    elif risk < 40 and shipment.status != ShipmentStatus.DELAYED.value:
        shipment.status = ShipmentStatus.IN_TRANSIT.value


def _business_impact(shipment: Shipment, severity: str) -> int:
    weight = CRITICALITY_WEIGHT.get(shipment.part_criticality, 1)
    base = {"P1": 90, "P2": 60, "P3": 30}.get(severity, 50)
    return int(min(100, base * weight + shipment.delay_risk_score * 0.3))


def _existing_open(db: Session, shipment_id: str, exception_type: str) -> Optional[ExceptionRecord]:
    return (
        db.query(ExceptionRecord)
        .filter(
            ExceptionRecord.shipment_id == shipment_id,
            ExceptionRecord.exception_type == exception_type,
            ExceptionRecord.status.in_([ExceptionStatus.OPEN.value, ExceptionStatus.ACKNOWLEDGED.value]),
        )
        .first()
    )


def _raise_exception(
    db: Session,
    shipment: Shipment,
    exception_type: str,
    severity: str,
    message: str,
    root_cause: str,
    recommended_action: str,
) -> Optional[ExceptionRecord]:
    if _existing_open(db, shipment.shipment_id, exception_type):
        return None

    record = ExceptionRecord(
        shipment_id=shipment.shipment_id,
        exception_type=exception_type,
        severity=severity,
        root_cause=root_cause,
        message=message,
        recommended_action=recommended_action,
        business_impact_score=_business_impact(shipment, severity),
    )
    db.add(record)
    return record


def detect_gaps(db: Session) -> list[ExceptionRecord]:
    now = datetime.utcnow()
    created: list[ExceptionRecord] = []
    shipments = db.query(Shipment).filter(
        Shipment.status.notin_([ShipmentStatus.CLOSED.value, ShipmentStatus.DELIVERED.value])
    ).all()

    for shipment in shipments:
        events = db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == shipment.shipment_id).all()
        event_types = {e.event_type for e in events}
        update_shipment_scores(db, shipment)

        # === MISSING ASN ===
        if "ASN_CREATED" not in event_types and now > shipment.planned_pickup - timedelta(hours=4):
            severity = ExceptionSeverity.P1.value if shipment.part_criticality in ("JIT", "JIS") else ExceptionSeverity.P2.value
            rec = _raise_exception(
                db, shipment,
                "MISSING_ASN", severity,
                f"ASN not received for PO {shipment.po_number} (supplier: {shipment.supplier_name})",
                "supplier_delay",
                "Contact supplier; request ASN via portal or email. Escalate to procurement if no response in 2h.",
            )
            if rec:
                created.append(rec)

        # === MISSING PICKUP ===
        if "PICKUP_COMPLETED" not in event_types and now > shipment.planned_pickup + timedelta(hours=MILESTONE_SLA_HOURS["PICKUP_COMPLETED"]):
            severity = ExceptionSeverity.P1.value if shipment.part_criticality in ("JIT", "JIS") else ExceptionSeverity.P2.value
            rec = _raise_exception(
                db, shipment,
                "MISSING_PICKUP", severity,
                f"Pickup not confirmed for PO {shipment.po_number} — carrier {shipment.carrier_name} SLA breached",
                "carrier_non_compliance",
                "Call carrier dispatcher immediately. Request driver app geofence confirmation or manual ping.",
            )
            if rec:
                created.append(rec)

        # === GPS STALE (45 min) ===
        if shipment.flags and any(f in ("gps_stale_45min", "gps_stale_90min") for f in shipment.flags):
            stale_flag = "gps_stale_90min" if "gps_stale_90min" in shipment.flags else "gps_stale_45min"
            exc_type = "GPS_OFFLINE_CRITICAL" if stale_flag == "gps_stale_90min" else "GPS_OFFLINE"
            severity = ExceptionSeverity.P1.value if stale_flag == "gps_stale_90min" else ExceptionSeverity.P2.value
            rec = _raise_exception(
                db, shipment,
                exc_type, severity,
                f"GPS signal stale for PO {shipment.po_number} - last known: {shipment.origin_city}->{shipment.dest_city}",
                "gps_offline",
                "Request manual driver ping via SMS. Interpolate ETA from last known position + expected speed.",
            )
            if rec:
                created.append(rec)

        # === HIGH DELAY RISK ===
        if shipment.delay_risk_score >= 70:
            severity = ExceptionSeverity.P1.value if shipment.part_criticality in ("JIT", "JIS") else ExceptionSeverity.P2.value
            rec = _raise_exception(
                db, shipment,
                "DELAY_RISK_HIGH", severity,
                f"High delay risk ({shipment.delay_risk_score}%) — {shipment.part_criticality} shipment to {shipment.dest_city}",
                "transit_delay",
                "Consider air expedite or alternate carrier rebooking. Alert plant MC for JIT slot re-planning.",
            )
            if rec:
                created.append(rec)

        # === CARRIER NON-COMPLIANCE ===
        if shipment.flags and "carrier_non_compliant" in shipment.flags:
            rec = _raise_exception(
                db, shipment,
                "CARRIER_NON_COMPLIANT", ExceptionSeverity.P2.value,
                f"Carrier {shipment.carrier_name} has not confirmed pickup for PO {shipment.po_number} past SLA",
                "carrier_non_compliance",
                "Escalate to carrier account manager. Log compliance incident for scorecard update.",
            )
            if rec:
                created.append(rec)

        # === SLA BREACH (generic) ===
        if shipment.flags:
            sla_flags = [f for f in shipment.flags if f.startswith("sla_breached:")]
            if sla_flags:
                breached_milestones = sla_flags[0].split(":", 1)[1] if sla_flags else ""
                rec = _raise_exception(
                    db, shipment,
                    "MILESTONE_SLA_BREACH", ExceptionSeverity.P2.value,
                    f"Milestone SLA breached for PO {shipment.po_number}: {breached_milestones}",
                    "milestone_gap",
                    "Review milestone history and contact responsible party for confirmation.",
                )
                if rec:
                    created.append(rec)

    db.commit()
    return created
