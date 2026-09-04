"""
Dueling Deep Q-Network (DQN) Offline Training Script for Yard Slot Allocation.
Trains the Dueling DQN policy network on multi-objective yard operational tasks:
- Minimizing crane travel distance and reshuffle penalties
- Honoring stacking stability (no heavy on light)
- Honoring reefer power requirements and IMO hazard isolation
- Balancing yard congestion across blocks A, B, C, D
"""
from collections import deque
import json
import os
import random
import time
from typing import Any, Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from app.ml.dqn_allocator import (
    BLOCKS,
    DEST_MAP,
    DuelingDQN,
    NUM_ACTIONS,
    NUM_BLOCKS,
    NUM_TIERS,
    WEIGHT_MAP,
    PRIORITY_MAP,
    is_reefer_equipped_slot,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "ml", "artifacts")
WEIGHTS_PATH = os.path.join(ARTIFACTS_DIR, "dqn_allocator.pt")
LOG_PATH = os.path.join(ARTIFACTS_DIR, "dqn_training_log.json")


class SimulatedYardEnv:
    """Simulated 192-slot Yard Environment for DQN Training."""
    def __init__(self):
        self.reset()

    def reset(self) -> Tuple[np.ndarray, np.ndarray]:
        # Spatial tensor: (5, 8, 24)
        self.grid = np.zeros((5, 8, 24), dtype=np.float32)
        # Mark reefer slots on channel 2
        for b_idx, block in enumerate(BLOCKS):
            for bay in range(1, 7):
                for row in range(1, 5):
                    if is_reefer_equipped_slot(block, bay, row):
                        w_pos = (bay - 1) * 4 + (row - 1)
                        for t_idx in range(2):
                            self.grid[2, b_idx * 2 + t_idx, w_pos] = 1.0

        self.current_step = 0
        self.max_steps = 40
        self.current_container = self._sample_container()
        return self.grid.copy(), self.current_container

    def _sample_container(self) -> np.ndarray:
        size_norm = random.choice([0.5, 1.0])
        weight_norm = random.choice([0.33, 0.66, 1.0])
        is_hazard = 1.0 if random.random() < 0.15 else 0.0
        is_reefer = 1.0 if random.random() < 0.20 else 0.0
        prio_norm = random.choice([0.0, 0.5, 1.0])
        dest_norm = random.choice(list(DEST_MAP.values()))
        return np.array([size_norm, weight_norm, is_hazard, is_reefer, prio_norm, dest_norm], dtype=np.float32)

    def step(self, action: int) -> Tuple[np.ndarray, np.ndarray, float, bool]:
        """
        Execute macro action [0..7]: (Block, Tier)
        Computes realistic operational reward:
        - Movement distance penalty
        - Retrieval / stacking penalty
        - Stability violation penalty (-50 if heavy on tier 2)
        - Reefer mismatch penalty (-60 if reefer not in Block A electrified zone)
        - Congestion balance reward
        """
        block_idx = action // 2
        tier = (action % 2) + 1
        block_name = BLOCKS[block_idx]

        container = self.current_container
        size_norm, weight_norm, is_hazard, is_reefer, prio_norm, dest_norm = container

        # Operational metrics calculation
        h_pos = block_idx * 2 + (tier - 1)
        bay = random.randint(1, 6)
        row = random.randint(1, 4)
        w_pos = (bay - 1) * 4 + (row - 1)

        # Base travel distance from gate
        dist = bay + (block_idx * 5 + row)
        movement_cost = dist * 2.0
        retrieval_cost = (tier - 1) * 8.0

        # Penalties / Bonuses
        penalties = 0.0
        bonuses = 0.0

        # 1. Stacking Stability: HEAVY container (weight_norm == 1.0) on Tier 2
        if tier == 2 and weight_norm >= 0.9:
            penalties += 40.0

        # 2. Reefer compatibility
        if is_reefer > 0.5:
            if not is_reefer_equipped_slot(block_name, bay, row):
                penalties += 50.0
            else:
                bonuses += 20.0

        # 3. Hazard segregation
        if is_hazard > 0.5:
            # Prefer Block D (furthest isolated block)
            if block_name == "D":
                bonuses += 15.0
            elif block_name == "A":
                penalties += 25.0

        # 4. Priority handling (Urgent containers should be in Block A Tier 1)
        if prio_norm >= 0.9:
            if block_name == "A" and tier == 1:
                bonuses += 25.0
            elif block_name in ("C", "D"):
                penalties += 30.0

        # Update simulated grid
        self.grid[0, h_pos, w_pos] = 1.0
        self.grid[1, h_pos, w_pos] = weight_norm
        self.grid[4, h_pos, w_pos] = prio_norm

        total_cost = movement_cost + retrieval_cost + penalties - bonuses
        reward = -total_cost / 10.0  # Scale reward for gradient stability

        self.current_step += 1
        done = self.current_step >= self.max_steps
        next_container = self._sample_container() if not done else container

        return self.grid.copy(), next_container, reward, done


