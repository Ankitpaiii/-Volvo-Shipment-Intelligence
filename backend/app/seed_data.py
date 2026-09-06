"""
Deterministic Synthetic Data Seeding for Volvo Shipment Intelligence & Container Yard ML.
Seeds Volvo Lanes, Milestones, GPS Pings, Exceptions, Yard Slots (Blocks A-D), Containers,
and Gate Inspection records.
"""
from datetime import datetime, timedelta
import logging
import random
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.timeutils import utcnow

from app.models import (
    Container,
    ContainerStatus,
    ExceptionRecord,
    GateInspection,
    InspectionStatus,
    MilestoneEvent,
    MLPredictionLog,
    Shipment,
    ShipmentStatus,
    YardSlot,
)
from app.ml.delay_predictor import delay_predictor

RANDOM_SEED = 42

LANES = [
    {
        "lane_name": "Bengaluru -> Gothenburg",
        "origin_city": "Bengaluru",
        "dest_city": "Gothenburg",
        "origin_lat": 12.9716, "origin_lng": 77.5946,
        "dest_lat": 57.7089, "dest_lng": 11.9746,
        "mode": "air",
    },
    {
        "lane_name": "Chennai -> Gothenburg",
        "origin_city": "Chennai",
        "dest_city": "Gothenburg",
        "origin_lat": 13.0827, "origin_lng": 80.2707,
        "dest_lat": 57.7089, "dest_lng": 11.9746,
        "mode": "sea",
    },
    {
        "lane_name": "Pune -> Brussels DC",
        "origin_city": "Pune",
        "dest_city": "Brussels",
        "origin_lat": 18.5204, "origin_lng": 73.8567,
        "dest_lat": 50.8503, "dest_lng": 4.3517,
        "mode": "air",
    },
    {
        "lane_name": "Hosur -> Chennai Plant",
        "origin_city": "Hosur",
        "dest_city": "Chennai",
        "origin_lat": 12.7409, "origin_lng": 77.8253,
        "dest_lat": 13.0827, "dest_lng": 80.2707,
        "mode": "road",
    },
    {
        "lane_name": "Mumbai -> Gothenburg",
        "origin_city": "Mumbai",
        "dest_city": "Gothenburg",
        "origin_lat": 19.0760, "origin_lng": 72.8777,
        "dest_lat": 57.7089, "dest_lng": 11.9746,
        "mode": "sea",
    },
    {
        "lane_name": "Delhi -> Gothenburg",
        "origin_city": "Delhi",
        "dest_city": "Gothenburg",
        "origin_lat": 28.6139, "origin_lng": 77.2090,
        "dest_lat": 57.7089, "dest_lng": 11.9746,
        "mode": "air",
    },
    {
        "lane_name": "Pune -> Amsterdam DC",
        "origin_city": "Pune",
        "dest_city": "Amsterdam",
        "origin_lat": 18.5204, "origin_lng": 73.8567,
        "dest_lat": 52.3676, "dest_lng": 4.9041,
        "mode": "air",
    },
    {
        "lane_name": "Hyderabad -> Frankfurt",
        "origin_city": "Hyderabad",
        "dest_city": "Frankfurt",
        "origin_lat": 17.3850, "origin_lng": 78.4867,
        "dest_lat": 50.1109, "dest_lng": 8.6821,
        "mode": "air",
    },
]

CARRIERS = [
    "Maersk Line", "DHL Global Forwarding", "Kuehne+Nagel",
    "DSV Panalpina", "DB Schenker", "Volvo In-House Logistics"
]

SUPPLIERS = [
    "Bharat Forge Ltd", "Sundram Fasteners", "TVS Motors Component Div",
    "Bosch India Ltd", "Minda Corporation", "Tata AutoComp Systems",
    "Brakes India Ltd", "Lucas TVS"
]

CRITICALITY_LEVELS = ["JIT", "JIS", "STANDARD"]
CRITICALITY_WEIGHTS = [0.20, 0.15, 0.65]

MILESTONES_ORDER = [
    "TRANSPORT_ORDER_CREATED",
    "CARRIER_CONFIRMED",
    "PICKUP_SCHEDULED",
    "PICKUP_COMPLETED",
    "DEPARTED_ORIGIN",
    "ARRIVED_TRANSIT_HUB",
    "CUSTOMS_CLEARED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
]


