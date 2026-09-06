"""Aggregated API router — split from monolithic routes.py (P3.1).

Keeps the public import stable: `from app.routes import router`.
"""
from fastapi import APIRouter

from app.routes import analytics, audit, containers, copilot, exceptions, health, inspection, ml, shipments, yard

router = APIRouter(prefix="/api/v1")

router.include_router(health.router, tags=["health"])
router.include_router(shipments.router, tags=["shipments"])
router.include_router(exceptions.router, tags=["exceptions"])
router.include_router(analytics.router, tags=["analytics"])
router.include_router(audit.router, tags=["audit"])
router.include_router(copilot.router, tags=["copilot"])
router.include_router(inspection.router, tags=["inspection"])
router.include_router(yard.router, tags=["yard"])
router.include_router(containers.router, tags=["containers"])
router.include_router(ml.router, tags=["ml"])
