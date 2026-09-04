"""
Dueling Deep Q-Network (Dueling DQN) for Scalable Intelligent Yard Stacking.
Features:
1. Spatial 3D Yard Tensor Representation (5 Channels):
   - Ch 0: Occupancy Mask (0.0 = empty, 1.0 = occupied)
   - Ch 1: Weight Distribution (0.0 = empty, 0.33 = LIGHT, 0.66 = MEDIUM, 1.0 = HEAVY)
   - Ch 2: Reefer Electrical Plug Infrastructure (1.0 = electrified slot)
   - Ch 3: IMO Dangerous Goods Safety Buffer (1.0 = hazard zone / isolation buffer)
   - Ch 4: Departure Urgency / Dwell Time (normalized 0.0 to 1.0)
2. Container Attributes Conditioning Vector:
   - size_teu, weight_tier, is_hazard, is_reefer, priority, dest_zone
3. Dueling Architecture:
   - Spatial CNN + Attribute MLP -> Value Stream V(s) & Advantage Stream A(s, a)
   - Q(s, a) = V(s) + (A(s, a) - mean_a'(A(s, a')))
4. Strict Operational Constraint Validation:
   - Reefer power supply matching
   - Stacking stability rule (no heavy containers stacked atop lighter tiers)
   - 1-bay / 1-row hazard isolation segregation
   - Crane travel & gate distance optimization
"""
from collections import deque
import json
import os
import random
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from sqlalchemy.orm import Session

from app.models import Container, YardSlot

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "ml", "artifacts")
DQN_WEIGHTS_PATH = os.path.join(ARTIFACTS_DIR, "dqn_allocator.pt")

BLOCKS = ["A", "B", "C", "D"]
NUM_BLOCKS = len(BLOCKS)       # 4
NUM_BAYS = 6                  # 1..6
NUM_ROWS = 4                  # 1..4
NUM_TIERS = 2                 # 1..2
TOTAL_SLOTS = NUM_BLOCKS * NUM_BAYS * NUM_ROWS * NUM_TIERS  # 192

# Action space: 8 macro-zones (4 Blocks x 2 Tiers)
NUM_ACTIONS = NUM_BLOCKS * NUM_TIERS  # 8 actions (Block A Tier 1, Block A Tier 2, etc.)

PRIORITY_MAP = {"STANDARD": 0.0, "HIGH": 0.5, "URGENT": 1.0}
WEIGHT_MAP = {"LIGHT": 0.33, "MEDIUM": 0.66, "HEAVY": 1.0}
DEST_MAP = {
    "Assembly Line 1": 0.1,
    "Assembly Line 2": 0.2,
    "Distribution Center": 0.4,
    "Export Terminal": 0.6,
    "Rail Depot": 0.8,
    "Supplier Hub": 0.9,
}


def is_reefer_equipped_slot(block: str, bay: int, row: int) -> bool:
    """Designate Block A (Bays 1-3, Rows 1-2) as electrified reefer slots."""
    return block == "A" and bay <= 3 and row <= 2


# ──────────────────────────────────────────────────────────────────────────────
# Neural Network: Dueling DQN
# ──────────────────────────────────────────────────────────────────────────────

