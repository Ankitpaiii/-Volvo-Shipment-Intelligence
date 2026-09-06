"""Auth foundation + audit trail (P1.5/P5.1)."""
from datetime import timedelta

from app.config import settings
from app.timeutils import utcnow


def _payload(po="PO-AUDIT-1"):
    now, later = utcnow().isoformat(), (utcnow() + timedelta(days=2)).isoformat()
    return {
        "po_number": po,
        "supplier_name": "Test Supplier",
        "carrier_name": "Test Carrier",
        "lane_name": "Test Lane",
        "origin_city": "Pune",
        "dest_city": "Brussels",
        "origin_lat": 18.5, "origin_lng": 73.8,
        "dest_lat": 50.8, "dest_lng": 4.3,
        "planned_pickup": now,
        "planned_delivery": later,
    }


def test_dev_mode_writes_open_and_audited(client):
    assert settings.auth_disabled is True  # dev default
    r = client.post("/api/v1/shipments", json=_payload("PO-AUDIT-9"))
    assert r.status_code == 200, r.text[:200]
    sid = r.json()["shipment_id"]

    r2 = client.get(f"/api/v1/audit-log?entity_id={sid}")
    assert r2.status_code == 200
    entries = r2.json()
    assert any(e["action"] == "shipment.create" for e in entries)
    assert entries[0]["actor"] == "dev-operator"


def test_enforced_mode_requires_key_and_rbac(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", False)
    monkeypatch.setattr(settings, "api_keys", "adminkey:admin,opkey:operator")

    r = client.post("/api/v1/shipments", json=_payload("PO-NOKEY"))
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHENTICATED"

    r = client.post("/api/v1/shipments", json=_payload("PO-OPKEY"), headers={"X-API-Key": "opkey"})
    assert r.status_code == 200, r.text[:200]

    r = client.post("/api/v1/shipments", json=_payload("PO-BEARER"), headers={"Authorization": "Bearer opkey"})
    assert r.status_code == 200, r.text[:200]

    # Retrain is admin-only: operator key must be refused before any work happens.
    r = client.post("/api/v1/ml/trigger-retrain", headers={"X-API-Key": "opkey"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "FORBIDDEN"

    r = client.post("/api/v1/shipments", json=_payload("PO-BADKEY"), headers={"X-API-Key": "wrong"})
    assert r.status_code == 401
