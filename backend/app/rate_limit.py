"""Simple in-memory rate limiter (no Redis dep) + SSE concurrency guard."""
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# path prefix -> (limit, window_seconds)
LIMITS: list[tuple[str, str, int, int]] = [
    ("POST", "/api/v1/copilot/chat", 10, 60),
    ("POST", "/api/v1/shipments", 100, 60),
    ("PATCH", "/api/v1/", 100, 60),
    ("POST", "/api/v1/exceptions", 100, 60),
    ("POST", "/api/v1/inspection", 30, 60),
    ("GET", "/api/v1/stream", 30, 60),
]

DEFAULT_LIMIT = (200, 60)  # 200 req/min per IP
SSE_MAX_CONCURRENT_PER_IP = 5

_hits: dict[str, deque[float]] = defaultdict(deque)
_sse_active: dict[str, int] = defaultdict(int)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rule(method: str, path: str) -> tuple[int, int]:
    for m, prefix, limit, window in LIMITS:
        if method == m and path.startswith(prefix):
            return limit, window
    return DEFAULT_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip docs/health
        if request.url.path in ("/docs", "/openapi.json", "/api/v1/health"):
            return await call_next(request)

        ip = _client_ip(request)
        method, path = request.method, request.url.path
        limit, window = _rule(method, path)
        now = time.monotonic()

        key = f"{ip}:{method}:{path.split('/')[3] if len(path.split('/')) > 3 else path}"
        dq = _hits[key]
        while dq and now - dq[0] > window:
            dq.popleft()
        if len(dq) >= limit:
            retry_after = int(window - (now - dq[0])) + 1
            return JSONResponse(
                status_code=429,
                content={"error": {"code": "RATE_LIMITED", "message": f"Too many requests, retry in {retry_after}s"}},
                headers={"Retry-After": str(retry_after), "X-RateLimit-Limit": str(limit)},
            )
        dq.append(now)

        # SSE concurrency guard
        is_sse = path == "/api/v1/stream"
        if is_sse:
            if _sse_active[ip] >= SSE_MAX_CONCURRENT_PER_IP:
                return JSONResponse(
                    status_code=429,
                    content={"error": {"code": "SSE_LIMIT", "message": "Too many concurrent SSE streams"}},
                )
            _sse_active[ip] += 1
        try:
            response = await call_next(request)
        finally:
            if is_sse:
                _sse_active[ip] = max(0, _sse_active[ip] - 1)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - len(dq)))
        return response
