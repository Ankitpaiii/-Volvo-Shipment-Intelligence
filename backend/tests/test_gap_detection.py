"""Unit tests for risk scoring + LIKE escaping (P1.2/P1.3/P3.6)."""
from datetime import timedelta

from app.models import Shipment
from app.routes.common import _escape_like
from app.services.gap_detection import compute_risk_and_health
from app.timeutils import utcnow


def _shipment(**kw):
    now = utcnow()
    base = dict(
        po_number="PO-TEST",
        status="IN_TRANSIT",
        part_criticality="STANDARD",
        planned_pickup=now - timedelta(hours=10),
        planned_delivery=now + timedelta(hours=10),
    )
    base.update(kw)
    return Shipment(**base)


def test_escape_like_neutralizes_wildcards():
    assert _escape_like("100%_x\\y") == "100\\%\\_x\\\\y"


def test_healthy_shipment_low_risk():
    s = _shipment()
    risk, health, flags, predicted, conf = compute_risk_and_health(s, [])
    assert 0 <= risk <= 100
    assert health == 100 - risk
    assert predicted is not None
    assert 0.35 <= conf <= 0.95


def test_overdue_jit_shipment_high_risk():
    now = utcnow()
    s = _shipment(
        part_criticality="JIT",
        planned_pickup=now - timedelta(hours=100),
        planned_delivery=now - timedelta(hours=5),
    )
    risk, _, flags, _, _ = compute_risk_and_health(s, [], now=now)
    assert risk >= 40
    assert "past_planned_delivery" in flags