def seed_volvo_tracking(db: Session):
    random.seed(RANDOM_SEED)
    now = utcnow()
    shipments = []

    statuses = (
        ["IN_TRANSIT"] * 12 +
        ["AT_RISK"] * 6 +
        ["DELAYED"] * 3 +
        ["DELIVERED"] * 4 +
        ["PLANNED"] * 3
    )

    for i, status in enumerate(statuses):
        lane = LANES[i % len(LANES)]
        carrier = CARRIERS[i % len(CARRIERS)]
        supplier = SUPPLIERS[i % len(SUPPLIERS)]
        crit = random.choices(CRITICALITY_LEVELS, weights=CRITICALITY_WEIGHTS)[0]

        pickup_offset_hours = random.randint(12, 96)
        planned_pickup = now - timedelta(hours=pickup_offset_hours)
        transit_duration_hours = random.randint(36, 120)
        planned_delivery = planned_pickup + timedelta(hours=transit_duration_hours)

        actual_pickup = None
        actual_delivery = None
        predicted_delivery = None
        delay_risk = 0
        health = 100
        flags = []

        # Coordinate interpolation
        t = min(1.0, max(0.0, pickup_offset_hours / max(1, transit_duration_hours)))
        current_lat = lane["origin_lat"] + t * (lane["dest_lat"] - lane["origin_lat"])
        current_lng = lane["origin_lng"] + t * (lane["dest_lng"] - lane["origin_lng"])

        if status == "IN_TRANSIT":
            actual_pickup = planned_pickup + timedelta(minutes=random.randint(-30, 60))
            predicted_delivery = planned_delivery + timedelta(minutes=random.randint(-60, 90))
            delay_risk = random.randint(5, 30)
            health = random.randint(75, 98)
        elif status == "AT_RISK":
            actual_pickup = planned_pickup + timedelta(minutes=random.randint(30, 180))
            predicted_delay_hours = random.randint(3, 8)
            predicted_delivery = planned_delivery + timedelta(hours=predicted_delay_hours)
            delay_risk = random.randint(45, 75)
            health = random.randint(35, 65)
            flags = random.sample(["low_milestone_progress", "gps_stale_45min", "dwell_high"], k=random.randint(1, 2))
        elif status == "DELAYED":
            actual_pickup = planned_pickup + timedelta(hours=random.randint(2, 6))
            predicted_delay_hours = random.randint(8, 24)
            predicted_delivery = planned_delivery + timedelta(hours=predicted_delay_hours)
            delay_risk = random.randint(75, 98)
            health = random.randint(10, 35)
            flags = ["delay_over_4h", "gps_stale_90min"]
        elif status == "DELIVERED":
            actual_pickup = planned_pickup
            delivered_delay = random.randint(-60, 120)
            actual_delivery = planned_delivery + timedelta(minutes=delivered_delay)
            predicted_delivery = actual_delivery
            delay_risk = 0
            health = 100
            current_lat = lane["dest_lat"]
            current_lng = lane["dest_lng"]
        elif status == "PLANNED":
            planned_pickup = now + timedelta(hours=random.randint(6, 48))
            planned_delivery = planned_pickup + timedelta(hours=transit_duration_hours)
            current_lat = lane["origin_lat"]
            current_lng = lane["origin_lng"]
            health = 100

        shipment = Shipment(
            po_number=f"PO-{100000 + i}",
            status=status,
            supplier_name=supplier,
            carrier_name=carrier,
            lane_name=lane["lane_name"],
            origin_city=lane["origin_city"],
            dest_city=lane["dest_city"],
            origin_lat=lane["origin_lat"],
            origin_lng=lane["origin_lng"],
            dest_lat=lane["dest_lat"],
            dest_lng=lane["dest_lng"],
            current_lat=round(current_lat, 6) if current_lat else None,
            current_lng=round(current_lng, 6) if current_lng else None,
            part_criticality=crit,
            planned_pickup=planned_pickup,
            planned_delivery=planned_delivery,
            actual_pickup=actual_pickup,
            actual_delivery=actual_delivery,
            delay_risk_score=delay_risk,
            health_score=health,
            predicted_delivery=predicted_delivery,
            eta_confidence=round(random.uniform(0.70, 0.95), 2),
            flags=flags,
            references={
                "bill_of_lading": f"BOL-2024-{2000+i}",
                "invoice": f"INV-VG-{5000+i}",
                "truck_id": f"KA-04-{random.randint(1000,9999)}" if lane["mode"] == "road" else f"CONTAINER-IN-{random.randint(1000,9999)}",
            },
            distance=round(random.uniform(350.0, 1200.0), 1),
            current_progress=round(t, 2),
            current_speed=round(random.uniform(45.0, 75.0), 1) if status in ("IN_TRANSIT", "AT_RISK") else 0.0,
            dwell_time=round(random.uniform(0.5, 2.5), 1),
            yard_congestion=0.45,
            historical_delay=round(random.uniform(10.0, 25.0), 1),
            predicted_delay=float(delay_risk),
            predicted_eta=predicted_delivery,
        )
        shipments.append(shipment)

    db.add_all(shipments)
    db.commit()

    # Seed Milestone Events
    for s in shipments:
        events_to_create = []
        if s.status == "PLANNED":
            events_to_create = ["TRANSPORT_ORDER_CREATED"]
        elif s.status in ("IN_TRANSIT", "AT_RISK", "DELAYED"):
            events_to_create = MILESTONES_ORDER[:random.randint(3, 7)]
        elif s.status == "DELIVERED":
            events_to_create = MILESTONES_ORDER[:]

        event_time = s.planned_pickup - timedelta(hours=4)
        for evt_type in events_to_create:
            events_to_create_record = MilestoneEvent(
                shipment_id=s.shipment_id,
                event_type=evt_type,
                source="edi_integration" if "ORDER" in evt_type or "CONFIRMED" in evt_type else "carrier_api",
                event_time=event_time,
                payload={"status_code": "OK", "location": s.origin_city if "ORIGIN" in evt_type else s.dest_city},
            )
            db.add(events_to_create_record)
            event_time = event_time + timedelta(hours=random.randint(4, 18))

        # Add GPS pings
        if s.current_lat and s.current_lng:
            for p in range(random.randint(2, 5)):
                ping_time = now - timedelta(minutes=(p * 20 + random.randint(1, 10)))
                ping_lat = s.current_lat + random.uniform(-0.02, 0.02)
                ping_lng = s.current_lng + random.uniform(-0.02, 0.02)
                db.add(
                    MilestoneEvent(
                        shipment_id=s.shipment_id,
                        event_type="GPS_PING",
                        source="telematics_simulator",
                        event_time=ping_time,
                        payload={
                            "lat": round(ping_lat, 6),
                            "lng": round(ping_lng, 6),
                            "speed_kmh": round(random.uniform(55, 90), 1),
                        },
                    )
                )

    # Pre-seed rich exceptions
    exception_specs = [
        (0, "MISSING_ASN", "P2", "ASN not received for PO", "supplier_delay",
         "Contact supplier and request ASN via portal or email escalation. Escalate to procurement if no response in 2h."),
        (3, "MISSING_PICKUP", "P1", "Pickup not confirmed past SLA — carrier non-compliant", "carrier_non_compliance",
         "Call carrier dispatcher immediately. Request driver app geofence confirmation or manual ping."),
        (5, "GPS_OFFLINE", "P2", "GPS signal stale >45 min", "gps_offline",
         "Request manual driver ping via SMS. Interpolate ETA from last known position + expected speed."),
        (7, "DELAY_RISK_HIGH", "P1", "High delay risk on JIT shipment — line stoppage risk", "transit_delay",
         "Consider air expedite or alternate carrier rebooking. Alert plant MC for JIT slot re-planning."),
        (9, "CUSTOMS_HOLD", "P2", "Customs clearance delayed at EU border", "customs",
         "Notify customs broker liaison. Provide complete documentation set. Estimated 12-24h clearance delay."),
        (12, "CARRIER_NON_COMPLIANT", "P2", "Carrier has not confirmed pickup past SLA window", "carrier_non_compliance",
         "Escalate to carrier account manager. Log compliance incident for monthly scorecard update."),
        (15, "GPS_OFFLINE_CRITICAL", "P1", "GPS signal stale >90 min on JIT shipment", "gps_offline",
         "Immediate escalation required. Contact driver directly. Consider rerouting if no response in 1h."),
        (18, "MILESTONE_SLA_BREACH", "P2", "Gate arrival milestone SLA breached", "milestone_gap",
         "Contact DC receiving team to confirm truck arrival. Update gate arrival manually if confirmed."),
    ]

    for offset, exc_type, severity, msg, root, action in exception_specs:
        if offset < len(shipments):
            s = shipments[offset]
            db.add(
                ExceptionRecord(
                    shipment_id=s.shipment_id,
                    exception_type=exc_type,
                    severity=severity,
                    root_cause=root,
                    message=f"{msg} — PO {s.po_number} -> {s.dest_city}",
                    recommended_action=action,
                    business_impact_score=92 if severity == "P1" else 58,
                )
            )

    db.commit()


