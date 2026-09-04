"""
Pure-Python allocation benchmark for all 4 strategies.

Simulates 1,000 container arrivals on a clean in-memory yard (no DB writes).
All strategies see the SAME arrival sequence (same random seed).

Saves results to backend/app/ml/evaluation/allocation_benchmark.json
"""
from __future__ import annotations

import json
import os
import random
import sys
import time
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.ml.rl_allocator import (
    ZONE_ACTIONS,
    build_yard,
    compute_cost_sim,
    get_available_zone_actions,
    get_empty_slots_sim,
    manhattan_distance_to_gate,
    place_container_sim,
    resolve_zone_action_sim,
    run_episode,
    sample_container,
)

SEED = 42
N_ARRIVALS = 1_000
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "evaluation", "allocation_benchmark.json")


# ──────────────────────────────────────────────────────────────────────────────
# Strategy implementations (pure-Python, no DB)
# ──────────────────────────────────────────────────────────────────────────────

def strategy_first_fit(yard, container):
    """First-Fit: ordered by block, bay, row, tier."""
    candidates = get_empty_slots_sim(yard, container)
    if not candidates:
        return None
    from app.ml.rl_allocator import BLOCK_ORDER
    return min(candidates, key=lambda s: (BLOCK_ORDER[s.block], s.bay, s.row, s.tier))


def strategy_nearest(yard, container):
    """Nearest: minimum Manhattan distance from gate."""
    candidates = get_empty_slots_sim(yard, container)
    if not candidates:
        return None
    return min(candidates, key=lambda s: s.manhattan_distance)


def strategy_intelligent(yard, container):
    """Intelligent: minimise named multi-component cost function."""
    candidates = get_empty_slots_sim(yard, container)
    if not candidates:
        return None
    return min(candidates, key=lambda s: compute_cost_sim(s, container, yard)["total_cost"])


def strategy_rl(yard, container, agent):
    """Q-Learning: select zone then resolve to slot."""
    if agent is None:
        return strategy_intelligent(yard, container)

    from app.ml.rl_allocator import encode_state, TOTAL_SLOTS, QLearningAgent
    occ_pct = sum(1 for s in yard.values() if s.occupied) / TOTAL_SLOTS * 100.0
    state = encode_state(
        occ_pct, container.priority, container.weight_tier,
        container.size_teu, container.destination,
    )
    avail = get_available_zone_actions(yard, container)
    if not avail:
        return strategy_intelligent(yard, container)
    action_idx = agent.select_action(state, avail)
    return resolve_zone_action_sim(yard, container, action_idx)


def record_allocation(slot, container, yard) -> Dict[str, Any]:
    """Compute and record metrics for a single allocation decision."""
    if slot is None:
        return {
            "success": False,
            "movement_cost": 0,
            "retrieval_cost": 0,
            "congestion_penalty": 0,
            "blocking_penalty": 0,
            "priority_penalty": 0,
            "cluster_bonus": 0,
            "total_cost": 999,
            "manhattan_distance": 0,
            "blocked_access": False,
        }
    breakdown = compute_cost_sim(slot, container, yard)
    blocked = container.priority == "URGENT" and slot.block in ("C", "D")
    return {
        "success": True,
        "movement_cost": breakdown["movement_cost"],
        "retrieval_cost": breakdown["retrieval_cost"],
        "congestion_penalty": breakdown["congestion_penalty"],
        "blocking_penalty": breakdown["blocking_penalty"],
        "priority_penalty": breakdown["priority_penalty"],
        "cluster_bonus": breakdown["cluster_bonus"],
        "total_cost": breakdown["total_cost"],
        "manhattan_distance": slot.manhattan_distance,
        "blocked_access": blocked,
    }


