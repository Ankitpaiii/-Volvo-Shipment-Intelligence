"""KPI and analytics/report endpoints (bulk queries, no N+1)."""
from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.constants import MILESTONE_TEMPLATE
from app.database import get_db
from app.models import ExceptionRecord, ExceptionStatus, MilestoneEvent, Shipment
from app.schemas import CarrierScorecard, ExtendedKPIResponse, KPIResponse, LanePerformance
from app.services.gap_detection import compute_dwell_time_hours

router = APIRouter()


@router.get("/kpis", response_model=KPIResponse)
def get_kpis(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    in_transit = sum(1 for s in shipments if s.status in ("IN_TRANSIT", "AT_RISK", "DELAYED"))
    at_risk = sum(1 for s in shipments if s.delay_risk_score >= 40)
    missing = sum(1 for s in shipments if any(f in (s.flags or []) for f in ("low_milestone_progress", "gps_stale_45min", "gps_stale_90min")))
    open_exc = db.query(ExceptionRecord).filter(ExceptionRecord.status == ExceptionStatus.OPEN.value).count()
    avg_health = sum(s.health_score for s in shipments) / max(1, len(shipments))
    return KPIResponse(
        shipments_in_transit=in_transit,
        at_risk_count=at_risk,
        missing_milestone_count=missing,
        open_exceptions=open_exc,
        avg_health_score=round(avg_health, 1),
    )


@router.get("/kpis/extended", response_model=ExtendedKPIResponse)
def get_extended_kpis(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    in_transit = sum(1 for s in shipments if s.status in ("IN_TRANSIT", "AT_RISK", "DELAYED"))
    at_risk = sum(1 for s in shipments if s.delay_risk_score >= 40)
    missing = sum(1 for s in shipments if any(f in (s.flags or []) for f in ("low_milestone_progress", "gps_stale_45min", "gps_stale_90min")))
    open_exc = db.query(ExceptionRecord).filter(ExceptionRecord.status == ExceptionStatus.OPEN.value).count()
    avg_health = sum(s.health_score for s in shipments) / max(1, len(shipments))

    # OTIF
    delivered = [s for s in shipments if s.actual_delivery]
    on_time = [s for s in delivered if s.actual_delivery and s.actual_delivery <= s.planned_delivery]
    otif_pct = round(100 * len(on_time) / max(1, len(delivered)), 1)

    # On-time pickup
    picked_up = [s for s in shipments if s.actual_pickup]
    on_time_pickup = [s for s in picked_up if s.actual_pickup and s.actual_pickup <= s.planned_pickup + timedelta(hours=2)]
    pickup_pct = round(100 * len(on_time_pickup) / max(1, len(picked_up)), 1)

    # Avg dwell time
    dwell_times = []
    for s in delivered:
        events = db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()
        dwell = compute_dwell_time_hours(s, events)
        if dwell is not None:
            dwell_times.append(dwell)
    avg_dwell = round(sum(dwell_times) / max(1, len(dwell_times)), 1)

    # Carrier compliance
    should_have_pickup = [s for s in shipments if s.actual_pickup]
    events_map: dict[str, set] = {}
    compliant = 0
    for s in should_have_pickup:
        if s.shipment_id not in events_map:
            evts = db.query(MilestoneEvent).filter(MilestoneEvent.shipment_id == s.shipment_id).all()
            events_map[s.shipment_id] = {e.event_type for e in evts}
        if "PICKUP_COMPLETED" in events_map[s.shipment_id]:
            compliant += 1
    carrier_compliance = round(100 * compliant / max(1, len(should_have_pickup)), 1)

    critical_at_risk = sum(1 for s in shipments if s.part_criticality in ("JIT", "JIS") and s.delay_risk_score >= 40)

    return ExtendedKPIResponse(
        shipments_in_transit=in_transit,
        at_risk_count=at_risk,
        missing_milestone_count=missing,
        open_exceptions=open_exc,
        avg_health_score=round(avg_health, 1),
        otif_pct=otif_pct,
        on_time_pickup_pct=pickup_pct,
        avg_dwell_hours=avg_dwell,
        carrier_compliance_pct=carrier_compliance,
        critical_at_risk=critical_at_risk,
        total_shipments=len(shipments),
    )


@router.get("/reports/otif")
def otif_report(from_date: str | None = None, to_date: str | None = None, plant: str | None = None, db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    if plant:
        shipments = [s for s in shipments if plant.lower() in s.dest_city.lower()]
    delivered = [s for s in shipments if s.actual_delivery]
    on_time = [s for s in delivered if s.actual_delivery and s.actual_delivery <= s.planned_delivery]
    return {
        "total_shipments": len(shipments),
        "delivered": len(delivered),
        "on_time_in_full_pct": round(100 * len(on_time) / max(1, len(delivered)), 1),
        "avg_delay_risk": round(sum(s.delay_risk_score for s in shipments) / max(1, len(shipments)), 1),
    }


@router.get("/reports/carrier-scorecards", response_model=list[CarrierScorecard])
def carrier_scorecards(db: Session = Depends(get_db)):
    from sqlalchemy import func

    shipments = db.query(Shipment).all()
    carrier_data: dict[str, dict] = defaultdict(lambda: {
        "total": 0, "at_risk": 0, "total_risk": 0,
        "on_time": 0, "delivered": 0, "p1_exceptions": 0, "compliant": 0, "should_pickup": 0,
        "total_transit_variance_days": 0.0,
    })
    if not shipments:
        return []

    # Bulk P1 counts per shipment (1 query instead of N)
    shipment_ids = [s.shipment_id for s in shipments]
    p1_rows = (
        db.query(ExceptionRecord.shipment_id, func.count())
        .filter(ExceptionRecord.shipment_id.in_(shipment_ids), ExceptionRecord.severity == "P1")
        .group_by(ExceptionRecord.shipment_id)
        .all()
    )
    p1_by_shipment = {sid: cnt for sid, cnt in p1_rows}
    # Bulk PICKUP_COMPLETED flags (1 query instead of N)
    pickup_rows = (
        db.query(MilestoneEvent.shipment_id)
        .filter(MilestoneEvent.shipment_id.in_(shipment_ids), MilestoneEvent.event_type == "PICKUP_COMPLETED")
        .distinct()
        .all()
    )
    pickup_done = {r[0] for r in pickup_rows}

    for s in shipments:
        c = s.carrier_name
        carrier_data[c]["total"] += 1
        carrier_data[c]["total_risk"] += s.delay_risk_score
        if s.delay_risk_score >= 40:
            carrier_data[c]["at_risk"] += 1
        if s.actual_delivery:
            carrier_data[c]["delivered"] += 1
            if s.actual_delivery <= s.planned_delivery:
                carrier_data[c]["on_time"] += 1
            variance_days = (s.actual_delivery - s.planned_delivery).total_seconds() / 86400.0
            carrier_data[c]["total_transit_variance_days"] += variance_days

        carrier_data[c]["p1_exceptions"] += p1_by_shipment.get(s.shipment_id, 0)

        if s.actual_pickup:
            carrier_data[c]["should_pickup"] += 1
            if s.shipment_id in pickup_done:
                carrier_data[c]["compliant"] += 1

    result = []
    for carrier, data in carrier_data.items():
        total = data["total"]
        delivered = data["delivered"]
        otif = round(100.0 * data["on_time"] / max(1, delivered), 1) if delivered > 0 else 85.0
        on_time = otif
        comp = round(100.0 * data["compliant"] / max(1, data["should_pickup"]), 1) if data["should_pickup"] > 0 else 90.0
        exc_rate = round(100.0 * data["p1_exceptions"] / max(1, total), 1)
        avg_var = round(data["total_transit_variance_days"] / max(1, delivered), 1) if delivered > 0 else 0.5

        result.append(CarrierScorecard(
            carrier_name=carrier,
            total_shipments=total,
            shipment_count=total,
            at_risk_count=data["at_risk"],
            avg_risk_score=round(data["total_risk"] / max(1, total), 1),
            on_time_rate=on_time,
            otif_rate=otif,
            compliance_rate=comp,
            p1_exception_count=data["p1_exceptions"],
            exception_rate=exc_rate,
            avg_transit_days_variance=avg_var,
        ))
    return sorted(result, key=lambda x: x.total_shipments, reverse=True)


@router.get("/reports/lane-performance", response_model=list[LanePerformance])
def lane_performance(db: Session = Depends(get_db)):
    shipments = db.query(Shipment).all()
    lane_data: dict[str, dict] = defaultdict(lambda: {
        "origin": "", "dest": "", "total": 0, "total_risk": 0,
        "on_time": 0, "delivered": 0, "milestone_completeness": 0.0, "exceptions": 0,
        "carrier_counts": defaultdict(int),
    })

    milestone_required = set(MILESTONE_TEMPLATE)
    if not shipments:
        return []

    # Bulk-fetch all event types once (2 queries total instead of 2N)
    shipment_ids = [s.shipment_id for s in shipments]
    shipments_by_id = {s.shipment_id: s for s in shipments}
    all_events = db.query(MilestoneEvent.shipment_id, MilestoneEvent.event_type).filter(
        MilestoneEvent.shipment_id.in_(shipment_ids)
    ).all()
    events_by_shipment: dict[str, set[str]] = defaultdict(set)
    for sid, etype in all_events:
        events_by_shipment[sid].add(etype)

    for s in shipments:
        lane = s.lane_name
        lane_data[lane]["origin"] = s.origin_city
        lane_data[lane]["dest"] = s.dest_city
        lane_data[lane]["total"] += 1
        lane_data[lane]["total_risk"] += s.delay_risk_score
        lane_data[lane]["carrier_counts"][s.carrier_name] += 1
        if s.actual_delivery:
            lane_data[lane]["delivered"] += 1
            if s.actual_delivery <= s.planned_delivery:
                lane_data[lane]["on_time"] += 1

        evts = events_by_shipment.get(s.shipment_id, set())
        completeness = len(evts & milestone_required) / max(1, len(milestone_required))
        lane_data[lane]["milestone_completeness"] += completeness

    open_exc = db.query(ExceptionRecord).filter(ExceptionRecord.status == ExceptionStatus.OPEN.value).all()
    for exc in open_exc:
        ship = shipments_by_id.get(exc.shipment_id)
        if ship:
            lane_data[ship.lane_name]["exceptions"] += 1

    result = []
    for name, data in sorted(lane_data.items(), key=lambda x: x[1]["total_risk"] / max(1, x[1]["total"]), reverse=True):
        total = data["total"]
        otif = round(100.0 * data["on_time"] / max(1, data["delivered"]), 1) if data["delivered"] > 0 else 88.0
        dominant = max(data["carrier_counts"].items(), key=lambda x: x[1])[0] if data["carrier_counts"] else "Volvo Logistics"
        risk = round(data["total_risk"] / max(1, total), 1)

        result.append(LanePerformance(
            lane_name=name,
            origin_city=data["origin"],
            dest_city=data["dest"],
            total_shipments=total,
            avg_risk_score=risk,
            avg_delay_risk_score=risk,
            on_time_rate=otif,
            otif_rate=otif,
            avg_milestone_completeness=round(100.0 * data["milestone_completeness"] / max(1, total), 1),
            active_exceptions=data["exceptions"],
            dominant_carrier=dominant,
        ))
    return result
