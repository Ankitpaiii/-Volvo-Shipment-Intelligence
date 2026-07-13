import { useEffect, useState } from "react";
import { api, type CarrierScorecard, type ExtendedKPIs, type LanePerformance } from "../api/client";

function complianceColor(rate: number): string {
  if (rate >= 85) return "var(--signal-green)";
  if (rate >= 65) return "var(--signal-amber)";
  return "var(--signal-red)";
}

function riskColor(score: number): string {
  if (score >= 60) return "var(--signal-red)";
  if (score >= 35) return "var(--signal-amber)";
  return "var(--signal-green)";
}

interface Props {
  extKpis: ExtendedKPIs | null;
}

export function ExecutiveDashboard({ extKpis }: Props) {
  const [carriers, setCarriers] = useState<CarrierScorecard[]>([]);
  const [lanes, setLanes]       = useState<LanePerformance[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([api.getCarrierScorecards(), api.getLanePerformance()])
      .then(([c, l]) => { setCarriers(c); setLanes(l); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="v-empty-state" style={{ paddingTop: 80 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <span className="v-dot"/><span className="v-dot"/><span className="v-dot"/>
        </div>
        <p className="v-empty-title">Loading analytics…</p>
        <p className="v-empty-sub">Fetching carrier scorecards and lane performance data.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Executive summary row */}
      {extKpis && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Pending Actions",   value: extKpis.open_exceptions ?? 0,        color: "var(--platinum-100)" },
            { label: "Avg Dwell (hrs)",   value: extKpis.avg_dwell_hours?.toFixed(1) ?? "—", color: Number(extKpis.avg_dwell_hours) >= 6 ? "var(--signal-red)" : Number(extKpis.avg_dwell_hours) >= 3 ? "var(--signal-amber)" : "var(--signal-green)" },
            { label: "Carrier Compliance",value: `${extKpis.carrier_compliance_pct ?? 0}%`, color: complianceColor(extKpis.carrier_compliance_pct ?? 0) },
          ].map(({ label, value, color }) => (
            <div key={label} className="v-card" style={{ padding: "16px" }}>
              <p className="v-kpi-label" style={{ marginBottom: 8 }}>{label}</p>
              <p className="v-kpi-value" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Carrier Scorecards */}
      <div>
        <h3 className="v-text-primary" style={{ fontSize: "0.8rem", fontWeight: 700, margin: "0 0 12px" }}>
          Carrier Scorecards
        </h3>
        {carriers.length === 0 ? (
          <div className="v-card">
            <div className="v-empty-state">
              <svg className="v-empty-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              <p className="v-empty-title">No Carrier Data</p>
              <p className="v-empty-sub">Connect the backend to load scorecards.</p>
            </div>
          </div>
        ) : (
          <div className="v-card" style={{ overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 2fr) 80px 80px 80px 80px 60px",
              gap: 8, padding: "8px 16px",
              borderBottom: "1px solid var(--graphite-line)",
              backgroundColor: "var(--bg-panel)",
            }}>
              {["Carrier", "OTIF", "Transit", "Exception", "Compliance", "Score"].map((h) => (
                <span key={h} className="v-kpi-label">{h}</span>
              ))}
            </div>
            {carriers.map((c, i) => {
              const score = Math.round(
                (c.otif_rate * 0.35) + (c.compliance_rate * 0.25) + ((100 - c.exception_rate) * 0.25) + (Math.max(0, 100 - (c.avg_transit_days_variance * 10)) * 0.15)
              );
              const scoreColor = score >= 80 ? "var(--signal-green)" : score >= 60 ? "var(--signal-amber)" : "var(--signal-red)";
              return (
                <div key={c.carrier_name} style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 2fr) 80px 80px 80px 80px 60px",
                  gap: 8, padding: "10px 16px",
                  borderBottom: i < carriers.length - 1 ? "1px solid var(--graphite-line)" : "none",
                  alignItems: "center",
                }}>
                  <div>
                    <span className="v-text-primary" style={{ fontSize: "0.75rem", fontWeight: 600 }}>{c.carrier_name}</span>
                    <div style={{ fontSize: "0.6rem", color: "var(--silver-500)", marginTop: 1 }}>{c.shipment_count} shipments</div>
                  </div>
                  {/* OTIF */}
                  <div>
                    <div className="v-text-emphasis" style={{ fontSize: "0.72rem", fontWeight: 700 }}>{c.otif_rate.toFixed(1)}%</div>
                    <div className="v-minibar-track" style={{ marginTop: 3 }}>
                      <div className="v-minibar-fill" style={{ width: `${c.otif_rate}%`, backgroundColor: complianceColor(c.otif_rate) }}/>
                    </div>
                  </div>
                  {/* Transit variance */}
                  <div style={{ fontSize: "0.72rem", color: Math.abs(c.avg_transit_days_variance) > 1 ? "var(--signal-amber)" : "var(--silver-700)", fontWeight: 600 }}>
                    {c.avg_transit_days_variance >= 0 ? "+" : ""}{c.avg_transit_days_variance.toFixed(1)}d
                  </div>
                  {/* Exception rate */}
                  <div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: c.exception_rate > 10 ? "var(--signal-red)" : c.exception_rate > 5 ? "var(--signal-amber)" : "var(--signal-green)" }}>
                      {c.exception_rate.toFixed(1)}%
                    </div>
                  </div>
                  {/* Compliance */}
                  <div>
                    <div className="v-text-emphasis" style={{ fontSize: "0.72rem", fontWeight: 700 }}>{c.compliance_rate.toFixed(0)}%</div>
                    <div className="v-minibar-track" style={{ marginTop: 3 }}>
                      <div className="v-minibar-fill" style={{ width: `${c.compliance_rate}%`, backgroundColor: complianceColor(c.compliance_rate) }}/>
                    </div>
                  </div>
                  {/* Score */}
                  <div style={{ color: scoreColor, fontSize: "0.8rem", fontWeight: 700 }}>{score}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lane Performance */}
      <div>
        <h3 className="v-text-primary" style={{ fontSize: "0.8rem", fontWeight: 700, margin: "0 0 12px" }}>
          Lane Performance
        </h3>
        {lanes.length === 0 ? (
          <div className="v-card">
            <div className="v-empty-state">
              <svg className="v-empty-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>
              </svg>
              <p className="v-empty-title">No Lane Data</p>
              <p className="v-empty-sub">Lane performance data is unavailable. Ensure the backend service is running.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {lanes.map((lane) => {
              const rc = riskColor(lane.avg_delay_risk_score);
              const oc = complianceColor(lane.otif_rate);
              return (
                <div key={lane.lane_name} className="v-card" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <p className="v-text-primary" style={{ fontSize: "0.78rem", fontWeight: 700 }}>{lane.lane_name}</p>
                      <p className="v-text-secondary" style={{ fontSize: "0.62rem", marginTop: 2 }}>
                        {lane.total_shipments} shipments · {lane.dominant_carrier}
                      </p>
                    </div>
                    <span className="v-kpi-value" style={{ fontSize: "1.1rem", color: rc }}>
                      {lane.avg_delay_risk_score.toFixed(0)}%
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* OTIF */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="v-text-secondary" style={{ fontSize: "0.6rem", width: 68 }}>OTIF</span>
                      <div className="v-minibar-track" style={{ flex: 1 }}>
                        <div className="v-minibar-fill" style={{ width: `${lane.otif_rate}%`, backgroundColor: oc }}/>
                      </div>
                      <span className="v-text-emphasis" style={{ fontSize: "0.65rem", fontWeight: 700, width: 36, textAlign: "right" }}>
                        {lane.otif_rate.toFixed(0)}%
                      </span>
                    </div>
                    {/* Risk */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="v-text-secondary" style={{ fontSize: "0.6rem", width: 68 }}>Delay Risk</span>
                      <div className="v-minibar-track" style={{ flex: 1 }}>
                        <div className="v-minibar-fill" style={{ width: `${lane.avg_delay_risk_score}%`, backgroundColor: rc }}/>
                      </div>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, width: 36, textAlign: "right", color: rc }}>
                        {lane.avg_delay_risk_score.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                    {lane.avg_delay_risk_score >= 60 && <span className="v-badge v-badge-red">High Risk</span>}
                    {lane.avg_delay_risk_score >= 35 && lane.avg_delay_risk_score < 60 && <span className="v-badge v-badge-amber">Med Risk</span>}
                    {lane.avg_delay_risk_score < 35 && <span className="v-badge v-badge-green">On Track</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
