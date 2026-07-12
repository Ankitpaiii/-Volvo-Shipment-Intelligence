import type { MilestoneEvent, ShipmentDetail } from "../api/client";

const MILESTONES = [
  { key: "TRANSPORT_ORDER_CREATED", label: "Order Created", icon: "📋" },
  { key: "ASN_CREATED", label: "ASN / Goods Ready", icon: "📦" },
  { key: "BOOKING_CONFIRMED", label: "Booking Confirmed", icon: "✔️" },
  { key: "PICKUP_COMPLETED", label: "Pickup Completed", icon: "🚚" },
  { key: "IN_TRANSIT", label: "In Transit", icon: "🛣️" },
  { key: "GATE_ARRIVAL", label: "Gate Arrival", icon: "🏭" },
  { key: "DOCK_CHECKIN", label: "Dock Check-in", icon: "📍" },
  { key: "UNLOAD_COMPLETE", label: "Unload Complete", icon: "📤" },
  { key: "GOODS_RECEIPT_CONFIRMED", label: "Goods Receipt", icon: "✅" },
];

interface Props {
  shipment: ShipmentDetail | null;
  events: MilestoneEvent[];
}

function RiskGauge({ score }: { score: number }) {
  const color = score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#22c55e";
  const label = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold" style={{ color }}>{score}%</span>
        </div>
      </div>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color }}>{label}</span>
    </div>
  );
}

export function ShipmentDetailPanel({ shipment, events }: Props) {
  if (!shipment) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-700/60 p-8 text-slate-600 glass">
        <div className="text-center">
          <div className="text-2xl mb-2">🗺️</div>
          <p className="text-sm">Select a shipment to view details</p>
        </div>
      </div>
    );
  }

  const completed = new Map(events.map((e) => [e.event_type, e]));
  const completedKeys = new Set(events.map((e) => e.event_type));
  const completionPct = Math.round(
    (MILESTONES.filter((m) => completedKeys.has(m.key)).length / MILESTONES.length) * 100
  );

  const refs = shipment.references || {};
  const refEntries = Object.entries(refs).filter(([, v]) => v);

  const etaDiff = shipment.predicted_delivery
    ? Math.round((new Date(shipment.predicted_delivery).getTime() - new Date(shipment.planned_delivery).getTime()) / 3600000)
    : null;

  return (
    <div className="glass rounded-xl border border-slate-700/60 overflow-hidden animate-fade-slide">
      {/* Header */}
      <div className="border-b border-slate-700/60 px-5 py-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-100">{shipment.po_number}</h2>
            <span className={`status-badge ${
              shipment.status === "AT_RISK" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
              shipment.status === "DELAYED" ? "bg-red-500/20 text-red-300 border border-red-500/30" :
              shipment.status === "DELIVERED" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
              "bg-slate-500/20 text-slate-300 border border-slate-600/30"
            }`}>{shipment.status.replace("_", " ")}</span>
            {shipment.part_criticality !== "STANDARD" && shipment.part_criticality !== "LOW" && (
              <span className="status-badge bg-sky-500/20 text-sky-300 border border-sky-500/30">
                ⚡ {shipment.part_criticality}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{shipment.lane_name}</p>
        </div>
        <RiskGauge score={shipment.delay_risk_score} />
      </div>

      <div className="p-5 grid gap-5">
        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          {[
            { label: "Supplier", value: shipment.supplier_name },
            { label: "Carrier", value: shipment.carrier_name },
            { label: "Health Score", value: `${shipment.health_score}%` },
            { label: "ETA Confidence", value: `${Math.round(shipment.eta_confidence * 100)}%` },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-lg p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-0.5 font-semibold text-slate-200 truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* ETA Comparison */}
        {shipment.predicted_delivery && (
          <div className="glass rounded-lg p-3 flex items-center justify-between text-xs">
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px]">Planned Delivery</p>
              <p className="text-slate-200 font-medium mt-0.5">{new Date(shipment.planned_delivery).toLocaleString()}</p>
            </div>
            <div className={`text-center px-3 py-1 rounded-full ${etaDiff !== null && etaDiff > 0 ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
              {etaDiff !== null && etaDiff !== 0 ? (
                <>{etaDiff > 0 ? "+" : ""}{etaDiff}h</>
              ) : "On time"}
            </div>
            <div className="text-right">
              <p className="text-slate-500 uppercase tracking-wider text-[10px]">Predicted ETA</p>
              <p className="font-medium mt-0.5">{new Date(shipment.predicted_delivery).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Reference Numbers */}
        {refEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {refEntries.map(([type, value]) => (
              <span key={type} className="text-[10px] px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                <span className="text-slate-500">{type}: </span>
                <span className="text-slate-300 font-medium">{value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Active Flags */}
        {shipment.flags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {shipment.flags.map((f) => (
              <span key={f} className="text-[10px] px-2 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-red-300 font-medium">
                ⚠ {f.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Milestone completion bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Milestone Completion</span>
            <span className="text-slate-300 font-semibold">{completionPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${completionPct}%`,
                background: completionPct >= 80 ? "#22c55e" : completionPct >= 40 ? "#f59e0b" : "#ef4444",
              }}
            />
          </div>
        </div>

        {/* Milestone Timeline */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Milestone Timeline</h3>
          <div className="space-y-0">
            {MILESTONES.map((m, i) => {
              const done = completedKeys.has(m.key);
              const evt = completed.get(m.key);
              const isLast = i === MILESTONES.length - 1;
              return (
                <div key={m.key} className="flex gap-3">
                  {/* Timeline stem */}
                  <div className="flex flex-col items-center w-5">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-all ${
                      done
                        ? "bg-emerald-500/20 border border-emerald-500 text-emerald-400"
                        : "bg-slate-800 border border-slate-700 text-slate-600"
                    }`}>
                      {done ? "✓" : "·"}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 my-0.5 ${done ? "bg-emerald-500/30" : "bg-slate-800"}`} style={{ minHeight: 12 }} />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-2 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-medium ${done ? "text-slate-200" : "text-slate-600"}`}>
                        {m.icon} {m.label}
                      </span>
                      {evt && (
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {new Date(evt.event_time).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {evt && evt.source !== "seed" && (
                      <p className="text-[10px] text-slate-600 mt-0.5">via {evt.source}</p>
                    )}
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
