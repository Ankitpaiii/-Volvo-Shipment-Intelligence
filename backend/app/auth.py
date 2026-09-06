"""Auth foundation (P1.5) — dependency-free API-key auth with dev-open default.

Design:
- Reads stay public so the existing dashboard keeps working untouched.
- Write endpoints depend on `get_current_user`. While `AUTH_DISABLED=true`
  (dev default) this returns a static dev actor with no credential needed.
- Production: set `AUTH_DISABLED=false` + `API_KEYS="key1:operator,key2:admin"`.
  Clients send `X-API-Key: <key>` or `Authorization: Bearer <key>`.
- `require_role("admin")` / `require_role("manager", "admin")` enforce RBAC
  with a simple hierarchy: admin > manager > operator.
- Full JWT/OIDC (Entra ID) is the documented next step; this module owns the
  seam so routes don't need to change when it lands.
"""
import secrets

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import settings

ROLE_HIERARCHY = {"operator": 1, "manager": 2, "admin": 3}

DEV_ACTOR_NAME = "dev-operator"


class Actor(BaseModel):
    name: str
    role: str = "operator"


def _parse_api_keys() -> dict[str, str]:
    """Parse API_KEYS env: 'key:role,key2:role2' (bare key defaults to operator)."""
    mapping: dict[str, str] = {}
    for entry in (settings.api_keys or "").split(","):
        entry = entry.strip()
        if not entry:
            continue
        if ":" in entry:
            key, role = entry.split(":", 1)
            key, role = key.strip(), role.strip().lower()
            if key and role in ROLE_HIERARCHY:
                mapping[key] = role
        else:
            mapping[entry] = "operator"
    return mapping


def _credential_from_request(request: Request) -> str | None:
    api_key = request.headers.get("x-api-key")
    if api_key:
        return api_key.strip()
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def get_current_user(request: Request) -> Actor:
    """Resolve the calling actor. Open in dev, key-enforced in production."""
    if settings.auth_disabled:
        return Actor(name=DEV_ACTOR_NAME, role="operator")

    provided = _credential_from_request(request)
    if not provided:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "UNAUTHENTICATED", "message": "Missing API key (X-API-Key or Bearer)"}},
        )
    keys = _parse_api_keys()
    for stored_key, role in keys.items():
        if secrets.compare_digest(provided, stored_key):
            return Actor(name=f"key:{role}", role=role)
    raise HTTPException(
        status_code=401,
        detail={"error": {"code": "UNAUTHENTICATED", "message": "Invalid API key"}},
    )


def require_role(*allowed: str):
    """RBAC guard honoring hierarchy (admin passes everything)."""
    allowed_set = {r.lower() for r in allowed}

    def _guard(actor: Actor = Depends(get_current_user)) -> Actor:
        if settings.auth_disabled:
            return actor  # dev-open: guards only enforce in production
        if actor.role == "admin":
            return actor
        if actor.role in allowed_set:
            return actor
        # Manager inherits operator privileges.
        if actor.role == "manager" and "operator" in allowed_set:
            return actor
        raise HTTPException(
            status_code=403,
            detail={"error": {"code": "FORBIDDEN", "message": f"Role '{actor.role}' cannot perform this action"}},
        )

    return _guard


# Convenience aliases used by write endpoints.
require_writer = require_role("operator", "manager", "admin")
require_manager = require_role("manager", "admin")
require_admin = require_role("admin")