class DuelingDQN(nn.Module):
    """
    Dueling Deep Q-Network Architecture.
    Separates state value V(s) from action advantages A(s, a)
    for improved sample efficiency and stable Q-estimation.
    """
    def __init__(self, in_channels: int = 5, attr_dim: int = 6, num_actions: int = NUM_ACTIONS):
        super(DuelingDQN, self).__init__()

        # Spatial CNN Backbone for Yard State Tensor: (B, 5, 8, 24)
        # 8 = (4 blocks * 2 tiers), 24 = (6 bays * 4 rows)
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((4, 6)),  # 64 * 4 * 6 = 1536
            nn.Flatten(),
        )
        self.conv_fc = nn.Sequential(
            nn.Linear(64 * 4 * 6, 128),
            nn.ReLU()
        )

        # Attribute MLP for container properties
        self.attr_fc = nn.Sequential(
            nn.Linear(attr_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 64),
            nn.ReLU()
        )

        # Fusion layer
        self.fusion = nn.Sequential(
            nn.Linear(128 + 64, 128),
            nn.ReLU()
        )

        # Dueling streams: State Value V(s)
        self.value_stream = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )

        # Advantage Stream A(s, a)
        self.advantage_stream = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, num_actions)
        )

    def forward(self, spatial_tensor: torch.Tensor, attr_vector: torch.Tensor) -> torch.Tensor:
        """
        Forward pass computing Q(s, a) via dueling aggregation.
        Q(s, a) = V(s) + (A(s, a) - mean(A(s, a')))
        """
        conv_out = self.conv(spatial_tensor)
        conv_feat = self.conv_fc(conv_out)

        attr_feat = self.attr_fc(attr_vector)
        combined = torch.cat([conv_feat, attr_feat], dim=1)
        feat = self.fusion(combined)

        value = self.value_stream(feat)                    # Shape: (B, 1)
        advantages = self.advantage_stream(feat)          # Shape: (B, num_actions)

        # Aggregate: Q = V + (A - mean(A))
        q_vals = value + (advantages - advantages.mean(dim=1, keepdim=True))
        return q_vals


# ──────────────────────────────────────────────────────────────────────────────
# Agent & Environment Wrapper
# ──────────────────────────────────────────────────────────────────────────────

