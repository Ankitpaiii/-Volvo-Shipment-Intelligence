"""Deep health endpoint contract (P1/P3.8)."""


def test_health_returns_deep_shape(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    for key in ("status", "service", "version", "db_ok", "worker", "sse", "ml_models_loaded"):
        assert key in body, f"missing {key}"
    assert body["status"] in ("ok", "degraded", "down")
    assert body["db_ok"] is True  # isolated SQLite SELECT 1
    assert "subscribers" in body["sse"]
    assert r.headers.get("x-request-id")  # RequestIDMiddleware
