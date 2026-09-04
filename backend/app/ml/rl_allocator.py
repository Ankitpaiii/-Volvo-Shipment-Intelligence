"""
RL Yard Allocation Environment and Q-Learning Agent.

Environment formulation
-----------------------
- State: compact 5-feature tuple (occupancy_bin, priority, weight_tier, size_teu, dest_zone)
- Action: zone-selection (block A/B/C/D × tier 1/2) → 8 discrete actions
- Reward: -total_cost  (negative operational cost)

Episode structure
-----------------
Each episode represents a sequence of container arrivals in a single yard session.
The yard state evolves across arrivals within the episode:

    t=0: yard reset (all slots empty or partially pre-filled)
    t=1: container_1 arrives → choose zone → place → yard changes → R_1
    t=2: container_2 arrives → choose zone → place → yard changes → R_2
    ...
    t=T: episode ends (yard full or max arrivals reached)

This creates genuine sequential state transitions:
    S_t → A_t → R_t → S_(t+1)

Yard Coordinate System
----------------------
Gate = (x=0, y=0)
Slot coordinate: x=bay, y=(block_index*5 + row)
Block order (nearest gate): A=0, B=1, C=2, D=3
Manhattan distance = bay + (block_index*5 + row)

Destination Zones
-----------------
4 categories derived from destination string initial character:
    zone 0: A-F (near/regional)
    zone 1: G-M
    zone 2: N-S
    zone 3: T-Z (far/intercontinental)
"""
from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.ml.yard_allocator import compute_slot_cost, manhattan_distance_to_gate, BLOCK_ORDER

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

BLOCKS = ["A", "B", "C", "D"]
BAYS = list(range(1, 7))    # 1..6
ROWS = list(range(1, 5))    # 1..4
TIERS = [1, 2]

TOTAL_SLOTS = len(BLOCKS) * len(BAYS) * len(ROWS) * len(TIERS)  # 192

PRIORITIES = ["STANDARD", "HIGH", "URGENT"]
WEIGHT_TIERS = ["LIGHT", "MEDIUM", "HEAVY"]
SIZE_TEUS = [20, 40]
DESTINATIONS = [
    "Amsterdam", "Barcelona", "Cairo", "Dubai", "Hamburg", "Istanbul",
    "Jakarta", "Karachi", "London", "Manila", "Naples", "Oslo",
    "Panama", "Qatar", "Rotterdam", "Singapore", "Tokyo", "Valencia",
]

# Action space: 8 zone-actions (4 blocks × 2 tiers)
ZONE_ACTIONS = [(block, tier) for block in BLOCKS for tier in TIERS]
N_ACTIONS = len(ZONE_ACTIONS)  # 8

# Occupancy bins (5 bins)
OCC_BINS = [0, 20, 40, 60, 80, 100]
N_OCC_BINS = 5

# Destination zones (4)
N_DEST_ZONES = 4


def destination_zone(destination: str) -> int:
    """Map destination string to zone 0..3 based on first character."""
    if not destination:
        return 0
    c = destination[0].upper()
    if c <= "F":
        return 0
    elif c <= "M":
        return 1
    elif c <= "S":
        return 2
    else:
        return 3