def aggregate(records: List[Dict]) -> Dict[str, Any]:
    success = [r for r in records if r["success"]]
    n = max(1, len(success))
    return {
        "n_total": len(records),
        "n_success": len(success),
        "avg_total_cost": round(sum(r["total_cost"] for r in success) / n, 4),
        "avg_movement_cost": round(sum(r["movement_cost"] for r in success) / n, 4),
        "avg_retrieval_cost": round(sum(r["retrieval_cost"] for r in success) / n, 4),
        "avg_congestion_penalty": round(sum(r["congestion_penalty"] for r in success) / n, 4),
        "avg_blocking_penalty": round(sum(r["blocking_penalty"] for r in success) / n, 4),
        "avg_priority_penalty": round(sum(r["priority_penalty"] for r in success) / n, 4),
        "avg_cluster_bonus": round(sum(r["cluster_bonus"] for r in success) / n, 4),
        "avg_manhattan_distance": round(sum(r["manhattan_distance"] for r in success) / n, 4),
        "blocked_access_count": sum(1 for r in success if r["blocked_access"]),
        "blocked_access_rate_pct": round(sum(1 for r in success if r["blocked_access"]) / n * 100, 2),
        "avg_reward": round(sum(-r["total_cost"] for r in success) / n, 4),
    }


def run_benchmark() -> Dict[str, Any]:
    rng = random.Random(SEED)

    # Load RL agent if available
    q_table_path = os.path.join(
        os.path.dirname(__file__), "artifacts", "q_table.npy"
    )
    rl_agent = None
    rl_available = False
    if os.path.exists(q_table_path):
        try:
            from app.ml.rl_allocator import QLearningAgent
            rl_agent = QLearningAgent.load(q_table_path)
            rl_available = True
            print(f"[Benchmark] RL Q-table loaded from {q_table_path}")
        except Exception as e:
            print(f"[Benchmark] Could not load RL agent: {e}. Using intelligent fallback for RL column.")

    # Generate the shared arrival sequence (all strategies see same containers)
    arrival_sequence = [sample_container(rng) for _ in range(N_ARRIVALS)]

    strategies = {
        "first_fit": {"fn": strategy_first_fit, "agent": None},
        "nearest": {"fn": strategy_nearest, "agent": None},
        "intelligent": {"fn": strategy_intelligent, "agent": None},
        "rl_qlearning": {"fn": strategy_rl, "agent": rl_agent},
    }

    results: Dict[str, List[Dict]] = {k: [] for k in strategies}
    # Each strategy runs on its OWN yard (independent — we compare steady-state allocation quality)
    yards = {k: build_yard() for k in strategies}

    print(f"[Benchmark] Running {N_ARRIVALS:,} allocations per strategy ...")
    t_start = time.time()

    for i, container in enumerate(arrival_sequence):
        if i % 200 == 0:
            print(f"  {i}/{N_ARRIVALS} ...")

        for name, cfg in strategies.items():
            yard = yards[name]
            if name == "rl_qlearning":
                slot = cfg["fn"](yard, container, cfg["agent"])
            else:
                slot = cfg["fn"](yard, container)

            rec = record_allocation(slot, container, yard)
            results[name].append(rec)

            if slot is not None:
                place_container_sim(yard, slot, container)

    elapsed = time.time() - t_start
    print(f"[Benchmark] Completed in {elapsed:.1f}s")

    summaries = {k: aggregate(v) for k, v in results.items()}

    # Compute improvement of each strategy over first-fit baseline
    baseline_cost = summaries["first_fit"]["avg_total_cost"]
    for name, summary in summaries.items():
        if baseline_cost != 0:
            pct_improvement = (baseline_cost - summary["avg_total_cost"]) / abs(baseline_cost) * 100.0
        else:
            pct_improvement = 0.0
        summary["pct_improvement_over_first_fit"] = round(pct_improvement, 2)

    output = {
        "benchmark_config": {
            "seed": SEED,
            "n_arrivals": N_ARRIVALS,
            "rl_agent_available": rl_available,
        },
        "summaries": summaries,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"[Benchmark] Results saved to {OUTPUT_PATH}")
    return output


if __name__ == "__main__":
    results = run_benchmark()
    print("\n=== BENCHMARK SUMMARY ===")
    for name, s in results["summaries"].items():
        print(
            f"  {name:<18}: avg_cost={s['avg_total_cost']:>7.2f}  "
            f"movement={s['avg_movement_cost']:>6.2f}  "
            f"retrieval={s['avg_retrieval_cost']:>5.2f}  "
            f"blocked={s['blocked_access_rate_pct']:>5.1f}%  "
            f"improvement={s['pct_improvement_over_first_fit']:>+6.1f}%"
        )
