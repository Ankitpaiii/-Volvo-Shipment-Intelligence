"""Container inventory endpoints."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Container
from app.schemas import ContainerSummary

router = APIRouter()


@router.get("/containers", response_model=List[ContainerSummary])
def list_containers(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Container)
    if status:
        query = query.filter(Container.status == status.upper())
    if priority:
        query = query.filter(Container.priority == priority.upper())
    return query.order_by(Container.created_at.desc()).all()


@router.get("/containers/{container_id}", response_model=ContainerSummary)
def get_container(container_id: str, db: Session = Depends(get_db)):
    container = db.query(Container).filter(Container.id == container_id).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    return container