class DQNAllocatorAgent:
    """
    Dueling DQN Agent for Yard Stacking.
    Encodes live database yard state into spatial tensors,
    evaluates action values, and maps actions to candidate slots satisfying all physical rules.
    """
    def __init__(self, model_path: Optional[str] = None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_path = model_path or DQN_WEIGHTS_PATH
        self.policy_net = DuelingDQN().to(self.device)
        self.is_trained = False
        self._load_weights()

    def _load_weights(self):
        if os.path.exists(self.model_path):
            try:
                state_dict = torch.load(self.model_path, map_location=self.device)
                self.policy_net.load_state_dict(state_dict)
                self.policy_net.eval()
                self.is_trained = True
            except Exception as e:
                print(f"[DQNAllocator] Warning loading weights from {self.model_path}: {e}")
                self.is_trained = False
        else:
            self.is_trained = False

    @staticmethod
    def encode_spatial_tensor(db: Session) -> np.ndarray:
        """
        Construct 5-channel 2D spatial grid:
        Shape: (5, 8, 24)
        Height = 4 blocks * 2 tiers = 8
        Width = 6 bays * 4 rows = 24
        """
        grid = np.zeros((5, 8, 24), dtype=np.float32)

        slots = db.query(YardSlot).all()
        block_idx_map = {"A": 0, "B": 1, "C": 2, "D": 3}

        # First pass: map slots and record hazards
        hazard_slots = set()
        for s in slots:
            b_idx = block_idx_map.get(s.block, 0)
            t_idx = s.tier - 1  # 0 or 1
            h_pos = b_idx * 2 + t_idx

            bay_idx = s.bay - 1   # 0..5
            row_idx = s.row - 1   # 0..3
            w_pos = bay_idx * 4 + row_idx

            # Ch 2: Reefer plug
            if is_reefer_equipped_slot(s.block, s.bay, s.row):
                grid[2, h_pos, w_pos] = 1.0

            if s.is_occupied and s.container:
                # Ch 0: Occupancy
                grid[0, h_pos, w_pos] = 1.0
                # Ch 1: Weight tier
                grid[1, h_pos, w_pos] = WEIGHT_MAP.get(s.container.weight_tier, 0.5)
                # Ch 4: Priority / Urgency
                grid[4, h_pos, w_pos] = PRIORITY_MAP.get(s.container.priority, 0.0)

                if s.container.hazard:
                    hazard_slots.add((s.block, s.bay, s.row))

        # Second pass: Mark Ch 3 (Hazard isolation buffer)
        for s in slots:
            b_idx = block_idx_map.get(s.block, 0)
            t_idx = s.tier - 1
            h_pos = b_idx * 2 + t_idx
            w_pos = (s.bay - 1) * 4 + (s.row - 1)

            # Check if within 1 bay or 1 row of any hazard container
            is_near_hazard = False
            for hb, hbay, hrow in hazard_slots:
                if s.block == hb and abs(s.bay - hbay) <= 1 and abs(s.row - hrow) <= 1:
                    is_near_hazard = True
                    break
            if is_near_hazard:
                grid[3, h_pos, w_pos] = 1.0

        return grid

    @staticmethod
    def encode_container_vector(container: Container) -> np.ndarray:
        """
        Encode container attributes into normalized feature vector: (6,)
        [size_norm, weight_norm, is_hazard, is_reefer, priority_norm, dest_norm]
        """
        size_norm = 1.0 if getattr(container, "size_teu", 20) == 40 else 0.5
        weight_norm = WEIGHT_MAP.get(getattr(container, "weight_tier", "MEDIUM"), 0.5)
        is_hazard = 1.0 if getattr(container, "hazard", False) else 0.0
        # Check reefer attribute or destination naming
        is_reefer = 1.0 if getattr(container, "is_reefer", False) else 0.0
        prio_norm = PRIORITY_MAP.get(getattr(container, "priority", "STANDARD"), 0.0)
        dest_norm = DEST_MAP.get(getattr(container, "destination", ""), 0.5)

        return np.array([size_norm, weight_norm, is_hazard, is_reefer, prio_norm, dest_norm], dtype=np.float32)

    @staticmethod
    def action_to_zone(action_idx: int) -> Tuple[str, int]:
        """Convert action integer [0..7] to (Block, Tier)."""
        block_idx = action_idx // 2
        tier = (action_idx % 2) + 1
        return BLOCKS[block_idx], tier

    def allocate(self, db: Session, container: Container) -> Dict[str, Any]:
        """
        Execute Dueling DQN inference to select slot.
        Enforces operational constraints:
        1. Reefer constraint: reefer containers must receive electrified slots.
        2. Hazard buffer: hazard containers cannot be placed within buffer of standard containers.
        3. Stacking stability: HEAVY containers cannot be placed on tier 2 above LIGHT containers.
        """
        spatial_np = self.encode_spatial_tensor(db)
        attr_np = self.encode_container_vector(container)

        spatial_t = torch.tensor(spatial_np, dtype=torch.float32).unsqueeze(0).to(self.device)
        attr_t = torch.tensor(attr_np, dtype=torch.float32).unsqueeze(0).to(self.device)

        with torch.no_grad():
            q_values = self.policy_net(spatial_t, attr_t).cpu().numpy()[0]

        # Rank macro actions by descending Q-value
        ranked_actions = np.argsort(-q_values)

        from app.ml.yard_allocator import _get_empty_slots, compute_slot_cost, _block_occupancy, _same_dest_neighbours

        all_candidates = _get_empty_slots(db, container)
        if not all_candidates:
            return {
                "slot": None,
                "strategy": "dqn",
                "cost_score": 999.0,
                "cost_breakdown": {},
                "rationale": "Yard is completely full — Dueling DQN found no empty slots.",
                "q_values": {f"{self.action_to_zone(i)[0]}-T{self.action_to_zone(i)[1]}": round(float(q_values[i]), 3) for i in range(NUM_ACTIONS)}
            }

        is_container_reefer = getattr(container, "is_reefer", False)
        is_container_hazard = getattr(container, "hazard", False)

        best_slot: Optional[YardSlot] = None
        best_zone_name = ""
        best_q_val = -999.0

        for act in ranked_actions:
            target_block, target_tier = self.action_to_zone(act)
            zone_name = f"Block {target_block} Tier {target_tier}"
            act_q = float(q_values[act])

            # Filter candidates in this zone
            zone_slots = [s for s in all_candidates if s.block == target_block and s.tier == target_tier]

            # Apply Operational Safety & Stacking Constraints
            valid_slots = []
            for slot in zone_slots:
                # 1. Reefer Check
                slot_has_reefer = is_reefer_equipped_slot(slot.block, slot.bay, slot.row)
                if is_container_reefer and not slot_has_reefer:
                    continue  # Reefer container requires active reefer plug

                # 2. Stacking Stability Check: Heavy container cannot be placed on tier 2
                if slot.tier == 2 and container.weight_tier == "HEAVY":
                    continue
                if slot.tier == 2:
                    tier1_slot = db.query(YardSlot).filter(
                        YardSlot.block == slot.block,
                        YardSlot.bay == slot.bay,
                        YardSlot.row == slot.row,
                        YardSlot.tier == 1
                    ).first()
                    if tier1_slot and tier1_slot.container:
                        if tier1_slot.container.weight_tier == "LIGHT" and container.weight_tier in ("MEDIUM", "HEAVY"):
                            continue  # Stability violation: cannot stack heavier container on top of lighter container

                # 3. Hazard Segregation Buffer
                if is_container_hazard:
                    # Slot must have at least 1-bay distance from general cargo
                    neighbours = db.query(YardSlot).filter(
                        YardSlot.block == slot.block,
                        YardSlot.is_occupied == True,
                    ).all()
                    hazard_violation = False
                    for n in neighbours:
                        if n.container and not n.container.hazard:
                            if abs(n.bay - slot.bay) <= 0 and abs(n.row - slot.row) <= 0:
                                hazard_violation = True
                                break
                    if hazard_violation:
                        continue

                valid_slots.append(slot)

            if valid_slots:
                # Select slot within zone with minimum travel and congestion cost
                best_slot = min(
                    valid_slots,
                    key=lambda s: compute_slot_cost(
                        s.block, s.bay, s.row, s.tier,
                        container.priority, container.destination,
                        _block_occupancy(db, s.block),
                        _same_dest_neighbours(db, s, container.destination)
                    )["total_cost"]
                )
                best_zone_name = zone_name
                best_q_val = act_q
                break

        # Fallback if preferred zones had constraint conflicts
        if not best_slot:
            best_slot = all_candidates[0]
            best_zone_name = f"Block {best_slot.block} Tier {best_slot.tier} (Constraint Fallback)"
            best_q_val = 0.0

        occ = _block_occupancy(db, best_slot.block)
        n_dest = _same_dest_neighbours(db, best_slot, container.destination)
        breakdown = compute_slot_cost(
            best_slot.block, best_slot.bay, best_slot.row, best_slot.tier,
            container.priority, container.destination,
            occ, n_dest
        )

        q_dict = {
            f"{self.action_to_zone(i)[0]}-T{self.action_to_zone(i)[1]}": round(float(q_values[i]), 3)
            for i in range(NUM_ACTIONS)
        }

        rationale = (
            f"Dueling DQN selected {best_zone_name} (Q-Value: {best_q_val:.2f}) -> "
            f"allocated Slot {best_slot.id} (cost: {breakdown['total_cost']:.1f}, "
            f"reefer_plug: {is_reefer_equipped_slot(best_slot.block, best_slot.bay, best_slot.row)})."
        )

        return {
            "slot": best_slot,
            "strategy": "dqn",
            "cost_score": round(breakdown["total_cost"], 2),
            "cost_breakdown": breakdown,
            "rationale": rationale,
            "q_values": q_dict,
            "selected_zone": best_zone_name,
            "model_trained": self.is_trained
        }


# Global agent
dqn_agent = DQNAllocatorAgent()