def seed_yard_and_containers(db: Session):
    random.seed(RANDOM_SEED)

    # 1. Create Yard Slots: Blocks A, B, C, D | 6 Bays | 4 Rows | 2 Tiers (192 slots total)
    # Must match RL/DQN geometry: BLOCKS A-D, BAYS 1..6, ROWS 1..4, TIERS 1..2
    # (see ml/rl_allocator.py, ml/dqn_allocator.py, ml/yard_allocator.py)
    blocks = ["A", "B", "C", "D"]
    slots = []
    for b in blocks:
        for bay in range(1, 7):
            for row in range(1, 5):
                for tier in range(1, 3):
                    slot_id = f"{b}-{bay:02d}-{row:02d}-{tier}"
                    slot = YardSlot(
                        id=slot_id,
                        block=b,
                        bay=bay,
                        row=row,
                        tier=tier,
                        is_occupied=False,
                        container_id=None,
                    )
                    slots.append(slot)
    db.add_all(slots)
    db.commit()

    # 2. Create Containers
    destinations = ["Hamburg", "Rotterdam", "Antwerp", "Gothenburg", "Singapore", "Busan"]
    carriers_prefix = ["MSCU", "CMAU", "MAEU", "HLCU", "ONEU", "EVER", "COSU", "ZIMU"]
    priorities = ["STANDARD", "HIGH", "URGENT"]
    weight_tiers = ["LIGHT", "MEDIUM", "HEAVY"]

    containers = []
    for i in range(1, 41):
        prefix = random.choice(carriers_prefix)
        serial = 1000000 + i * 147 + (i % 7) * 31
        container_num = f"{prefix}{serial}"[:11]
        priority = random.choices(priorities, weights=[0.60, 0.25, 0.15])[0]
        weight = random.choices(weight_tiers, weights=[0.30, 0.45, 0.25])[0]
        size = random.choice([20, 40])
        dest = random.choice(destinations)
        hazard = (random.random() < 0.10)

        c = Container(
            container_number=container_num,
            size_teu=size,
            weight_tier=weight,
            hazard=hazard,
            destination=dest,
            priority=priority,
            status=ContainerStatus.IN_TRANSIT.value,
            current_slot_id=None,
            created_at=utcnow() - timedelta(hours=random.randint(2, 48)),
        )
        containers.append(c)

    db.add_all(containers)
    db.commit()

    for c in containers:
        db.refresh(c)

    # 3. Stack ~18 containers into Yard (Tier 1 first)
    yard_containers = containers[:18]
    available_tier1 = [s for s in slots if s.tier == 1]
    random.shuffle(available_tier1)

    for i, c in enumerate(yard_containers):
        slot = available_tier1[i]
        slot.is_occupied = True
        slot.container_id = c.id
        c.current_slot_id = slot.id
        c.status = ContainerStatus.YARD_STACKED.value

    # Place 3 containers on Tier 2 above occupied Tier 1
    tier2_candidates = [
        s for s in slots
        if s.tier == 2 and any(t1.is_occupied and t1.block == s.block and t1.bay == s.bay and t1.row == s.row for t1 in available_tier1[:18])
    ]
    tier2_containers = containers[18:21]
    for i, c in enumerate(tier2_containers):
        slot = tier2_candidates[i]
        slot.is_occupied = True
        slot.container_id = c.id
        c.current_slot_id = slot.id
        c.status = ContainerStatus.YARD_STACKED.value

    # 4. Mark 4 containers as AT_GATE
    for c in containers[21:25]:
        c.status = ContainerStatus.AT_GATE.value

    db.commit()

    # 5. Create Gate Inspection Records
    for c in containers[21:26]:
        insp = GateInspection(
            timestamp=utcnow() - timedelta(minutes=random.randint(5, 120)),
            image_path=f"/samples/gate_{c.container_number.lower()}.jpg",
            raw_ocr_text=c.container_number,
            validated_code=c.container_number,
            confidence=round(random.uniform(0.92, 0.99), 2),
            status=InspectionStatus.SUCCESS.value,
            detected_box=[0.20, 0.15, 0.80, 0.85],
        )
        db.add(insp)

    db.commit()