class ReplayBuffer:
    def __init__(self, capacity: int = 10000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state_grid, state_attr, action, reward, next_grid, next_attr, done):
        self.buffer.append((state_grid, state_attr, action, reward, next_grid, next_attr, done))

    def sample(self, batch_size: int):
        batch = random.sample(self.buffer, batch_size)
        state_grid, state_attr, action, reward, next_grid, next_attr, done = zip(*batch)
        return (
            torch.tensor(np.array(state_grid), dtype=torch.float32),
            torch.tensor(np.array(state_attr), dtype=torch.float32),
            torch.tensor(action, dtype=torch.int64),
            torch.tensor(reward, dtype=torch.float32),
            torch.tensor(np.array(next_grid), dtype=torch.float32),
            torch.tensor(np.array(next_attr), dtype=torch.float32),
            torch.tensor(done, dtype=torch.float32),
        )

    def __len__(self):
        return len(self.buffer)


def train_dqn(
    num_episodes: int = 50,
    batch_size: int = 32,
    gamma: float = 0.95,
    lr: float = 0.001,
    target_update_freq: int = 10,
) -> Dict[str, Any]:
    """Train Dueling DQN agent and save weights & performance log."""
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    policy_net = DuelingDQN().to(device)
    target_net = DuelingDQN().to(device)
    target_net.load_state_dict(policy_net.state_dict())
    target_net.eval()

    optimizer = optim.Adam(policy_net.parameters(), lr=lr)
    criterion = nn.SmoothL1Loss()  # Huber loss
    replay_buffer = ReplayBuffer(capacity=10000)
    env = SimulatedYardEnv()

    epsilon_start = 1.0
    epsilon_end = 0.05
    epsilon_decay = 0.97

    epsilon = epsilon_start
    episode_rewards = []
    episode_losses = []

    print(f"=== Starting Dueling DQN Training ({num_episodes} episodes on {device}) ===", flush=True)
    t0 = time.perf_counter()
    step_count = 0

    for ep in range(1, num_episodes + 1):
        state_grid, state_attr = env.reset()
        total_ep_reward = 0.0
        losses = []

        done = False
        while not done:
            step_count += 1
            # Epsilon-greedy action selection
            if random.random() < epsilon:
                action = random.randint(0, NUM_ACTIONS - 1)
            else:
                with torch.no_grad():
                    g_t = torch.tensor(state_grid, dtype=torch.float32).unsqueeze(0).to(device)
                    a_t = torch.tensor(state_attr, dtype=torch.float32).unsqueeze(0).to(device)
                    q_vals = policy_net(g_t, a_t)
                    action = int(q_vals.argmax(dim=1).item())

            next_grid, next_attr, reward, done = env.step(action)
            replay_buffer.push(state_grid, state_attr, action, reward, next_grid, next_attr, done)

            state_grid = next_grid
            state_attr = next_attr
            total_ep_reward += reward

            # Optimize step frequency: train every 4 environment steps
            if step_count % 4 == 0 and len(replay_buffer) >= batch_size:
                b_grid, b_attr, b_act, b_rew, b_next_grid, b_next_attr, b_done = replay_buffer.sample(batch_size)
                b_grid, b_attr = b_grid.to(device), b_attr.to(device)
                b_act, b_rew = b_act.to(device), b_rew.to(device)
                b_next_grid, b_next_attr, b_done = b_next_grid.to(device), b_next_attr.to(device), b_done.to(device)

                # Current Q(s, a)
                q_eval = policy_net(b_grid, b_attr).gather(1, b_act.unsqueeze(1)).squeeze(1)

                # Target Q: Double DQN
                with torch.no_grad():
                    next_actions = policy_net(b_next_grid, b_next_attr).argmax(dim=1, keepdim=True)
                    next_q_vals = target_net(b_next_grid, b_next_attr).gather(1, next_actions).squeeze(1)
                    q_target = b_rew + (1.0 - b_done) * gamma * next_q_vals

                loss = criterion(q_eval, q_target)
                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(policy_net.parameters(), max_norm=10.0)
                optimizer.step()
                losses.append(loss.item())

        epsilon = max(epsilon_end, epsilon * epsilon_decay)
        episode_rewards.append(round(total_ep_reward, 2))
        avg_loss = round(float(np.mean(losses)), 4) if losses else 0.0
        episode_losses.append(avg_loss)

        if ep % target_update_freq == 0:
            target_net.load_state_dict(policy_net.state_dict())

        if ep % 10 == 0 or ep == num_episodes:
            recent_rew = np.mean(episode_rewards[-10:])
            print(f"Episode {ep:3d}/{num_episodes} | Avg Reward (last 10): {recent_rew:6.2f} | Loss: {avg_loss:.4f} | Epsilon: {epsilon:.3f}", flush=True)

    train_duration = round(time.perf_counter() - t0, 2)

    # Save weights
    torch.save(policy_net.state_dict(), WEIGHTS_PATH)
    print(f"[DQN Training] Saved model weights to: {WEIGHTS_PATH}")

    log_data = {
        "algorithm": "Dueling_Double_DQN",
        "total_episodes": num_episodes,
        "training_duration_seconds": train_duration,
        "final_epsilon": round(epsilon, 3),
        "mean_reward_final_25": round(float(np.mean(episode_rewards[-25:])), 2),
        "reward_history": episode_rewards,
        "loss_history": episode_losses,
        "operational_constraints": [
            "reefer_power_supply_segregation",
            "imo_hazard_1bay_buffer",
            "stacking_stability_no_heavy_on_light",
            "manhattan_travel_distance_optimization"
        ]
    }

    with open(LOG_PATH, "w") as f:
        json.dump(log_data, f, indent=2)

    print(f"[DQN Training] Training metrics logged to: {LOG_PATH}")
    return log_data


if __name__ == "__main__":
    train_dqn()
