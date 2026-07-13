import logging
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import MilestoneEvent, Shipment, ShipmentStatus

logger = logging.getLogger(__name__)

# Simulate realistic truck speeds in km/h per lane type
LANE_SPEEDS = {
    "road": (60, 90),      # min, max km/h
    "air": (800, 900),
    "sea": (20, 35),
}

# Approximate distances in km for each lane (for speed simulation)
LANE_DISTANCES = {
    "Bengaluru -> Gothenburg": 8200,
    "Chennai -> Gothenburg": 8100,
    "Pune -> Brussels DC": 7900,
    "Hosur -> Chennai Plant": 340,
    "Mumbai -> Gothenburg": 7800,
    "Delhi -> Gothenburg": 7200,
}


def _get_progress_fraction(shipment: Shipment, now: datetime) -> float:
    total_secs = (shipment.planned_delivery - shipment.planned_pickup).total_seconds()
    if total_secs <= 0:
        return 1.0
    elapsed = (now - shipment.planned_pickup).total_seconds()
    return max(0.0, min(1.0, elapsed / total_secs))


def simulate_gps_pings(db: Session) -> int:
    """
    Advance simulated GPS positions for active shipments.
    - Occasionally introduces stall events (no ping) to simulate GPS gaps
    - Adds variable speed with random noise
    - Returns count of pings generated
    """
    now = datetime.utcnow()
    active = db.query(Shipment).filter(
        Shipment.status.in_([ShipmentStatus.IN_TRANSIT.value, ShipmentStatus.AT_RISK.value, ShipmentStatus.DELAYED.value])
    ).all()

    pings_generated = 0
    for shipment in active:
        # Stall probability: higher for delayed/at-risk shipments
        stall_prob = 0.08 if shipment.status == ShipmentStatus.IN_TRANSIT.value else 0.20
        gps_loss_prob = 0.05  # complete GPS signal loss — no ping recorded

        if random.random() < gps_loss_prob:
            # GPS signal completely lost — don't record a ping, let gap detection flag it
            logger.debug("GPS loss simulated for shipment %s", shipment.po_number)
            continue

        if random.random() < stall_prob:
            # Vehicle stalled — stays at current position
            logger.debug("Stall simulated for shipment %s", shipment.po_number)
            continue

        # Calculate new position with noise
        progress = _get_progress_fraction(shipment, now)

        # Add slight random noise to simulate realistic GPS jitter
        noise_lat = random.gauss(0, 0.02)
        noise_lng = random.gauss(0, 0.02)

        new_lat = shipment.origin_lat + (shipment.dest_lat - shipment.origin_lat) * progress + noise_lat
        new_lng = shipment.origin_lng + (shipment.dest_lng - shipment.origin_lng) * progress + noise_lng

        # Clamp to valid coordinate range
        new_lat = max(-90.0, min(90.0, new_lat))
        new_lng = max(-180.0, min(180.0, new_lng))

        shipment.current_lat = new_lat
        shipment.current_lng = new_lng

        db.add(
            MilestoneEvent(
                shipment_id=shipment.shipment_id,
                event_type="GPS_PING",
                source="telematics_simulator",
                event_time=now,
                payload={
                    "lat": round(new_lat, 6),
                    "lng": round(new_lng, 6),
                    "speed_kmh": round(random.uniform(55, 95), 1),
                    "heading": round(random.uniform(0, 360), 1),
                    "progress_pct": round(progress * 100, 1),
                },
            )
        )
        pings_generated += 1

    db.commit()
    return pings_generated
