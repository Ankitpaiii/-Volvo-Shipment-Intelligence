"""
Yard Slot Allocation Module — Phase 3.

Implements four allocation strategies:
1. First-Fit (Baseline)       — first available slot ordered by (block, bay, row, tier)
2. Nearest Available          — minimises true Manhattan distance from the yard gate
3. Intelligent Cost-Based     — minimises named multi-component cost function
4. Q-Learning RL              — loads trained Q-table and resolves a zone-action

Geometry & Coordinate System
------------------------------
Gate is located at (x=0, y=0).
Slot (x, y) coordinates:
    x = bay number   (1..6)
    y = block_index * 5 + row   (block_index: A=0, B=1, C=2, D=3; row: 1..4)
Block A is closest to the gate, Block D is furthest.
Manhattan distance = x + y = bay + (block_index * 5 + row)

Cost Function (named, transparent weights)
------------------------------------------
    movement_cost     = bay * 2.5  +  row * 1.5
    retrieval_cost    = (tier - 1) * 8.0
    congestion_penalty= block_occupancy_fraction * 20.0
    blocking_penalty  = 15.0  if STANDARD/HIGH priority placed in Block A
    priority_penalty  = 25.0  if URGENT priority placed in Block C or D
    cluster_bonus     = 12.0 * n_same_destination_neighbours   (POSITIVE, subtracted)

    total_cost = (movement_cost + retrieval_cost + congestion_penalty
                 + blocking_penalty + priority_penalty - cluster_bonus)

RL reward = -total_cost
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sqlalchemy.orm import Session

from app.models import Container, YardSlot

# ──────────────────────────────────────────────────────────────────────────────
# Geometry helpers
# ──────────────────────────────────────────────────────────────────────────────

BLOCK_ORDER = {"A": 0, "B": 1, "C": 2, "D": 3}
GATE_X = 0  # gate is at x=0 (before bay 1)
GATE_Y = 0  # gate is at y=0 (before block A)


def slot_coordinates(block: str, bay: int, row: int) -> Tuple[int, int]:
    """Return (x, y) coordinate of a slot relative to the yard gate."""
    x = bay
    y = BLOCK_ORDER[block] * 5 + row
    return x, y


def manhattan_distance_to_gate(block: str, bay: int, row: int) -> int:
    x, y = slot_coordinates(block, bay, row)
    return abs(x - GATE_X) + abs(y - GATE_Y)


# ──────────────────────────────────────────────────────────────────────────────
# Cost function (shared between intelligent allocator and RL environment)
# ──────────────────────────────────────────────────────────────────────────────

def compute_slot_cost(
    slot_block: str,
    slot_bay: int,
    slot_row: int,
    slot_tier: int,
    container_priority: str,
    container_destination: str,
    block_occupancy_fraction: float,
    same_dest_neighbour_count: int,
) -> Dict[str, float]:
    """
    Compute named cost components for placing a container in the given slot.
    Returns a dict with each component and total_cost.
    """
    movement_cost = slot_bay * 2.5 + slot_row * 1.5
    retrieval_cost = (slot_tier - 1) * 8.0
    congestion_penalty = block_occupancy_fraction * 20.0

    # Blocking penalty: non-urgent container in Block A wastes prime gate-side space
    blocking_penalty = 0.0
    if slot_block == "A" and container_priority == "STANDARD":
        blocking_penalty = 15.0

    # Priority penalty: urgent container forced away from gate blocks
    priority_penalty = 0.0
    if container_priority == "URGENT" and slot_block in ("C", "D"):
        priority_penalty = 25.0

    # Cluster bonus: positive reward for placing near same-destination containers
    cluster_bonus = 12.0 * same_dest_neighbour_count

    total_cost = (
        movement_cost
        + retrieval_cost
        + congestion_penalty
        + blocking_penalty
        + priority_penalty
        - cluster_bonus
    )

    return {
        "movement_cost": round(movement_cost, 2),
        "retrieval_cost": round(retrieval_cost, 2),
        "congestion_penalty": round(congestion_penalty, 2),
        "blocking_penalty": round(blocking_penalty, 2),
        "priority_penalty": round(priority_penalty, 2),
        "cluster_bonus": round(cluster_bonus, 2),
        "total_cost": round(total_cost, 2),
    }


# ──────────────────────────────────────────────────────────────────────────────
# DB helpers
# ──────────────────────────────────────────────────────────────────────────────

def _is_tier2_supported(db: Session, slot: YardSlot) -> bool:
    """True if tier-1 slot below this tier-2 slot is occupied (physical constraint)."""
    if slot.tier != 2:
        return True
    tier1 = (
        db.query(YardSlot)
        .filter(
            YardSlot.block == slot.block,
            YardSlot.bay == slot.bay,
            YardSlot.row == slot.row,
            YardSlot.tier == 1,
        )
        .first()
    )
    return bool(tier1 and tier1.is_occupied)


def _block_occupancy(db: Session, block: str) -> float:
    """Return fraction of occupied slots in a given block."""
    slots = db.query(YardSlot).filter(YardSlot.block == block).all()
    if not slots:
        return 0.0
    return sum(1 for s in slots if s.is_occupied) / len(slots)


def _same_dest_neighbours(db: Session, slot: YardSlot, destination: str) -> int:
    """Count neighbouring occupied slots in the same bay with matching destination."""
    neighbours = (
        db.query(YardSlot)
        .filter(
            YardSlot.block == slot.block,
            YardSlot.bay == slot.bay,
            YardSlot.is_occupied == True,
        )
        .all()
    )
    return sum(
        1 for n in neighbours
        if n.container and n.container.destination == destination
    )


def _get_empty_slots(db: Session, container: Container) -> List[YardSlot]:
    """Return all empty slots that satisfy physical stacking constraints."""
    candidates = []
    for slot in db.query(YardSlot).filter(YardSlot.is_occupied == False).all():
        if slot.tier == 2 and not _is_tier2_supported(db, slot):
            continue
        if slot.tier == 2 and container.weight_tier == "HEAVY":
            continue  # Heavy containers must stay on tier 1
        candidates.append(slot)
    return candidates


# ──────────────────────────────────────────────────────────────────────────────
# Allocator
# ──────────────────────────────────────────────────────────────────────────────

class YardSlotAllocator:
    """Four allocation strategies, all using the same shared cost function."""

    # ── 1. First-Fit Baseline ────────────────────────────────────────────────

    @staticmethod
    def allocate_baseline(db: Session, container: Container) -> Optional[YardSlot]:
        """
        Strategy 1 — First-Fit: return the first available slot ordered
        by (block, bay, row, tier).  No cost optimisation.
        """
        empty_slots = (
            db.query(YardSlot)
            .filter(YardSlot.is_occupied == False)
            .order_by(YardSlot.block, YardSlot.bay, YardSlot.row, YardSlot.tier)
            .all()
        )
        for slot in empty_slots:
            if slot.tier == 2 and not _is_tier2_supported(db, slot):
                continue
            if slot.tier == 2 and container.weight_tier == "HEAVY":
                continue
            return slot
        return None

    # ── 2. Nearest Available ─────────────────────────────────────────────────

    @staticmethod
    def allocate_nearest(db: Session, container: Container) -> Optional[YardSlot]:
        """
        Strategy 2 — Nearest Available: return the structurally valid empty slot
        with the smallest Manhattan distance from the yard gate.

        Gate coordinate: (x=0, y=0)
        Slot coordinate: x=bay, y=(block_index*5 + row)
        Distance = bay + (block_index*5 + row)
        """
        candidates = _get_empty_slots(db, container)
        if not candidates:
            return None
        return min(candidates, key=lambda s: manhattan_distance_to_gate(s.block, s.bay, s.row))

    # ── 3. Intelligent Cost-Based ────────────────────────────────────────────

    @staticmethod
    def allocate_intelligent(db: Session, container: Container) -> Dict[str, Any]:
        """
        Strategy 3 — Intelligent: minimise the named multi-component cost function.
        Returns a dict with slot, strategy, cost_breakdown, cost_score, rationale.
        """
        candidates = _get_empty_slots(db, container)
        if not candidates:
            return {
                "slot": None,
                "strategy": "intelligent",
                "cost_score": 999.0,
                "cost_breakdown": {},
                "rationale": "Yard is completely full",
            }

        scored: List[Tuple[float, Dict[str, float], YardSlot]] = []

        for slot in candidates:
            occ = _block_occupancy(db, slot.block)
            n_dest = _same_dest_neighbours(db, slot, container.destination)
            breakdown = compute_slot_cost(
                slot_block=slot.block,
                slot_bay=slot.bay,
                slot_row=slot.row,
                slot_tier=slot.tier,
                container_priority=container.priority,
                container_destination=container.destination,
                block_occupancy_fraction=occ,
                same_dest_neighbour_count=n_dest,
            )
            scored.append((breakdown["total_cost"], breakdown, slot))

        scored.sort(key=lambda x: x[0])
        best_cost, best_breakdown, best_slot = scored[0]

        rationale = (
            f"Block {best_slot.block} Bay {best_slot.bay} Row {best_slot.row} "
            f"Tier {best_slot.tier}: movement={best_breakdown['movement_cost']}, "
            f"retrieval={best_breakdown['retrieval_cost']}, "
            f"congestion={best_breakdown['congestion_penalty']}, "
            f"blocking={best_breakdown['blocking_penalty']}, "
            f"priority_pen={best_breakdown['priority_penalty']}, "
            f"cluster_bonus={best_breakdown['cluster_bonus']}, "
            f"total={best_cost}"
        )

        return {
            "slot": best_slot,
            "strategy": "intelligent",
            "cost_score": round(best_cost, 2),
            "cost_breakdown": best_breakdown,
            "rationale": rationale,
        }

    # ── 4. RL Q-Learning ─────────────────────────────────────────────────────

    @staticmethod
    def allocate_rl(db: Session, container: Container) -> Dict[str, Any]:
        """
        Strategy 4 — RL Q-Learning: load trained Q-table and resolve zone-action
        to a concrete slot. Falls back to Intelligent if Q-table unavailable.
        """
        q_table_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "artifacts", "q_table.npy"
        )

        if not os.path.exists(q_table_path):
            # RL not yet trained — fall back to intelligent allocator
            result = YardSlotAllocator.allocate_intelligent(db, container)
            result["strategy"] = "intelligent_fallback_no_rl"
            return result

        try:
            from app.ml.rl_allocator import RLYardAllocator
            rl_agent = RLYardAllocator.load(q_table_path)

            # Build occupancy snapshot for state encoding
            all_slots = db.query(YardSlot).all()
            occupied_ids = {s.id for s in all_slots if s.is_occupied}
            total = len(all_slots)
            occupancy_pct = len(occupied_ids) / max(1, total) * 100.0

            zone_action = rl_agent.select_action(
                occupancy_pct=occupancy_pct,
                priority=container.priority,
                weight_tier=container.weight_tier,
                size_teu=container.size_teu,
                destination=container.destination,
            )

            # Resolve zone-action to a concrete slot
            target_block = zone_action["block"]
            target_tier = zone_action["tier"]

            candidates = _get_empty_slots(db, container)
            zone_candidates = [
                s for s in candidates
                if s.block == target_block and s.tier == target_tier
            ]

            if not zone_candidates:
                # Zone empty — fallback to global intelligent
                zone_candidates = candidates

            if not zone_candidates:
                return {
                    "slot": None,
                    "strategy": "rl",
                    "cost_score": 999.0,
                    "cost_breakdown": {},
                    "rationale": "Yard full — RL could not find a slot",
                }

            # Within zone: pick the slot with minimum cost
            best = min(
                zone_candidates,
                key=lambda s: compute_slot_cost(
                    s.block, s.bay, s.row, s.tier,
                    container.priority, container.destination,
                    _block_occupancy(db, s.block),
                    _same_dest_neighbours(db, s, container.destination),
                )["total_cost"],
            )

            occ = _block_occupancy(db, best.block)
            n_dest = _same_dest_neighbours(db, best, container.destination)
            breakdown = compute_slot_cost(
                best.block, best.bay, best.row, best.tier,
                container.priority, container.destination,
                occ, n_dest,
            )

            return {
                "slot": best,
                "strategy": "rl_qlearning",
                "cost_score": round(breakdown["total_cost"], 2),
                "cost_breakdown": breakdown,
                "rationale": (
                    f"RL Q-Learning selected zone Block {target_block} Tier {target_tier}, "
                    f"resolved to slot {best.id} with total cost {breakdown['total_cost']}"
                ),
                "rl_zone_action": f"Block {target_block} Tier {target_tier}",
            }

        except Exception as exc:
            # Any RL failure → fall back to intelligent, never crash the API
            result = YardSlotAllocator.allocate_intelligent(db, container)
            result["strategy"] = f"intelligent_fallback_rl_error"
            result["rl_error"] = str(exc)
            return result

    # ── 5. Deep Reinforcement Learning (Dueling DQN) ─────────────────────────

    @staticmethod
    def allocate_dqn(db: Session, container: Container) -> Dict[str, Any]:
        """
        Strategy 5 — Dueling Deep Q-Network:
        Passes live 5-channel 3D spatial tensor and container conditioning vector
        through Dueling DQN neural network, validates reefer, hazard buffer, and
        stacking stability constraints, and selects optimal slot.
        """
        try:
            from app.ml.dqn_allocator import dqn_agent
            return dqn_agent.allocate(db, container)
        except Exception as exc:
            # Fallback to intelligent if DQN fails
            result = YardSlotAllocator.allocate_intelligent(db, container)
            result["strategy"] = "intelligent_fallback_dqn_error"
            result["dqn_error"] = str(exc)
            return result

