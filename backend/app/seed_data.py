from datetime import datetime, timedelta
import random

from sqlalchemy.orm import Session

from app.models import ExceptionRecord, MilestoneEvent, Shipment, ShipmentStatus


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
        "mode": "sea",
    },
    {
        "lane_name": "Bangalore -> Volvo Ghent",
        "origin_city": "Bengaluru",
        "dest_city": "Ghent",
        "origin_lat": 12.9716, "origin_lng": 77.5946,
        "dest_lat": 51.0543, "dest_lng": 3.7174,
        "mode": "air",
    },
]

SUPPLIERS = [
    "Bosch India", "SKF Pune", "Denso Chennai", "Mahle Hosur",
    "Continental BLR", "ZF India", "Aptiv Chennai", "Valeo India",
    "Minda Industries", "Motherson Sumi",
]
CARRIERS = [
    "DHL Freight", "DB Schenker", "Blue Dart", "Maersk Logistics",
    "TVS Logistics", "Gati-KWE", "VRL Cargo", "FedEx Freight",
]
CRITICALITIES = ["JIT", "JIS", "STANDARD", "STANDARD", "STANDARD", "LOW", "STANDARD", "JIT"]


def seed_database(db: Session) -> None:
    if db.query(Shipment).count() > 0:
        return

    now = datetime.utcnow()
    shipments: list[Shipment] = []

    for i in range(50):
        lane = LANES[i % len(LANES)]
        # Vary transit duration by mode
        if lane["mode"] == "road":
            transit_hours = random.randint(8, 24)
        elif lane["mode"] == "air":
            transit_hours = random.randint(48, 120)
        else:  # sea
            transit_hours = random.randint(240, 480)

        pickup = now - timedelta(hours=random.randint(4, transit_hours // 2))
        delivery = pickup + timedelta(hours=transit_hours)
        criticality = CRITICALITIES[i % len(CRITICALITIES)]
        po = f"4500{120000 + i}"

        # Distribute statuses realistically
        status_roll = i % 10
        if status_roll < 4:
            status = ShipmentStatus.IN_TRANSIT.value
            risk = random.randint(5, 35)
        elif status_roll < 6:
            status = ShipmentStatus.AT_RISK.value
            risk = random.randint(55, 85)
        elif status_roll == 6:
            status = ShipmentStatus.DELAYED.value
            risk = random.randint(75, 97)
        elif status_roll == 7:
            status = ShipmentStatus.DELIVERED.value
            risk = random.randint(0, 15)
        elif status_roll == 8:
            status = ShipmentStatus.PLANNED.value
            risk = random.randint(0, 20)
        else:
            status = ShipmentStatus.IN_TRANSIT.value
            risk = random.randint(20, 50)

        elapsed = max(0.0, min(1.0, (now - pickup).total_seconds() / max(1, (delivery - pickup).total_seconds())))
        # Add some GPS noise to position
        noise_lat = random.gauss(0, 0.05)
        noise_lng = random.gauss(0, 0.05)
        current_lat = lane["origin_lat"] + (lane["dest_lat"] - lane["origin_lat"]) * elapsed + noise_lat
        current_lng = lane["origin_lng"] + (lane["dest_lng"] - lane["origin_lng"]) * elapsed + noise_lng

        shipment = Shipment(
            po_number=po,
            status=status,
            supplier_name=SUPPLIERS[i % len(SUPPLIERS)],
            carrier_name=CARRIERS[i % len(CARRIERS)],
            lane_name=lane["lane_name"],
            origin_city=lane["origin_city"],
            dest_city=lane["dest_city"],
            origin_lat=lane["origin_lat"],
            origin_lng=lane["origin_lng"],
            dest_lat=lane["dest_lat"],
            dest_lng=lane["dest_lng"],
            current_lat=current_lat if status not in (ShipmentStatus.PLANNED.value,) else None,
            current_lng=current_lng if status not in (ShipmentStatus.PLANNED.value,) else None,
            part_criticality=criticality,
            planned_pickup=pickup,
            planned_delivery=delivery,
            actual_pickup=pickup + timedelta(hours=1) if status != ShipmentStatus.PLANNED.value else None,
            actual_delivery=delivery - timedelta(hours=random.randint(0, 3)) if status == ShipmentStatus.DELIVERED.value else None,
            delay_risk_score=risk,
            health_score=max(0, 100 - risk),
            predicted_delivery=delivery + timedelta(hours=random.randint(-6, int(transit_hours * 0.2))),
            eta_confidence=round(random.uniform(0.5, 0.95), 2),
            flags=["gps_stale_45min"] if risk > 60 and status_roll % 2 == 0 else [],
            references={
                "PO": po,
                "BOL": f"BOL-{90000 + i}",
                "ASN": f"ASN-{70000 + i}" if i % 3 != 0 else "",
                "CARRIER_LOAD": f"LOAD-{5000 + i}",
            },
        )
        db.add(shipment)
        shipments.append(shipment)

    db.flush()

    milestone_sets = {
        "full": [
            "TRANSPORT_ORDER_CREATED", "ASN_CREATED", "BOOKING_CONFIRMED",
            "PICKUP_COMPLETED", "IN_TRANSIT", "GATE_ARRIVAL",
        ],
        "partial": ["TRANSPORT_ORDER_CREATED", "BOOKING_CONFIRMED", "PICKUP_COMPLETED"],
        "minimal": ["TRANSPORT_ORDER_CREATED"],
        "delivered": [
            "TRANSPORT_ORDER_CREATED", "ASN_CREATED", "BOOKING_CONFIRMED",
            "PICKUP_COMPLETED", "IN_TRANSIT", "GATE_ARRIVAL",
            "DOCK_CHECKIN", "UNLOAD_COMPLETE", "GOODS_RECEIPT_CONFIRMED",
        ],
        "customs_hold": [
            "TRANSPORT_ORDER_CREATED", "ASN_CREATED", "BOOKING_CONFIRMED",
            "PICKUP_COMPLETED", "IN_TRANSIT",
        ],
    }

    for idx, shipment in enumerate(shipments):
        if shipment.status == ShipmentStatus.DELIVERED.value:
            milestones = milestone_sets["delivered"]
        elif shipment.delay_risk_score >= 70:
            # Some have customs holds, some have GPS stalls
            milestones = milestone_sets["customs_hold"] if idx % 3 == 0 else (
                milestone_sets["minimal"] if idx % 2 == 0 else milestone_sets["partial"]
            )
        elif shipment.delay_risk_score >= 40:
            milestones = milestone_sets["partial"]
        else:
            milestones = milestone_sets["full"]

        t = shipment.planned_pickup
        for m in milestones:
            db.add(
                MilestoneEvent(
                    shipment_id=shipment.shipment_id,
                    event_type=m,
                    source="seed",
                    event_time=t,
                    payload={"seeded": True, "lane_mode": LANES[idx % len(LANES)]["mode"]},
                )
            )
            t += timedelta(hours=random.randint(2, 16))

        # Add GPS pings for in-transit shipments
        if shipment.current_lat and shipment.status not in (ShipmentStatus.PLANNED.value, ShipmentStatus.DELIVERED.value):
            # Add multiple GPS pings to show trajectory
            num_pings = random.randint(3, 8)
            for ping_i in range(num_pings):
                ping_progress = (ping_i + 1) / (num_pings + 1)
                actual_progress = max(0.0, min(1.0,
                    (now - shipment.planned_pickup).total_seconds() /
                    max(1, (shipment.planned_delivery - shipment.planned_pickup).total_seconds())
                ))
                p = min(ping_progress, actual_progress)
                # Skip some pings to simulate GPS gaps for stalled shipments
                if shipment.delay_risk_score > 60 and ping_i == num_pings - 2:
                    continue  # gap — no ping
                ping_lat = shipment.origin_lat + (shipment.dest_lat - shipment.origin_lat) * p + random.gauss(0, 0.03)
                ping_lng = shipment.origin_lng + (shipment.dest_lng - shipment.origin_lng) * p + random.gauss(0, 0.03)
                ping_time = shipment.planned_pickup + timedelta(
                    seconds=(now - shipment.planned_pickup).total_seconds() * (ping_i / num_pings)
                )
                # For at-risk/delayed shipments, make last GPS ping old
                if shipment.delay_risk_score > 60 and ping_i == num_pings - 1:
                    ping_time = now - timedelta(minutes=random.randint(50, 120))
                db.add(
                    MilestoneEvent(
                        shipment_id=shipment.shipment_id,
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

    # Pre-seed a rich set of exceptions
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
