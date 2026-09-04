"""
Hold-out RL evaluation script.

Uses seed=99 (never used during training, seed=42).
Evaluates 500 independent episodes, each with 30 arrivals.
Compares: First-Fit, Nearest, Intelligent, Q-Learning.

Saves results to backend/app/ml/evaluation/rl_evaluation.json
"""
from __future__ import annotations

import json
import os
import random
import sys
import time
from typing import Any, Dict, List

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from app.ml.rl_allocator import (
    TOTAL_SLOTS,
    ZONE_ACTIONS,
    QLearningAgent,
    build_yard,
    compute_cost_sim,
    encode_state,
    get_available_zone_actions,
    get_empty_slots_sim,
    place_container_sim,
    resolve_zone_action_sim,
    sample_container,
)

EVAL_SEED = 99          # Completely separate from training seed (42)
N_EVAL_EPISODES = 500
EPISODE_LENGTH = 30
Q_TABLE_PATH = os.path.join(os.path.dirname(__file__), "..", "artifacts", "q_table.npy")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "rl_evaluation.json")


# ──────────────────────────────────────────────────────────────────────────────
# Strategy functions (same as benchmark but expressed for episode evaluation)
# ──────────────────────────────────────────────────────────────────────────────

def pick_first_fit(yard, container):
    from app.ml.rl_allocator import BLOCK_ORDER
    cands = get_empty_slots_sim(yard, container)
    if not cands:
        return None
    return min(cands, key=lambda s: (BLOCK_ORDER[s.block], s.bay, s.row, s.tier))


def pick_nearest(yard, container):
    cands = get_empty_slots_sim(yard, container)
    if not cands:
        return None
    return min(cands, key=lambda s: s.manhattan_distance)


def pick_intelligent(yard, container):
    cands = get_empty_slots_sim(yard, container)
    if not cands:
        return None
    return min(cands, key=lambda s: compute_cost_sim(s, container, yard)["total_cost"])


def pick_rl(yard, container, agent: QLearningAgent):
    occ_pct = sum(1 for s in yard.values() if s.occupied) / TOTAL_SLOTS * 100.0
    state = encode_state(
        occ_pct, container.priority, container.weight_tier,
        container.size_teu, container.destination,
    )
    avail = get_available_zone_actions(yard, container)
    if not avail:
        return pick_intelligent(yard, container)
    action_idx = agent.select_action(state, avail)
    return resolve_zone_action_sim(yard, container, action_idx)


def evaluate_episode(strategy_fn, rng, agent=None, episode_length=EPISODE_LENGTH):
    """Run one episode and collect per-step metrics."""
    yard = build_yard()
    step_records = []
    container = sample_container(rng)

    for _ in range(episode_length):
        slot = strategy_fn(yard, container, agent) if agent is not None else strategy_fn(yard, container)
        if slot is None:
            break

        breakdown = compute_cost_sim(slot, container, yard)
        blocked = container.priority == "URGENT" and slot.block in ("C", "D")
        step_records.append({
            "total_cost": breakdown["total_cost"],
            "movement_cost": breakdown["movement_cost"],
            "retrieval_cost": breakdown["retrieval_cost"],
            "congestion_penalty": breakdown["congestion_penalty"],
            "blocking_penalty": breakdown["blocking_penalty"],
            "priority_penalty": breakdown["priority_penalty"],
            "cluster_bonus": breakdown["cluster_bonus"],
            "reward": -breakdown["total_cost"],
            "manhattan_distance": slot.manhattan_distance,
            "blocked_access": blocked,
        })

        place_container_sim(yard, slot, container)
        container = sample_container(rng)

    return step_records


def aggregate_episodes(all_records: List[List[Dict]]) -> Dict[str, Any]:
    flat = [r for ep in all_records for r in ep]
    n = max(1, len(flat))
    n_eps = len(all_records)
    ep_rewards = [sum(r["reward"] for r in ep) for ep in all_records if ep]
    return {
        "n_episodes": n_eps,
        "n_steps_total": n,
        "avg_steps_per_episode": round(n / max(1, n_eps), 2),
        "avg_total_cost": round(sum(r["total_cost"] for r in flat) / n, 4),
        "avg_movement_cost": round(sum(r["movement_cost"] for r in flat) / n, 4),
        "avg_retrieval_cost": round(sum(r["retrieval_cost"] for r in flat) / n, 4),
        "avg_congestion_penalty": round(sum(r["congestion_penalty"] for r in flat) / n, 4),
        "avg_blocking_penalty": round(sum(r["blocking_penalty"] for r in flat) / n, 4),
        "avg_priority_penalty": round(sum(r["priority_penalty"] for r in flat) / n, 4),
        "avg_cluster_bonus": round(sum(r["cluster_bonus"] for r in flat) / n, 4),
        "avg_reward_per_step": round(sum(r["reward"] for r in flat) / n, 4),
        "avg_episode_reward": round(float(np.mean(ep_rewards)) if ep_rewards else 0.0, 4),
        "std_episode_reward": round(float(np.std(ep_rewards)) if ep_rewards else 0.0, 4),
        "avg_manhattan_distance": round(sum(r["manhattan_distance"] for r in flat) / n, 4),
        "blocked_access_count": sum(1 for r in flat if r["blocked_access"]),
        "blocked_access_rate_pct": round(sum(1 for r in flat if r["blocked_access"]) / n * 100, 2),
    }