def ensure_yard_geometry(db: Session):
    """Backfill missing yard slots to guarantee 4x6x4x2=192 geometry.

    Upgrades pre-existing 96-slot DBs (3 bays) to 192 slots (6 bays) to match
    RL/DQN trained artifacts. Idempotent — only creates slots that don't exist.
    """
    existing_ids = {r[0] for r in db.query(YardSlot.id).all()}
    missing = []
    for b in ["A", "B", "C", "D"]:
        for bay in range(1, 7):
            for row in range(1, 5):
                for tier in range(1, 3):
                    slot_id = f"{b}-{bay:02d}-{row:02d}-{tier}"
                    if slot_id not in existing_ids:
                        missing.append(
                            YardSlot(
                                id=slot_id,
                                block=b,
                                bay=bay,
                                row=row,
                                tier=tier,
                                is_occupied=False,
                                container_id=None,
                            )
                        )
    if missing:
        db.add_all(missing)
        db.commit()


def seed_database(db: Session):
    """Seed the database with reproducible test data."""
    if db.query(Shipment).count() == 0:
        seed_volvo_tracking(db)
    if db.query(YardSlot).count() == 0:
        seed_yard_and_containers(db)
    else:
        ensure_yard_geometry(db)
    logger.info("Database seeding completed for Volvo Shipment Tracking & Yard ML.")
