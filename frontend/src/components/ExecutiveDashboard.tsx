import { useEffect, useState } from "react";
import { api, type CarrierScorecard, type ExtendedKPIs, type LanePerformance } from "../api/client";

function MiniBar({ value, max = 100, color = "#22c55e" }: { value: number; max?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
        />
      </div>
      <span className="text-xs font-medium text-slate-300 w-10 text-right">{value}%</span>
    </div>
  );
}

function complianceColor(rate: number): string {
  if (rate >= 85) return "#22c55e";
  if (rate >= 65) return "#f59e0b";
  return "#ef4444";
}

function riskColor(score: number): string {
  if (score >= 60) return "#ef4444";
  if (score >= 35) return "#f59e0b";
  return "#22c55e";
}

interface Props {
  extKpis: ExtendedKPIs | null;
}

export function ExecutiveDashboard({ extKpis }: Props) {
  const [carriers, setCarriers] = useState<CarrierScorecard[]>([]);
  const [lanes, setLanes] = useState<LanePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getCarrierScorecards(), api.getLanePerformance()])
      .then(([c, l]) => {
        setCarriers(c);
        setLanes(l);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* Top-level executive KPIs */}
      {extKpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "OTIF Rate", value: `${extKpis.otif_pct}%`, color: "text-emerald-400", desc: "On-time In-Full", icon: "✅" },
            { label: "On-Time Pickup", value: `${extKpis.on_time_pickup_pct}%`, color: "text-sky-400", desc: "Carrier punctuality", icon: "🚚" },
            { label: "Carrier Compliance", value: `${extKpis.carrier_compliance_pct}%`, color: "text-violet-400", desc: "Milestone reporting rate", icon: "📋" },
            { label: "Avg Dwell Time", value: `${extKpis.avg_dwell_hours}h`, color: "text-amber-400", desc: "Gate → Unload complete", icon: "⏱️" },
          ].map(({ label, value, color, desc, icon }) => (
            <div key={label} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
                <span className="text-lg">{icon}</span>
              </div>
              <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-600 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Carrier Scorecards */}
        <div className="glass rounded-xl border border-slate-700/60 overflow-hidden">
          <div className="border-b border-slate-700/60 px-4 py-3">
            <h2 className="font-semibold text-slate-100">Carrier Scorecards</h2>
            <p className="text-xs text-slate-500">Performance across all active carriers</p>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Carrier</th>
                    <th className="text-right px-3 py-2 text-slate-500 font-medium">Ships</th>
                    <th className="text-right px-3 py-2 text-slate-500 font-medium">At Risk</th>
                    <th className="px-3 py-2 text-slate-500 font-medium min-w-[100px]">On-Time</th>
                    <th className="px-3 py-2 text-slate-500 font-medium min-w-[100px]">Compliance</th>
                    <th className="text-right px-4 py-2 text-slate-500 font-medium">P1 Exc</th>
                  </tr>
                </thead>
                <tbody>
                  {carriers.map((c) => (
                    <tr key={c.carrier_name} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition">
                      <td className="px-4 py-3 font-medium text-slate-200">{c.carrier_name}</td>
                      <td className="px-3 py-3 text-right text-slate-400">{c.total_shipments}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={c.at_risk_count > 2 ? "text-red-400" : c.at_risk_count > 0 ? "text-amber-400" : "text-emerald-400"}>
                          {c.at_risk_count}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <MiniBar value={c.on_time_rate} color={complianceColor(c.on_time_rate)} />
                      </td>
                      <td className="px-3 py-3">
                        <MiniBar value={c.compliance_rate} color={complianceColor(c.compliance_rate)} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={c.p1_exception_count > 0 ? "text-red-400 font-semibold" : "text-slate-600"}>
                          {c.p1_exception_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lane Performance */}
        <div className="glass rounded-xl border border-slate-700/60 overflow-hidden">
          <div className="border-b border-slate-700/60 px-4 py-3">
            <h2 className="font-semibold text-slate-100">Lane Performance</h2>
            <p className="text-xs text-slate-500">Sorted by average risk score — highest first</p>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-2 max-h-[480px] overflow-y-auto">
              {lanes.map((lane) => (
                <div key={lane.lane_name} className="glass rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{lane.lane_name}</p>
                      <p className="text-[10px] text-slate-500">{lane.total_shipments} shipments · {lane.active_exceptions} open exceptions</p>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: `${riskColor(lane.avg_risk_score)}20`,
                        color: riskColor(lane.avg_risk_score),
                        border: `1px solid ${riskColor(lane.avg_risk_score)}40`,
                      }}
                    >
                      {lane.avg_risk_score}% avg risk
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <p className="text-slate-500 mb-0.5">On-Time Rate</p>
                      <MiniBar value={lane.on_time_rate} color={complianceColor(lane.on_time_rate)} />
                    </div>
                    <div>
                      <p className="text-slate-500 mb-0.5">Milestone Completeness</p>
                      <MiniBar value={lane.avg_milestone_completeness} color="#818cf8" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Network health summary */}
      {extKpis && (
        <div className="glass rounded-xl border border-slate-700/60 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Network Health Summary</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs text-slate-400">
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Total Active Shipments</p>
              <p className="text-2xl font-bold text-slate-100">{extKpis.total_shipments}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">In Transit</p>
              <p className="text-2xl font-bold text-sky-400">{extKpis.shipments_in_transit}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">JIT/JIS At Risk</p>
              <p className={`text-2xl font-bold ${extKpis.critical_at_risk > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {extKpis.critical_at_risk}
              </p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider text-[10px] mb-1">Missing Milestones</p>
              <p className={`text-2xl font-bold ${extKpis.missing_milestone_count > 3 ? "text-amber-400" : "text-slate-300"}`}>
                {extKpis.missing_milestone_count}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
