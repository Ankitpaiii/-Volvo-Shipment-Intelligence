import { useEffect, useState } from "react";
import {
  AllocationBenchmarkResult,
  AllocationComparisonResponse,
  Container,
  RLEvaluationResult,
  SlotAllocationResponse,
  YardSlot,
  YardState,
  allocateSlot,
  compareAllocation,
  fetchAllocationBenchmark,
  fetchRLEvaluation,
} from "../api/client";

interface YardDigitalTwinProps {
  yardState: YardState | null;
  onRefresh: () => void;
  containers: Container[];
}

function slotClass(slot: YardSlot, recommended: string | null, selected: string | null): string {
  let cls = "v-slot";
  if (slot.id === selected) cls += " selected";
  if (slot.id === recommended && !slot.is_occupied) cls += " reserved";
  else if (slot.is_occupied) {
    const prio = slot.container?.priority;
    if (prio === "URGENT") cls += " blocked";
    else if (prio === "HIGH") cls += " dwell";
    else cls += " occupied";
  }
  return cls;
}

export function YardDigitalTwin({ yardState, onRefresh, containers }: YardDigitalTwinProps) {
  const [selectedSlot, setSelectedSlot] = useState<YardSlot | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string>("");
  const [comparison, setComparison] = useState<AllocationComparisonResponse | null>(null);
  const [allocResult, setAllocResult] = useState<SlotAllocationResponse | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [loadingAlloc, setLoadingAlloc] = useState(false);
  const [benchmark, setBenchmark] = useState<AllocationBenchmarkResult | null>(null);
  const [rlEval, setRlEval] = useState<RLEvaluationResult | null>(null);

  const unallocated = containers.filter((c) => c.status !== "YARD_STACKED" && c.status !== "DEPARTED");

  useEffect(() => {
    fetchAllocationBenchmark().then(setBenchmark).catch(() => {});
    fetchRLEvaluation().then(setRlEval).catch(() => {});
  }, []);

  const handleCompare = async () => {
    if (!selectedContainerId) return;
    setLoadingCompare(true);
    setComparison(null);
    setAllocResult(null);
    try { setComparison(await compareAllocation(selectedContainerId)); }
    catch (e) { console.error(e); }
    finally { setLoadingCompare(false); }
  };

  const handleAllocate = async (strategy: string) => {
    if (!selectedContainerId) return;
    setLoadingAlloc(true);
    try {
      const res = await allocateSlot(selectedContainerId, strategy as any);
      setAllocResult(res);
      setComparison(null);
      onRefresh();
    } catch (e) { console.error(e); }
    finally { setLoadingAlloc(false); }
  };

  if (!yardState) {
    return (
      <div className="v-empty">
        <div className="v-skeleton" style={{ width: 220, height: 16 }} />
        <p>Loading yard state…</p>
      </div>
    );
  }

  const recommendedSlot = comparison?.recommended_slot ?? allocResult?.allocated_slot_id ?? null;

  // Build flat list of ALL slots across all blocks for the grid
  const allBlocks = ["A", "B", "C", "D"];

  const STRATEGIES = [
    { key: "dqn",          label: "Dueling DQN (Deep RL)",    badge: "Neural",   cost: comparison?.dqn_cost,         slot: comparison?.dqn_slot },
    { key: "rl_qlearning", label: "Q-Learning policy",      badge: "Policy",   cost: comparison?.rl_cost,          slot: comparison?.rl_slot },
    { key: "intelligent",  label: "Cost-Based Heuristic",    badge: "Rules",    cost: comparison?.intelligent_cost, slot: comparison?.intelligent_slot },
    { key: "nearest",      label: "Nearest (Manhattan)",     badge: "Distance", cost: comparison?.nearest_cost,     slot: comparison?.nearest_slot },
    { key: "first_fit",    label: "First-Fit Available",     badge: "Baseline", cost: comparison?.first_fit_cost,   slot: comparison?.first_fit_slot },
  ];

  const winnerKey = comparison?.recommended_strategy ?? "rl_qlearning";

  return (
    <div className="v-yard">
      {/* ── Left: Slot Grid ───────────── */}
      <div>
        <div className="v-blocks">
          {allBlocks.map((blk) => {
            const slots = yardState.blocks[blk] ?? [];
            return (
              <div key={blk} className="v-block-row">
                <div className="v-block-id">{blk}</div>
                <div className="v-slots">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      className={slotClass(slot, recommendedSlot, selectedSlot?.id ?? null)}
                      onClick={() => setSelectedSlot(slot)}
                      title={slot.id + (slot.container ? ` · ${slot.container.container_number}` : " · Free")}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="v-legend">
          {[
            { cls: "v-slot occupied",      label: "Stacked, nominal" },
            { cls: "v-slot dwell",         label: "Dwell > 5 d" },
            { cls: "v-slot blocked",       label: "Blocked / reefer alarm" },
            { cls: "v-slot reserved",      label: "Reserved" },
            { cls: "v-slot",               label: "Free" },
          ].map(({ cls, label }) => (
            <div key={label} className="v-legend-item">
              <i className={cls} style={{ border: "1px solid var(--line-2)" }} />
              {label}
            </div>
          ))}
        </div>

        {/* Allocation action button */}
        {(comparison || allocResult) && (
          <div style={{ marginTop: "var(--s5)" }}>
            {allocResult ? (
              <div className="v-verdict" style={{ marginTop: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
                <div>
                  <b>Dispatched to {allocResult.allocated_slot_id}</b>
                  <p className="v-meta" style={{ marginTop: 2 }}>{allocResult.rationale}</p>
                </div>
              </div>
            ) : (
              <button
                className="v-btn v-btn-key v-btn-block"
                onClick={() => handleAllocate(winnerKey)}
                disabled={loadingAlloc}
                style={{ padding: "12px", fontSize: "0.875rem" }}
              >
                ↳ Dispatch to {comparison?.recommended_slot ?? "—"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Right: Allocation Comparator ─ */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s5)" }}>
        {/* Container picker */}
        <div className="v-lead" style={{ padding: "var(--s4) var(--s5)" }}>
          <div className="v-lead-head" style={{ padding: 0, marginBottom: "var(--s3)", border: 0 }}>
            <h3>Allocation comparator</h3>
          </div>

          {/* Selected container info */}
          {selectedContainerId && comparison && (
            <div className="v-meta" style={{ marginBottom: "var(--s3)" }}>
              Arrival {comparison.container_number} · {comparison.weight_tier} · {comparison.priority}
            </div>
          )}

          {/* Strategy comparison rows */}
          {comparison ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
              {STRATEGIES.map(({ key, label, badge, cost, slot }) => {
                const isWinner = key === winnerKey || (key === "intelligent" && winnerKey.startsWith("intelligent"));
                return (
                  <div key={key} className={`v-strategy${isWinner ? " winner" : ""}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{label}</div>
                        <div className="v-meta">{slot ?? "—"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {isWinner && <span className="v-tag v-tag-acid" style={{ display: "block", marginBottom: 4 }}>Chosen</span>}
                        {!isWinner && <span className="v-meta">{badge}</span>}
                        <div className="v-cost">{cost != null ? cost.toFixed(1) : "—"}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <label className="v-eyebrow" style={{ display: "block", marginBottom: "var(--s2)" }}>
                Select container
              </label>
              <select
                className="v-btn"
                style={{ width: "100%", justifyContent: "flex-start", borderRadius: "var(--r-sm)" }}
                value={selectedContainerId}
                onChange={(e) => { setSelectedContainerId(e.target.value); setComparison(null); setAllocResult(null); }}
              >
                <option value="">— Choose a container —</option>
                {unallocated.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.container_number} · {c.priority} · {c.destination}
                  </option>
                ))}
              </select>

              <button
                className="v-btn v-btn-key v-btn-block"
                style={{ marginTop: "var(--s3)", padding: "10px" }}
                onClick={handleCompare}
                disabled={!selectedContainerId || loadingCompare}
              >
                {loadingCompare ? "Comparing…" : "Compare all strategies"}
              </button>
            </div>
          )}
        </div>

        {/* Benchmark stats */}
        {(benchmark || rlEval) && (
          <div className="v-lead">
            <div className="v-lead-head">
              <h3>Benchmark, 1000 arrivals</h3>
            </div>
            <div style={{ padding: "var(--s4) var(--s5)", display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
              {benchmark && (() => {
                const rl = benchmark.summaries["rl_qlearning"];
                const ff = benchmark.summaries["first_fit"];
                const pct = rl && ff ? ((ff.avg_total_cost - rl.avg_total_cost) / ff.avg_total_cost * 100) : null;
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="v-eyebrow">RL vs nearest-free</span>
                      <span className="v-mono" style={{ color: "var(--ok)", fontWeight: 600, fontSize: "0.875rem" }}>
                        {pct !== null ? `−${pct.toFixed(1)}% cost` : "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="v-eyebrow">Mean reshuffles</span>
                      <span className="v-mono" style={{ fontSize: "0.875rem" }}>
                        {ff?.avg_movement_cost.toFixed(2) ?? "—"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="v-eyebrow">Slot utilisation</span>
                      <span className="v-mono" style={{ fontSize: "0.875rem" }}>
                        {yardState.occupancy_rate_pct}%
                      </span>
                    </div>
                  </>
                );
              })()}
              {rlEval && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="v-eyebrow">Holdout episodes</span>
                  <span className="v-mono" style={{ fontSize: "0.875rem" }}>
                    {rlEval.eval_config.n_eval_episodes}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Slot inspector */}
        {selectedSlot && (
          <div className="v-lead">
            <div className="v-lead-head">
              <h3>Slot inspector</h3>
              <button className="v-btn v-btn-sm" onClick={() => setSelectedSlot(null)}>✕</button>
            </div>
            <div style={{ padding: "var(--s4) var(--s5)" }}>
              <dl className="v-kv">
                <dt>Slot</dt><dd className="v-mono">{selectedSlot.id}</dd>
                <dt>Block / Bay</dt><dd>{selectedSlot.block} / Bay {selectedSlot.bay}</dd>
                <dt>Row / Tier</dt><dd>R{selectedSlot.row} · T{selectedSlot.tier}</dd>
                <dt>Status</dt>
                <dd>
                  {selectedSlot.is_occupied
                    ? <span className="v-tag v-tag-warn">Occupied</span>
                    : <span className="v-tag v-tag-ok">Free</span>}
                </dd>
                {selectedSlot.container && (
                  <>
                    <dt>Container</dt><dd className="v-mono">{selectedSlot.container.container_number}</dd>
                    <dt>Priority</dt><dd>{selectedSlot.container.priority}</dd>
                    <dt>Destination</dt><dd>{selectedSlot.container.destination}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