def encode_state(
    occupancy_pct: float,
    priority: str,
    weight_tier: str,
    size_teu: int,
    destination: str,
) -> Tuple[int, int, int, int, int]:
    """Encode container + yard state into a discrete 5-tuple for Q-table lookup."""
    occ_bin = min(int(occupancy_pct // 20), N_OCC_BINS - 1)
    prio_idx = PRIORITIES.index(priority) if priority in PRIORITIES else 0
    wt_idx = WEIGHT_TIERS.index(weight_tier) if weight_tier in WEIGHT_TIERS else 1
    teu_idx = 0 if size_teu <= 20 else 1
    dest_idx = destination_zone(destination)
    return (occ_bin, prio_idx, wt_idx, teu_idx, dest_idx)


def state_to_index(state: Tuple[int, int, int, int, int]) -> int:
    occ, prio, wt, teu, dest = state
    return (
        occ * (3 * 3 * 2 * N_DEST_ZONES)
        + prio * (3 * 2 * N_DEST_ZONES)
        + wt * (2 * N_DEST_ZONES)
        + teu * N_DEST_ZONES
        + dest
    )


N_STATES = N_OCC_BINS * 3 * 3 * 2 * N_DEST_ZONES  # 360


# ──────────────────────────────────────────────────────────────────────────────
# Pure-Python yard simulation (no DB — used for RL training and benchmark)
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class ContainerSpec:
    priority: str
    weight_tier: str
    size_teu: int
    destination: str
    hazard: bool = False


@dataclass
class SlotSpec:
    block: str
    bay: int
    row: int
    tier: int
    occupied: bool = False
    container: Optional[ContainerSpec] = None

    @property
    def id(self) -> str:
        return f"{self.block}-{self.bay:02d}-{self.row:02d}-{self.tier}"

    @property
    def manhattan_distance(self) -> int:
        return manhattan_distance_to_gate(self.block, self.bay, self.row)


def build_yard() -> Dict[str, SlotSpec]:
    """Build a fresh in-memory yard (all slots empty)."""
    yard: Dict[str, SlotSpec] = {}
    for block in BLOCKS:
        for bay in BAYS:
            for row in ROWS:
                for tier in TIERS:
                    s = SlotSpec(block=block, bay=bay, row=row, tier=tier)
                    yard[s.id] = s
    return yard


def get_empty_slots_sim(yard: Dict[str, SlotSpec], container: ContainerSpec) -> List[SlotSpec]:
    """Return feasible empty slots given physical constraints."""
    result = []
    for slot in yard.values():
        if slot.occupied:
            continue
        if slot.tier == 2:
            tier1_id = f"{slot.block}-{slot.bay:02d}-{slot.row:02d}-1"
            if not yard.get(tier1_id, SlotSpec(slot.block, slot.bay, slot.row, 1)).occupied:
                continue  # Cannot stack on empty tier 1
        if slot.tier == 2 and container.weight_tier == "HEAVY":
            continue  # Heavy on tier 1 only
        result.append(slot)
    return result


def block_occupancy_sim(yard: Dict[str, SlotSpec], block: str) -> float:
    """Occupancy fraction of a specific block."""
    block_slots = [s for s in yard.values() if s.block == block]
    if not block_slots:
        return 0.0
    return sum(1 for s in block_slots if s.occupied) / len(block_slots)


def same_dest_neighbours_sim(
    yard: Dict[str, SlotSpec], slot: SlotSpec, destination: str
) -> int:
    """Count same-bay occupied neighbours with matching destination."""
    return sum(
        1 for s in yard.values()
        if s.block == slot.block and s.bay == slot.bay and s.occupied
        and s.container and s.container.destination == destination
    )


def compute_cost_sim(
    slot: SlotSpec,
    container: ContainerSpec,
    yard: Dict[str, SlotSpec],
) -> Dict[str, float]:
    """Apply the shared cost function to a simulation slot."""
    occ = block_occupancy_sim(yard, slot.block)
    n_dest = same_dest_neighbours_sim(yard, slot, container.destination)
    return compute_slot_cost(
        slot_block=slot.block,
        slot_bay=slot.bay,
        slot_row=slot.row,
        slot_tier=slot.tier,
        container_priority=container.priority,
        container_destination=container.destination,
        block_occupancy_fraction=occ,
        same_dest_neighbour_count=n_dest,
    )


def place_container_sim(
    yard: Dict[str, SlotSpec], slot: SlotSpec, container: ContainerSpec
) -> None:
    """Place container in slot (mutates yard in-place)."""
    slot.occupied = True
    slot.container = container


def sample_container(rng: random.Random) -> ContainerSpec:
    """Generate a random container with realistic distribution."""
    priority_weights = [0.6, 0.3, 0.1]  # STANDARD, HIGH, URGENT
    priority = rng.choices(PRIORITIES, weights=priority_weights, k=1)[0]
    weight_tier = rng.choice(WEIGHT_TIERS)
    size_teu = rng.choices([20, 40], weights=[0.7, 0.3], k=1)[0]
    destination = rng.choice(DESTINATIONS)
    return ContainerSpec(
        priority=priority,
        weight_tier=weight_tier,
        size_teu=size_teu,
        destination=destination,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Q-Learning Agent
# ──────────────────────────────────────────────────────────────────────────────

class QLearningAgent:
    """
    Tabular Q-Learning agent for yard slot zone-selection.

    State:  encode_state(occupancy_pct, priority, weight_tier, size_teu, destination)
    Action: index into ZONE_ACTIONS  →  (block, tier)
    Q-table shape: (N_STATES, N_ACTIONS) = (360, 8)
    """

    def __init__(
        self,
        alpha: float = 0.1,
        gamma: float = 0.9,
        epsilon: float = 1.0,
        epsilon_min: float = 0.05,
    ):
        self.alpha = alpha
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_min = epsilon_min
        self.q_table = np.zeros((N_STATES, N_ACTIONS), dtype=np.float32)
        self.training_log: List[Dict[str, Any]] = []

    def get_q(self, state: Tuple) -> np.ndarray:
        return self.q_table[state_to_index(state)]

    def select_action(self, state: Tuple, available_actions: Optional[List[int]] = None) -> int:
        """ε-greedy action selection, optionally masked to available actions."""
        if available_actions is None:
            available_actions = list(range(N_ACTIONS))

        if random.random() < self.epsilon:
            return random.choice(available_actions)

        q_vals = self.get_q(state)
        # Mask unavailable actions to -inf
        masked = np.full(N_ACTIONS, -np.inf)
        for a in available_actions:
            masked[a] = q_vals[a]
        return int(np.argmax(masked))

    def update(
        self,
        state: Tuple,
        action: int,
        reward: float,
        next_state: Tuple,
        done: bool,
    ) -> None:
        si = state_to_index(state)
        nsi = state_to_index(next_state)
        target = reward if done else reward + self.gamma * float(np.max(self.q_table[nsi]))
        self.q_table[si, action] += self.alpha * (target - self.q_table[si, action])

    def decay_epsilon(self, episode: int, total_episodes: int) -> None:
        """Linear decay from 1.0 to epsilon_min over training."""
        progress = episode / max(1, total_episodes - 1)
        self.epsilon = max(self.epsilon_min, 1.0 - progress * (1.0 - self.epsilon_min))

    def save(self, q_table_path: str, log_path: str) -> None:
        os.makedirs(os.path.dirname(q_table_path), exist_ok=True)
        np.save(q_table_path, self.q_table)
        with open(log_path, "w") as f:
            json.dump(self.training_log, f, indent=2)

    @classmethod
    def load(cls, q_table_path: str) -> "QLearningAgent":
        agent = cls(epsilon=0.0)  # No exploration at inference
        agent.q_table = np.load(q_table_path)
        return agent

    def select_action_greedy(
        self,
        occupancy_pct: float,
        priority: str,
        weight_tier: str,
        size_teu: int,
        destination: str,
    ) -> Dict[str, Any]:
        """Greedy (no exploration) action for inference — used by the API."""
        state = encode_state(occupancy_pct, priority, weight_tier, size_teu, destination)
        q_vals = self.get_q(state)
        action_idx = int(np.argmax(q_vals))
        block, tier = ZONE_ACTIONS[action_idx]
        return {
            "action_idx": action_idx,
            "block": block,
            "tier": tier,
            "q_value": float(q_vals[action_idx]),
        }

    # Alias for the allocator to call
    def select_action_for_api(
        self,
        occupancy_pct: float,
        priority: str,
        weight_tier: str,
        size_teu: int,
        destination: str,
    ) -> Dict[str, Any]:
        return self.select_action_greedy(occupancy_pct, priority, weight_tier, size_teu, destination)


# ──────────────────────────────────────────────────────────────────────────────
# RLYardAllocator — thin wrapper loaded by yard_allocator.py
# ──────────────────────────────────────────────────────────────────────────────

class RLYardAllocator:
    def __init__(self, agent: QLearningAgent):
        self.agent = agent

    @classmethod
    def load(cls, q_table_path: str) -> "RLYardAllocator":
        agent = QLearningAgent.load(q_table_path)
        return cls(agent)

    def select_action(
        self,
        occupancy_pct: float,
        priority: str,
        weight_tier: str,
        size_teu: int,
        destination: str,
    ) -> Dict[str, Any]:
        return self.agent.select_action_for_api(
            occupancy_pct, priority, weight_tier, size_teu, destination
        )


# ──────────────────────────────────────────────────────────────────────────────
# Training environment (used only by train_rl_allocator.py)
# ──────────────────────────────────────────────────────────────────────────────

def get_available_zone_actions(yard: Dict[str, SlotSpec], container: ContainerSpec) -> List[int]:
    """Return action indices for zones that have at least one feasible slot."""
    feasible = get_empty_slots_sim(yard, container)
    available = set()
    for slot in feasible:
        block = slot.block
        tier = slot.tier
        try:
            idx = ZONE_ACTIONS.index((block, tier))
            available.add(idx)
        except ValueError:
            pass
    return sorted(available) if available else list(range(N_ACTIONS))


def resolve_zone_action_sim(
    yard: Dict[str, SlotSpec],
    container: ContainerSpec,
    action_idx: int,
) -> Optional[SlotSpec]:
    """
    Resolve a zone-action to a concrete slot.
    If the target zone has no available slot, fall back to global best.
    """
    target_block, target_tier = ZONE_ACTIONS[action_idx]
    feasible = get_empty_slots_sim(yard, container)
    zone_slots = [s for s in feasible if s.block == target_block and s.tier == target_tier]

    if not zone_slots:
        # Zone unavailable — use global feasible set
        zone_slots = feasible

    if not zone_slots:
        return None

    # Within zone: pick lowest cost slot
    return min(zone_slots, key=lambda s: compute_cost_sim(s, container, yard)["total_cost"])


def run_episode(
    agent: QLearningAgent,
    rng: random.Random,
    episode_length: int = 30,
    train: bool = True,
) -> Tuple[float, List[float]]:
    """
    Run one sequential episode.
    Returns (total_episode_reward, per_step_rewards).
    """
    yard = build_yard()
    total_reward = 0.0
    step_rewards: List[float] = []

    container = sample_container(rng)

    for t in range(episode_length):
        occupancy_pct = (
            sum(1 for s in yard.values() if s.occupied) / TOTAL_SLOTS * 100.0
        )
        state = encode_state(
            occupancy_pct,
            container.priority,
            container.weight_tier,
            container.size_teu,
            container.destination,
        )

        available_actions = get_available_zone_actions(yard, container)
        if not available_actions:
            break  # Yard full

        action_idx = agent.select_action(state, available_actions) if train else \
            agent.select_action(state, available_actions)

        slot = resolve_zone_action_sim(yard, container, action_idx)
        if slot is None:
            break

        cost_breakdown = compute_cost_sim(slot, container, yard)
        reward = -cost_breakdown["total_cost"]
        place_container_sim(yard, slot, container)

        # Next container for next-state encoding
        next_container = sample_container(rng)
        next_occupancy_pct = (
            sum(1 for s in yard.values() if s.occupied) / TOTAL_SLOTS * 100.0
        )
        next_state = encode_state(
            next_occupancy_pct,
            next_container.priority,
            next_container.weight_tier,
            next_container.size_teu,
            next_container.destination,
        )

        done = (t == episode_length - 1)
        if train:
            agent.update(state, action_idx, reward, next_state, done)

        total_reward += reward
        step_rewards.append(reward)
        container = next_container

    return total_reward, step_rewards
