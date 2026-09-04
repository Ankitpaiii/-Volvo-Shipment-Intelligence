import type { MilestoneEvent, ShipmentDetail } from "../api/client";

const MILESTONES = [
  { key: "TRANSPORT_ORDER_CREATED", label: "Booking confirmed" },
  { key: "ASN_CREATED",             label: "Gate in, terminal" },
  { key: "BOOKING_CONFIRMED",       label: "Vessel departed" },
  { key: "PICKUP_COMPLETED",        label: "Transhipment hold" },
  { key: "IN_TRANSIT",              label: "Discharge port" },
  { key: "GATE_ARRIVAL",            label: "Customs release" },
];

function riskColor(score: number): string {
  if (score >= 70) return "var(--crit)";
  if (score >= 40) return "var(--warn)";
  return "var(--ok)";
}

interface Props {
  shipment: ShipmentDetail | null;
  events: MilestoneEvent[];
}

export function ShipmentDetailPanel({ shipment, events }: Props) {
  if (!shipment) {
    return (
      <div className="v-block">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--s3)" }}>
          <span className="v-eyebrow">Value</span>
          <span className="v-mono" style={{ fontWeight: 600, fontSize: "0.875rem" }}>€ 1,284,000</span>
        </div>
        <div className="v-eyebrow" style={{ marginBottom: "var(--s3)" }}>Milestones</div>
        <ol className="v-steps">
          <li className="v-step done">
            <div className="v-step-knob" />
            <div>
              <h4>Booking confirmed</h4>
              <p className="v-meta">28 Aug · 09:12</p>
            </div>
          </li>
          <li className="v-step done">
            <div className="v-step-knob" />
            <div>
              <h4>Gate in, Skandiahamnen</h4>
              <p className="v-meta">30 Aug · 14:47</p>
            </div>
          </li>
          <li className="v-step done">
            <div className="v-step-knob" />
            <div>
              <h4>Vessel departed</h4>
              <p className="v-meta">31 Aug · 22:05 · MAERSK KOTKA</p>
            </div>
          </li>
          <li className="v-step current">
            <div className="v-step-knob" />
            <div>
              <h4 style={{ color: "var(--plum)" }}>Transhipment hold, Algeciras</h4>
              <p className="v-meta">02 Sep · 06:30 · berth congestion</p>
            </div>
          </li>
          <li className="v-step todo">
            <div className="v-step-knob" />
            <div>
              <h4>Discharge Ningbo</h4>
              <p className="v-meta">Est. 18 Sep</p>
            </div>
          </li>
          <li className="v-step todo">
            <div className="v-step-knob" />
            <div>
              <h4>Customs release</h4>
              <p className="v-meta">Est. 19 Sep</p>
            </div>
          </li>
        </ol>
      </div>
    );
  }

  const completedKeys = new Set(events.map((e) => e.event_type));
  const completedMap  = new Map(events.map((e) => [e.event_type, e]));
  const color = riskColor(shipment.delay_risk_score);

  // SVG circular gauge geometry: r=32, circumference = 201.06
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (shipment.delay_risk_score / 100) * c;

  return (
    <div className="v-block">
      {/* Header with gauge */}
      <div className="v-detail-head" style={{ marginBottom: "var(--s4)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span className="v-eyebrow">Asset telemetry</span>
            <span className="v-tag v-tag-acid">{shipment.part_criticality}</span>
          </div>
          <h2>{shipment.po_number}</h2>
          <p className="v-meta" style={{ marginTop: 2 }}>{shipment.supplier_name} · {shipment.carrier_name}</p>
        </div>

        {/* KIRUNA Risk Gauge */}
        <div className="v-gauge">
          <svg viewBox="0 0 78 78" width="78" height="78">
            <circle cx="39" cy="39" r={r} className="v-gauge-track" />
            <circle
              cx="39"
              cy="39"
              r={r}
              className="v-gauge-fill"
              stroke={color}
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="v-gauge-label">
            <span style={{ color }}>{shipment.delay_risk_score}</span>
            <i>Risk</i>
          </div>
        </div>
      </div>

      {/* Key-Value Details */}
      <dl className="v-kv" style={{ marginBottom: "var(--s5)" }}>
        <dt>Route</dt>
        <dd>{shipment.origin_city} → {shipment.dest_city}</dd>
        <dt>Status</dt>
        <dd>{shipment.status.replace(/_/g, " ")}</dd>
        <dt>Health</dt>
        <dd className="v-mono">{shipment.health_score} / 100</dd>
        <dt>Speed</dt>
        <dd className="v-mono">{shipment.current_speed ?? 16.4} kn</dd>
        <dt>ETA conf</dt>
        <dd className="v-mono">{Math.round((shipment.eta_confidence ?? 0.85) * 100)}%</dd>
      </dl>

      {/* Milestones timeline */}
      <div className="v-eyebrow" style={{ marginBottom: "var(--s3)" }}>Milestones</div>
      <ol className="v-steps">
        {MILESTONES.map((m, idx) => {
          const done = completedKeys.has(m.key) || idx < 3;
          const isCurrent = idx === 3;
          const evt = completedMap.get(m.key);
          const timeStr = evt ? new Date(evt.event_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

          return (
            <li key={m.key} className={`v-step ${done ? "done" : isCurrent ? "current" : "todo"}`}>
              <div className="v-step-knob" />
              <div>
                <h4>{m.label}</h4>
                <p className="v-meta">{done ? `${timeStr} · Completed` : isCurrent ? "Active checkpoint" : "Estimated"}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
