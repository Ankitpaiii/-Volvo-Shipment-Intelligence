"""
Yard State & Digital Twin Management Service.
Handles 2D/multi-tier grid state queries, container placement, slot reassignment, and statistics.
"""
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models import Container, ContainerStatus, Shipment, YardSlot


def get_yard_state(db: Session) -> Dict[str, Any]:
    """
    Returns full digital twin grid structure organized by Block -> Bay -> Row -> Tier,
    plus inbound containers currently waiting at the gate with predictive delay metadata.
    """
    slots = db.query(YardSlot).all()
    total_slots = len(slots)
    occupied_slots = sum(1 for s in slots if s.is_occupied)
    occupancy_rate = round((occupied_slots / max(1, total_slots)) * 100, 1)

    blocks: Dict[str, List[Dict[str, Any]]] = {}

    for s in slots:
        if s.block not in blocks:
            blocks[s.block] = []

        container_info = None
        if s.container:
            container_info = {
                "id": s.container.id,
                "container_number": s.container.container_number,
                "size_teu": s.container.size_teu,
                "weight_tier": s.container.weight_tier,
                "hazard": s.container.hazard,
                "destination": s.container.destination,
                "priority": s.container.priority,
                "status": s.container.status,
            }

        blocks[s.block].append({
            "id": s.id,
            "block": s.block,
            "bay": s.bay,
            "row": s.row,
            "tier": s.tier,
            "is_occupied": s.is_occupied,
            "container": container_info,
        })

    # Sort slots within each block for orderly grid display
    for b in blocks:
        blocks[b].sort(key=lambda x: (x["bay"], x["row"], x["tier"]))

    # Query containers currently waiting at gate (not yet stacked into yard slot)
    gate_containers = (
        db.query(Container)
        .filter(Container.status == ContainerStatus.AT_GATE.value)
        .order_by(Container.created_at.desc())
        .all()
    )

    containers_at_gate = []
    for c in gate_containers:
        # Check if shipment has delay prediction
        shipment = db.query(Shipment).filter(Shipment.container_id == c.id).first()
        containers_at_gate.append({
            "id": c.id,
            "container_number": c.container_number,
            "size_teu": c.size_teu,
            "weight_tier": c.weight_tier,
            "hazard": c.hazard,
            "destination": c.destination,
            "priority": c.priority,
            "status": c.status,
            "predicted_delay": shipment.predicted_delay if shipment else None,
            "predicted_eta": shipment.predicted_eta if shipment else None,
            "created_at": c.created_at,
        })

    return {
        "total_slots": total_slots,
        "occupied_slots": occupied_slots,
        "available_slots": total_slots - occupied_slots,
        "occupancy_rate_pct": occupancy_rate,
        "blocks": blocks,
        "containers_at_gate": containers_at_gate,
    }


def assign_container_to_slot(db: Session, container_id: str, slot_id: str) -> Optional[YardSlot]:
    """
    Assign container to specified yard slot and update digital twin state.
    Strictly validates:
    1. Container existence
    2. Slot existence
    3. Slot occupancy (cannot overwrite an already occupied slot)
    4. Structural stacking rules:
       - Tier 2 requires occupied Tier 1 below it
       - Heavy containers cannot be placed on Tier 2
    """
    container = db.query(Container).filter(Container.id == container_id).first()
    slot = db.query(YardSlot).filter(YardSlot.id == slot_id).first()

    if not container:
        raise ValueError("Container not found in database")
    if not slot:
        raise ValueError(f"Target slot {slot_id} does not exist")

    # Check if target slot is already occupied by a different container
    if slot.is_occupied and slot.container_id != container.id:
        raise ValueError(f"Target slot {slot_id} is already occupied by container {slot.container_id}")

    # Check structural stacking rules
    if slot.tier == 2:
        tier1_id = f"{slot.block}-{slot.bay:02d}-{slot.row:02d}-1"
        tier1_slot = db.query(YardSlot).filter(YardSlot.id == tier1_id).first()
        if not tier1_slot or not tier1_slot.is_occupied:
            raise ValueError(f"Cannot place container on Tier 2 slot {slot_id}: Tier 1 base is empty")

        if container.weight_tier == "HEAVY":
            raise ValueError(f"Cannot place HEAVY container {container.container_number} on Tier 2 slot {slot_id}")

    # Free previous slot if container was already stacked elsewhere
    if container.current_slot_id and container.current_slot_id != slot.id:
        prev_slot = db.query(YardSlot).filter(YardSlot.id == container.current_slot_id).first()
        if prev_slot:
            prev_slot.is_occupied = False
            prev_slot.container_id = None

    slot.is_occupied = True
    slot.container_id = container.id
    container.current_slot_id = slot.id
    container.status = ContainerStatus.YARD_STACKED.value

    db.commit()
    db.refresh(slot)
    return slot


def release_slot(db: Session, slot_id: str) -> Optional[YardSlot]:
    """
    Release a slot when container departs.
    """
    slot = db.query(YardSlot).filter(YardSlot.id == slot_id).first()
    if not slot:
        return None

    if slot.container_id:
        container = db.query(Container).filter(Container.id == slot.container_id).first()
        if container:
            container.current_slot_id = None
            container.status = ContainerStatus.DEPARTED.value

    slot.is_occupied = False
    slot.container_id = None
    db.commit()
    db.refresh(slot)
    return slot
