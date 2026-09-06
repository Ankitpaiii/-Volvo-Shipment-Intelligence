"""Validation + uniform error envelope (P3.2)."""


def test_bad_exception_action_rejected_with_envelope(client):
    r = client.post("/api/v1/exceptions/xxx/actions", json={"action": "bogus"})
    assert r.status_code == 422
    body = r.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "request_id" in body["error"]


def test_missing_shipment_uses_structured_404(client):
    r = client.get("/api/v1/shipments/does-not-exist")
    assert r.status_code == 404
    body = r.json()
    assert body["error"]["code"] == "SHIPMENT_NOT_FOUND"
    assert "request_id" in body["error"]


def test_shipments_list_paginated_shape(client):
    r = client.get("/api/v1/shipments?page=1&limit=5")
    assert r.status_code == 200
    body = r.json()
    assert {"items", "total", "page", "limit"} <= set(body.keys())
