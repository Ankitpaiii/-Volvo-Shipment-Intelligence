import type { MilestoneEvent, ShipmentDetail } from "../api/client";

const MILESTONES = [
  { key: "TRANSPORT_ORDER_CREATED", label: "Order Created" },
  { key: "ASN_CREATED",             label: "ASN / Goods Ready" },
  { key: "BOOKING_CONFIRMED",       label: "Booking Confirmed" },
  { key: "PICKUP_COMPLETED",        label: "Pickup Completed" },
  { key: "IN_TRANSIT",              label: "In Transit" },
  { key: "GATE_ARRIVAL",            label: "Gate Arrival" },
  { key: "DOCK_CHECKIN",            label: "Dock Check-in" },
  { key: "UNLOAD_COMPLETE",         label: "Unload Complete" },
  { key: "GOODS_RECEIPT_CONFIRMED", label: "Goods Receipt" },
];

function riskColor(score: number) {
  if (score >= 70) return "var(--signal-red)";
  if (score >= 40) return "var(--signal-amber)";
  return "var(--signal-green)";
}

function RiskGauge({ score }: { score: number }) {
  const color = riskColor(score);
  const label = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: 60, height: 60 }}>
        <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--graphite-line)" strokeWidth="3"/>
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.7s ease" }}/>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color }}>{score}%</span>
        </div>
      </div>
      <span style={{ marginTop: 4, fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color }}>{label}</span>
    </div>
  );
}

interface Props {
  shipment: ShipmentDetail | null;
  events: MilestoneEvent[];
}

export function ShipmentDetailPanel({ shipment, events }: Props) {
  if (!shipment) {
    return (
      <div className="v-card v-animate" style={{ minHeight: 180 }}>
        <div className="v-empty-state">
          <svg className="v-empty-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <p className="v-empty-title">No Shipment Selected</p>
          <p className="v-empty-sub">Select a shipment from the list to view its real-time visibility timeline.</p>
        </div>
      </div>
    );
  }

  const completedKeys = new Set(events.map((e) => e.event_type));
  const completedMap  = new Map(events.map((e) => [e.event_type, e]));
  const completionPct = Math.round((MILESTONES.filter((m) => completedKeys.has(m.key)).length / MILESTONES.length) * 100);
  const refEntries    = Object.entries(shipment.references || {}).filter(([, v]) => v);
  const etaDiff       = shipment.predicted_delivery
    ? Math.round((new Date(shipment.predicted_delivery).getTime() - new Date(shipment.planned_delivery).getTime()) / 3600000)
    : null;

  function statusBadgeClass() {
    if (shipment.status === "AT_RISK" || shipment.status === "DELAYED") return "v-badge v-badge-amber";
    if (shipment.status === "DELIVERED") return "v-badge v-badge-green";
    return "v-badge v-badge-muted";
  }

  return (
    <div className="v-card v-animate">
      {/* Header */}
      <div className="v-card-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 className="v-text-primary" style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{shipment.po_number}</h2>
            <span className={statusBadgeClass()}>{shipment.status.replace("_", " ")}</span>
            {shipment.part_criticality !== "STANDARD" && shipment.part_criticality !== "LOW" && (
              <span className="v-badge v-badge-amber">{shipment.part_criticality}</span>
            )}
          </div>
          <p className="v-text-secondary" style={{ fontSize: "0.72rem", marginTop: 4 }}>{shipment.lane_name}</p>
        </div>
        <RiskGauge score={shipment.delay_risk_score} />
      </div>

      <div style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
        {/* Key Info Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { label: "Supplier",      value: shipment.supplier_name },
            { label: "Carrier",       value: shipment.carrier_name },
            { label: "Health Score",  value: `${shipment.health_score}%` },
            { label: "ETA Confidence",value: `${Math.round(shipment.eta_confidence * 100)}%` },
          ].map(({ label, value }) => (
            <div key={label} style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--graphite-line)", borderRadius: 6, padding: "8px 10px" }}>
              <p className="v-kpi-label" style={{ marginBottom: 4 }}>{label}</p>
              <p className="v-text-primary" style={{ fontSize: "0.72rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ETA Comparison */}
        {shipment.predicted_delivery && (
          <div style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--graphite-line)", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p className="v-kpi-label" style={{ marginBottom: 3 }}>Planned Delivery</p>
              <p className="v-text-primary" style={{ fontSize: "0.72rem", fontWeight: 600 }}>{new Date(shipment.planned_delivery).toLocaleString()}</p>
            </div>
            <div style={{
              padding: "4px 12px", borderRadius: 9999,
              backgroundColor: etaDiff !== null && etaDiff > 0 ? "var(--signal-red)" : "var(--signal-green)",
              color: "#050505", fontSize: "0.7rem", fontWeight: 700,
            }}>
              {etaDiff !== null && etaDiff !== 0 ? `${etaDiff > 0 ? "+" : ""}${etaDiff}h` : "On time"}
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="v-kpi-label" style={{ marginBottom: 3 }}>Predicted ETA</p>
              <p className="v-text-primary" style={{ fontSize: "0.72rem", fontWeight: 600 }}>{new Date(shipment.predicted_delivery).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* References */}
        {refEntries.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {refEntries.map(([type, value]) => (
              <span key={type} style={{ fontSize: "0.62rem", padding: "3px 8px", borderRadius: 9999, backgroundColor: "var(--bg-panel)", border: "1px solid var(--graphite-line)" }}>
                <span className="v-text-secondary">{type}: </span>
                <span className="v-text-emphasis" style={{ fontWeight: 600 }}>{value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Flags */}
        {shipment.flags?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {shipment.flags.map((f) => (
              <span key={f} className="v-badge v-badge-red">{f.replace(/_/g, " ")}</span>
            ))}
          </div>
        )}

        {/* Milestone progress */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="v-text-emphasis" style={{ fontSize: "0.72rem", fontWeight: 600 }}>Milestone Completion</span>
            <span className="v-text-primary" style={{ fontSize: "0.72rem", fontWeight: 700 }}>{completionPct}%</span>
          </div>
          <div className="v-progress-track" style={{ height: 3 }}>
            <div className="v-progress-fill" style={{
              width: `${completionPct}%`,
              backgroundColor: completionPct >= 80 ? "var(--signal-green)" : completionPct >= 40 ? "var(--signal-amber)" : "var(--signal-red)",
            }}/>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <p className="v-kpi-label" style={{ marginBottom: 10 }}>Milestone Timeline</p>
          <div>
            {MILESTONES.map((m, i) => {
              const done = completedKeys.has(m.key);
              const evt  = completedMap.get(m.key);
              const isLast = i === MILESTONES.length - 1;
              return (
                <div key={m.key} style={{ display: "flex", gap: 10 }}>
                  {/* Stem */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 18 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${done ? "var(--signal-green)" : "var(--graphite-line)"}`,
                      backgroundColor: done ? "var(--signal-green)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.3s ease",
                    }}>
                      {done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#050505" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                    {!isLast && (
                      <div style={{
                        width: 2, flex: 1, minHeight: 12, marginTop: 2,
                        backgroundColor: done ? "var(--signal-green)" : "var(--graphite-line)",
                        opacity: done ? 0.4 : 1,
                        transition: "background-color 0.3s ease",
                      }}/>
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ paddingBottom: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: done ? 600 : 400, color: done ? "var(--platinum-100)" : "var(--silver-500)" }}>
                        {m.label}
                      </span>
                      {evt && (
                        <span className="v-text-secondary" style={{ fontSize: "0.6rem", flexShrink: 0 }}>
                          {new Date(evt.event_time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
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
