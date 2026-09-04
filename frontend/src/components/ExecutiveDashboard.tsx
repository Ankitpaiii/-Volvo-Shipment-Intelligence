import { useEffect, useState } from "react";
import { api, type CarrierScorecard, type ExtendedKPIs, type LanePerformance } from "../api/client";

interface Props { extKpis: ExtendedKPIs | null }

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="v-bar-track" style={{ marginTop: 4 }}>
      <div
        className="v-bar-fill"
        style={{ width: `${Math.min(100, pct)}%`, background: color }}
      />
    </div>
  );
}

function riskBadge(score: number) {
  if (score >= 60) return <span className="v-tag v-tag-crit">High</span>;
  if (score >= 35) return <span className="v-tag v-tag-warn">Med</span>;
  return <span className="v-tag v-tag-ok">Low</span>;
}

export function ExecutiveDashboard({ extKpis: _extKpis }: Props) {
  const [carriers, setCarriers] = useState<CarrierScorecard[]>([]);
  const [lanes, setLanes] = useState<LanePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getCarrierScorecards(), api.getLanePerformance()])
      .then(([c, l]) => { setCarriers(c); setLanes(l); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="v-empty">
        <div className="v-skeleton" style={{ width: 260, height: 16, marginBottom: 8 }} />
        <div className="v-skeleton" style={{ width: 180, height: 12 }} />
      </div>
    );
  }

  return (
    <div className="v-split" style={{ marginTop: "var(--s6)" }}>
      {/* ── Carrier Scorecards ─────────────────── */}
      <div className="v-lead">
        <div className="v-lead-head">
          <h3 style={{ flex: 1 }}>Carrier scorecards</h3>
          <span className="v-meta">weighted, 36 d</span>
        </div>

        {carriers.length === 0 ? (
          <div className="v-empty"><p>No carrier data</p></div>
        ) : carriers.map((c, i) => {
          const otif = c.otif_rate ?? c.on_time_rate ?? 0;
          const docQ = c.compliance_rate ?? 0;
          const costIdx = Math.max(0, 100 - (c.exception_rate ?? 0) * 2);
          const shipCount = c.shipment_count ?? c.total_shipments ?? 0;

          return (
            <div key={c.carrier_name} className="v-score">
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{c.carrier_name}</div>
                <div className="v-meta" style={{ marginTop: 2 }}>
                  {shipCount} shipments · {c.at_risk_count != null ? `${c.at_risk_count} at risk` : "active"}
                </div>
              </div>
              <div className="v-score-rank">{String(i + 1).padStart(2, "0")}</div>

              <div className="v-bars">
                <div className="v-bar">
                  <span className="v-eyebrow">Reliability</span>
                  <span className="v-mono" style={{ fontSize: "0.875rem", fontWeight: 600 }}>{Math.round(otif)}</span>
                  <Bar pct={otif} color={otif >= 85 ? "var(--ok)" : otif >= 65 ? "var(--warn)" : "var(--crit)"} />
                </div>
                <div className="v-bar">
                  <span className="v-eyebrow">Doc quality</span>
                  <span className="v-mono" style={{ fontSize: "0.875rem", fontWeight: 600 }}>{Math.round(docQ)}</span>
                  <Bar pct={docQ} color={docQ >= 85 ? "var(--ok)" : docQ >= 65 ? "var(--warn)" : "var(--crit)"} />
                </div>
                <div className="v-bar">
                  <span className="v-eyebrow">Cost index</span>
                  <span className="v-mono" style={{ fontSize: "0.875rem", fontWeight: 600 }}>{Math.round(costIdx)}</span>
                  <Bar pct={costIdx} color={costIdx >= 75 ? "var(--ok)" : costIdx >= 50 ? "var(--warn)" : "var(--crit)"} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Lane Risk ──────────────────────────── */}
      <div>
        <div className="v-lead">
          <div className="v-lead-head"><h3>Lane risk</h3></div>
          <div>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 64px 72px",
              padding: "8px var(--s5)", borderBottom: "1px solid var(--line)",
              background: "var(--surface-2)",
            }}>
              <span className="v-eyebrow">Lane</span>
              <span className="v-eyebrow" style={{ textAlign: "right" }}>OTIF</span>
              <span className="v-eyebrow" style={{ textAlign: "right" }}>Risk</span>
            </div>

            {lanes.length === 0 ? (
              <div className="v-empty"><p>No lane data</p></div>
            ) : lanes.map((lane) => {
              const risk = lane.avg_delay_risk_score ?? lane.avg_risk_score ?? 0;
              const otif = lane.otif_rate ?? lane.on_time_rate ?? 0;
              const carrier = lane.dominant_carrier ?? "—";
              return (
                <div
                  key={lane.lane_name}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 64px 72px",
                    padding: "12px var(--s5)", borderBottom: "1px solid var(--line)",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{lane.lane_name}</div>
                    <div className="v-meta" style={{ marginTop: 2 }}>{carrier}</div>
                  </div>
                  <div className="v-mono" style={{ textAlign: "right", fontWeight: 600, fontSize: "0.875rem" }}>
                    {otif.toFixed(0)}%
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {riskBadge(risk)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
