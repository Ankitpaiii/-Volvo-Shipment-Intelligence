"""
Training script for the Q-Learning Yard Slot Allocator.

Usage:
    cd backend
    python -m app.ml.training.train_rl_allocator

Saves:
    backend/app/ml/artifacts/q_table.npy
    backend/app/ml/artifacts/rl_training_log.json
"""
from __future__ import annotations

import json
import os
import random
import sys
import time
from collections import deque

import numpy as np

# Ensure the backend package is importable when run from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from app.ml.rl_allocator import (
    N_ACTIONS,
    N_STATES,
    ZONE_ACTIONS,
    QLearningAgent,
    run_episode,
    sample_container,
    get_available_zone_actions,
    build_yard,
)

# ──────────────────────────────────────────────────────────────────────────────
# Hyperparameters
# ──────────────────────────────────────────────────────────────────────────────

SEED = 42
N_EPISODES = 50_000
EPISODE_LENGTH = 30     # container arrivals per episode
ALPHA = 0.1
GAMMA = 0.9
EPSILON_START = 1.0
EPSILON_MIN = 0.05
LOG_INTERVAL = 1_000    # episodes between console log lines
MOVING_AVG_WINDOW = 500

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "artifacts")
Q_TABLE_PATH = os.path.join(ARTIFACTS_DIR, "q_table.npy")
LOG_PATH = os.path.join(ARTIFACTS_DIR, "rl_training_log.json")


def train() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    rng = random.Random(SEED)

    agent = QLearningAgent(
        alpha=ALPHA,
        gamma=GAMMA,
        epsilon=EPSILON_START,
        epsilon_min=EPSILON_MIN,
    )

    reward_window = deque(maxlen=MOVING_AVG_WINDOW)
    training_log = []

    print(f"[RL Training] Starting {N_EPISODES:,} episodes  "
          f"(state_space={N_STATES}, actions={N_ACTIONS})")
    print(f"[RL Training] Episode length = {EPISODE_LENGTH} arrivals  |  "
          f"alpha={ALPHA}, gamma={GAMMA}, epsilon: {EPSILON_START} -> {EPSILON_MIN}")
    print(f"[RL Training] Seed = {SEED}")
    print("-" * 70)

    t_start = time.time()

    for ep in range(N_EPISODES):
        agent.decay_epsilon(ep, N_EPISODES)
        total_reward, _ = run_episode(agent, rng, EPISODE_LENGTH, train=True)
        reward_window.append(total_reward)
        moving_avg = float(np.mean(reward_window))

        if ep % LOG_INTERVAL == 0 or ep == N_EPISODES - 1:
            elapsed = time.time() - t_start
            print(
                f"  Ep {ep:>6,}  eps={agent.epsilon:.3f}  "
                f"reward={total_reward:>8.2f}  "
                f"moving_avg({MOVING_AVG_WINDOW})={moving_avg:>8.2f}  "
                f"elapsed={elapsed:.1f}s"
            )
            training_log.append({
                "episode": ep,
                "epsilon": round(agent.epsilon, 4),
                "episode_reward": round(total_reward, 4),
                "moving_avg_reward": round(moving_avg, 4),
                "elapsed_s": round(elapsed, 2),
            })

    total_time = time.time() - t_start
    print("-" * 70)
    print(f"[RL Training] Finished in {total_time:.1f}s")

    # ── Policy collapse check ──────────────────────────────────────────────
    print("\n[RL Training] Checking for policy collapse ...")
    action_counts = np.zeros(N_ACTIONS, dtype=int)
    check_rng = random.Random(SEED + 1)
    for _ in range(5000):
        container = sample_container(check_rng)
        yard = build_yard()
        from app.ml.rl_allocator import encode_state, TOTAL_SLOTS
        occ_pct = 0.0  # empty yard
        state = encode_state(occ_pct, container.priority, container.weight_tier,
                             container.size_teu, container.destination)
        avail = get_available_zone_actions(yard, container)
        action = agent.select_action(state, avail)
        action_counts[action] += 1

    action_freq = {
        f"Block {ZONE_ACTIONS[i][0]} Tier {ZONE_ACTIONS[i][1]}": int(action_counts[i])
        for i in range(N_ACTIONS)
    }
    total_checks = int(action_counts.sum())
    dominant_pct = float(action_counts.max()) / total_checks * 100.0
    print(f"  Action frequencies over 5,000 greedy samples (empty yard):")
    for zone, cnt in sorted(action_freq.items(), key=lambda x: -x[1]):
        print(f"    {zone}: {cnt:>5}  ({cnt/total_checks*100:.1f}%)")

    collapse_warning = ""
    if dominant_pct > 70.0:
        collapse_warning = (
            f"WARNING: Dominant action = {dominant_pct:.1f}% (>70%). "
            "Possible policy collapse — check reward weights and environment diversity."
        )
        print(f"\n  *** {collapse_warning} ***")
    else:
        print(f"\n  Dominant action share: {dominant_pct:.1f}%  — policy appears diverse.")

    # ── Save ──────────────────────────────────────────────────────────────
    metadata = {
        "n_episodes": N_EPISODES,
        "episode_length": EPISODE_LENGTH,
        "alpha": ALPHA,
        "gamma": GAMMA,
        "epsilon_start": EPSILON_START,
        "epsilon_min": EPSILON_MIN,
        "seed": SEED,
        "n_states": N_STATES,
        "n_actions": N_ACTIONS,
        "total_training_time_s": round(total_time, 2),
        "final_moving_avg_reward": round(float(np.mean(reward_window)), 4),
        "action_frequency_check": action_freq,
        "dominant_action_pct": round(dominant_pct, 2),
        "policy_collapse_warning": collapse_warning,
        "training_curve": training_log,
    }

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    np.save(Q_TABLE_PATH, agent.q_table)
    with open(LOG_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n[RL Training] Q-table saved to:       {Q_TABLE_PATH}")
    print(f"[RL Training] Training log saved to:  {LOG_PATH}")
    print(f"[RL Training] Final moving avg reward: {metadata['final_moving_avg_reward']:.4f}")
    if collapse_warning:
        print(f"\n[RL Training] *** POLICY COLLAPSE WARNING: {collapse_warning} ***")


if __name__ == "__main__":
    train()
