"""Yard digital twin and slot allocation endpoints."""
import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import Actor, require_writer
from app.database import get_db
from app.ml.yard_allocator import (
    YardSlotAllocator,
    compute_slot_cost,
    manhattan_distance_to_gate,
    _block_occupancy,
    _same_dest_neighbours,
)
from app.models import Container, YardSlot
from app.schemas import (
    AllocationComparisonResponse,
    SlotAllocationRequest,
    SlotAllocationResponse,
    YardStateResponse,
)
from app.services.yard_service import assign_container_to_slot, get_yard_state

router = APIRouter()


@router.get("/yard/state", response_model=YardStateResponse)
def get_yard_digital_twin_state(db: Session = Depends(get_db)):
    """
    Returns full 2D yard digital twin grid state (Blocks A-D, Bays, Rows, Tiers).
    """
    return get_yard_state(db)


def _compare_strategies(db: Session, container) -> AllocationComparisonResponse:
    """
    Run all 4 strategies in read-only mode and return their recommendations.
    """
    def cost_for_slot(slot) -> Optional[float]:
        if not slot:
            return None
        occ = _block_occupancy(db, slot.block)
        n_dest = _same_dest_neighbours(db, slot, container.destination)
        return compute_slot_cost(
            slot.block, slot.bay, slot.row, slot.tier,
            container.priority, container.destination, occ, n_dest,
        )["total_cost"]

    ff_slot = YardSlotAllocator.allocate_baseline(db, container)
    nr_slot = YardSlotAllocator.allocate_nearest(db, container)
    intel_result = YardSlotAllocator.allocate_intelligent(db, container)
    intel_slot = intel_result.get("slot")
    rl_result = YardSlotAllocator.allocate_rl(db, container)
    rl_slot = rl_result.get("slot")
    rl_available = "rl_qlearning" in rl_result.get("strategy", "")

    dqn_result = YardSlotAllocator.allocate_dqn(db, container)
    dqn_slot = dqn_result.get("slot")
    dqn_available = bool(dqn_result.get("model_trained", True))
    dqn_cost = dqn_result.get("cost_score") if dqn_slot else None

    ff_cost = cost_for_slot(ff_slot)
    nr_cost = cost_for_slot(nr_slot)
    intel_cost = intel_result.get("cost_score")
    intel_breakdown = intel_result.get("cost_breakdown")
    rl_cost = rl_result.get("cost_score") if rl_slot else None

    recommended_slot = intel_slot.id if intel_slot else None
    recommended_strategy = "intelligent"
    best_cost = intel_cost if intel_cost is not None else 999.0

    if rl_available and rl_slot and rl_cost is not None and rl_cost < best_cost:
        recommended_slot = rl_slot.id
        recommended_strategy = "rl_qlearning"
        best_cost = rl_cost

    if dqn_slot and dqn_cost is not None and dqn_cost < best_cost:
        recommended_slot = dqn_slot.id
        recommended_strategy = "dqn"
        best_cost = dqn_cost

    reason_parts = []
    if intel_cost is not None:
        reason_parts.append(f"Intelligent cost={intel_cost:.1f}")
    if rl_cost is not None and rl_available:
        reason_parts.append(f"RL cost={rl_cost:.1f}")
    if dqn_cost is not None:
        reason_parts.append(f"DQN cost={dqn_cost:.1f}")

    if recommended_strategy == "dqn":
        reason_parts.append("Dueling DQN selected (lowest cost & verified stability/reefer constraints)")
    elif recommended_strategy == "rl_qlearning":
        reason_parts.append("RL selected (lower cost than intelligent)")
    else:
        reason_parts.append("Intelligent selected as reliable cost-minimising heuristic")

    return AllocationComparisonResponse(
        container_id=container.id,
        container_number=container.container_number,
        destination=container.destination,
        priority=container.priority,
        weight_tier=container.weight_tier,
        first_fit_slot=ff_slot.id if ff_slot else None,
        nearest_slot=nr_slot.id if nr_slot else None,
        intelligent_slot=intel_slot.id if intel_slot else None,
        rl_slot=rl_slot.id if rl_slot else None,
        rl_available=rl_available,
        dqn_slot=dqn_slot.id if dqn_slot else None,
        dqn_available=dqn_available,
        recommended_slot=recommended_slot,
        recommended_strategy=recommended_strategy,
        intelligent_cost_breakdown=intel_breakdown,
        first_fit_cost=round(ff_cost, 2) if ff_cost is not None else None,
        nearest_cost=round(nr_cost, 2) if nr_cost is not None else None,
        intelligent_cost=round(intel_cost, 2) if intel_cost is not None else None,
        rl_cost=round(rl_cost, 2) if rl_cost is not None else None,
        dqn_cost=round(dqn_cost, 2) if dqn_cost is not None else None,
        rl_zone_action=rl_result.get("rl_zone_action"),
        dqn_zone_action=dqn_result.get("selected_zone"),
        reason=" | ".join(reason_parts),
    )