def run_evaluation() -> Dict[str, Any]:
    # Load RL agent
    rl_available = False
    agent = None
    if os.path.exists(Q_TABLE_PATH):
        try:
            agent = QLearningAgent.load(Q_TABLE_PATH)
            agent.epsilon = 0.0  # Greedy evaluation — no exploration
            rl_available = True
            print(f"[RL Eval] Q-table loaded: {Q_TABLE_PATH}")
        except Exception as e:
            print(f"[RL Eval] Could not load Q-table: {e}")

    rng = random.Random(EVAL_SEED)
    np.random.seed(EVAL_SEED)

    strategies = [
        ("first_fit", pick_first_fit, None),
        ("nearest", pick_nearest, None),
        ("intelligent", pick_intelligent, None),
        ("rl_qlearning", pick_rl, agent),
    ]

    all_results = {}
    print(f"[RL Eval] Running {N_EVAL_EPISODES} hold-out episodes x {EPISODE_LENGTH} arrivals ...")
    print(f"[RL Eval] Eval seed = {EVAL_SEED} (training seed was 42)")

    t_start = time.time()

    for name, fn, strat_agent in strategies:
        print(f"  Evaluating [{name}] ...")
        ep_records = []
        eval_rng = random.Random(EVAL_SEED)  # Same scenarios for every strategy
        for ep_idx in range(N_EVAL_EPISODES):
            if strat_agent is not None:
                records = evaluate_episode(fn, eval_rng, agent=strat_agent)
            else:
                records = evaluate_episode(fn, eval_rng)
            ep_records.append(records)

        summary = aggregate_episodes(ep_records)
        all_results[name] = summary

    elapsed = time.time() - t_start

    # Improvement calculation (vs. first_fit baseline)
    baseline_cost = all_results["first_fit"]["avg_total_cost"]
    baseline_reward = all_results["first_fit"]["avg_reward_per_step"]

    for name, summary in all_results.items():
        if baseline_cost != 0:
            summary["pct_cost_improvement_over_first_fit"] = round(
                (baseline_cost - summary["avg_total_cost"]) / abs(baseline_cost) * 100, 2
            )
        else:
            summary["pct_cost_improvement_over_first_fit"] = 0.0

    # Check if RL actually outperforms intelligent
    rl_vs_intelligent = None
    if "rl_qlearning" in all_results and "intelligent" in all_results:
        rl_cost = all_results["rl_qlearning"]["avg_total_cost"]
        intel_cost = all_results["intelligent"]["avg_total_cost"]
        rl_better = rl_cost < intel_cost
        margin = round(intel_cost - rl_cost, 4)
        rl_vs_intelligent = {
            "rl_avg_cost": rl_cost,
            "intelligent_avg_cost": intel_cost,
            "rl_outperforms_intelligent": rl_better,
            "cost_margin": margin,
            "verdict": (
                f"RL outperforms Intelligent by {margin:.2f} cost units"
                if rl_better
                else f"Intelligent outperforms RL by {-margin:.2f} cost units"
            ),
        }

    output = {
        "eval_config": {
            "eval_seed": EVAL_SEED,
            "training_seed": 42,
            "n_eval_episodes": N_EVAL_EPISODES,
            "episode_length": EPISODE_LENGTH,
            "rl_agent_available": rl_available,
            "elapsed_s": round(elapsed, 2),
        },
        "strategy_results": all_results,
        "rl_vs_intelligent": rl_vs_intelligent,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n[RL Eval] Results saved to {OUTPUT_PATH}")
    return output


if __name__ == "__main__":
    results = run_evaluation()
    print("\n=== RL HOLD-OUT EVALUATION ===")
    baseline_cost = results["strategy_results"]["first_fit"]["avg_total_cost"]
    for name, s in results["strategy_results"].items():
        print(
            f"  {name:<18}: avg_cost={s['avg_total_cost']:>7.2f}  "
            f"movement={s['avg_movement_cost']:>6.2f}  "
            f"retrieval={s['avg_retrieval_cost']:>5.2f}  "
            f"blocked={s['blocked_access_rate_pct']:>5.1f}%  "
            f"reward/step={s['avg_reward_per_step']:>7.2f}  "
            f"vs_baseline={s['pct_cost_improvement_over_first_fit']:>+6.1f}%"
        )
    if results.get("rl_vs_intelligent"):
        v = results["rl_vs_intelligent"]
        print(f"\n  RL vs Intelligent: {v['verdict']}")