def _audit_alloc(db: Session, actor_name: str, container_id: str, slot_id: str, strategy: str) -> None:
    log_action(db, actor_name, "yard.allocate", "container", container_id, {"slot": slot_id, "strategy": strategy})


@router.post("/yard/allocate-slot")
def allocate_slot_for_container(
    payload: SlotAllocationRequest,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_writer),
):
    """
    Allocate a yard slot for a container.
    """
    container = db.query(Container).filter(
        (Container.id == payload.container_id) | (Container.container_number == payload.container_id)
    ).first()
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")

    strategy = payload.strategy.lower()

    if strategy == "compare":
        return _compare_strategies(db, container)

    if payload.target_slot_id:
        target_slot = db.query(YardSlot).filter(YardSlot.id == payload.target_slot_id).first()
        if not target_slot:
            raise HTTPException(status_code=400, detail=f"Target slot {payload.target_slot_id} does not exist")
        try:
            assign_container_to_slot(db, container.id, target_slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        _audit_alloc(db, actor.name, container.id, target_slot.id, "manual_confirm")

        occ = _block_occupancy(db, target_slot.block)
        n_dest = _same_dest_neighbours(db, target_slot, container.destination)
        breakdown = compute_slot_cost(
            target_slot.block, target_slot.bay, target_slot.row, target_slot.tier,
            container.priority, container.destination, occ, n_dest,
        )
        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=target_slot.id,
            block=target_slot.block, bay=target_slot.bay, row=target_slot.row, tier=target_slot.tier,
            strategy_used="manual_confirm",
            cost_score=round(breakdown["total_cost"], 2),
            cost_breakdown=breakdown,
            rationale=f"Manually confirmed slot {target_slot.id}",
        )

    if strategy == "first_fit":
        slot = YardSlotAllocator.allocate_baseline(db, container)
        if not slot:
            raise HTTPException(status_code=400, detail="No available yard slot (first-fit)")

        occ = _block_occupancy(db, slot.block)
        n_dest = _same_dest_neighbours(db, slot, container.destination)
        breakdown = compute_slot_cost(
            slot.block, slot.bay, slot.row, slot.tier,
            container.priority, container.destination, occ, n_dest,
        )
        try:
            assign_container_to_slot(db, container.id, slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        _audit_alloc(db, actor.name, container.id, slot.id, "first_fit")

        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=slot.id,
            block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
            strategy_used="first_fit",
            cost_score=round(breakdown["total_cost"], 2),
            cost_breakdown=breakdown,
            rationale=f"First available slot {slot.id} (ordered block/bay/row/tier)",
        )

    if strategy == "nearest":
        slot = YardSlotAllocator.allocate_nearest(db, container)
        if not slot:
            raise HTTPException(status_code=400, detail="No available yard slot (nearest)")

        dist = manhattan_distance_to_gate(slot.block, slot.bay, slot.row)
        occ = _block_occupancy(db, slot.block)
        n_dest = _same_dest_neighbours(db, slot, container.destination)
        breakdown = compute_slot_cost(
            slot.block, slot.bay, slot.row, slot.tier,
            container.priority, container.destination, occ, n_dest,
        )
        try:
            assign_container_to_slot(db, container.id, slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        _audit_alloc(db, actor.name, container.id, slot.id, "nearest")

        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=slot.id,
            block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
            strategy_used="nearest",
            cost_score=round(breakdown["total_cost"], 2),
            cost_breakdown=breakdown,
            rationale=f"Nearest slot {slot.id} (Manhattan distance={dist})",
        )

    if strategy == "rl":
        alloc_result = YardSlotAllocator.allocate_rl(db, container)
        slot = alloc_result["slot"]
        if not slot:
            raise HTTPException(status_code=400, detail=alloc_result.get("rationale", "RL allocation failed"))
        try:
            assign_container_to_slot(db, container.id, slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        _audit_alloc(db, actor.name, container.id, slot.id, alloc_result.get("strategy", "rl"))

        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=slot.id,
            block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
            strategy_used=alloc_result["strategy"],
            cost_score=alloc_result["cost_score"],
            cost_breakdown=alloc_result.get("cost_breakdown"),
            rationale=alloc_result["rationale"],
            rl_zone_action=alloc_result.get("rl_zone_action"),
        )

    if strategy == "dqn":
        alloc_result = YardSlotAllocator.allocate_dqn(db, container)
        slot = alloc_result["slot"]
        if not slot:
            raise HTTPException(status_code=400, detail=alloc_result.get("rationale", "DQN allocation failed"))
        try:
            assign_container_to_slot(db, container.id, slot.id)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        _audit_alloc(db, actor.name, container.id, slot.id, alloc_result.get("strategy", "dqn"))

        return SlotAllocationResponse(
            container_id=container.id,
            container_number=container.container_number,
            allocated_slot_id=slot.id,
            block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
            strategy_used=alloc_result["strategy"],
            cost_score=alloc_result["cost_score"],
            cost_breakdown=alloc_result.get("cost_breakdown"),
            rationale=alloc_result["rationale"],
            rl_zone_action=alloc_result.get("selected_zone"),
        )

    # Intelligent (default)
    alloc_result = YardSlotAllocator.allocate_intelligent(db, container)
    slot = alloc_result["slot"]
    if not slot:
        raise HTTPException(status_code=400, detail=alloc_result["rationale"])

    try:
        assign_container_to_slot(db, container.id, slot.id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    _audit_alloc(db, actor.name, container.id, slot.id, alloc_result.get("strategy", "intelligent"))

    return SlotAllocationResponse(
        container_id=container.id,
        container_number=container.container_number,
        allocated_slot_id=slot.id,
        block=slot.block, bay=slot.bay, row=slot.row, tier=slot.tier,
        strategy_used=alloc_result["strategy"],
        cost_score=alloc_result["cost_score"],
        cost_breakdown=alloc_result.get("cost_breakdown"),
        rationale=alloc_result["rationale"],
    )


@router.get("/yard/benchmark")
def get_allocation_benchmark():
    benchmark_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "ml", "evaluation", "allocation_benchmark.json"
    )
    if os.path.exists(benchmark_path):
        with open(benchmark_path, "r") as f:
            return json.load(f)
    raise HTTPException(
        status_code=404,
        detail="Benchmark not yet computed. Run backend/app/ml/allocation_benchmark.py first."
    )


@router.get("/yard/rl-evaluation")
def get_rl_evaluation():
    eval_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "ml", "evaluation", "rl_evaluation.json"
    )
    if os.path.exists(eval_path):
        with open(eval_path, "r") as f:
            return json.load(f)
    raise HTTPException(
        status_code=404,
        detail="RL evaluation not yet computed. Run backend/app/ml/evaluation/eval_rl_allocator.py first."
    )


@router.get("/yard/dqn-training-log")
def get_dqn_training_log():
    log_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "ml", "artifacts", "dqn_training_log.json"
    )
    if os.path.exists(log_path):
        with open(log_path, "r") as f:
            return json.load(f)
    raise HTTPException(
        status_code=404,
        detail="DQN training log not found. Run backend/app/ml/training/train_dqn_allocator.py first."
    )
