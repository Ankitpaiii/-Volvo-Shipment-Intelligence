import { useState } from "react";
import type { Exception } from "../api/client";

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function severityStyle(sev: string) {
  if (sev === "P1") return {
    border: "border-l-red-500",
    bg: "bg-red-500/6",
    badge: "bg-red-500/20 text-red-300 border-red-500/40",
    glow: "animate-p1-flash",
  };
  if (sev === "P2") return {
    border: "border-l-amber-500",
    bg: "bg-amber-500/6",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    glow: "",
  };
  return {
    border: "border-l-slate-600",
    bg: "bg-slate-500/5",
    badge: "bg-slate-500/20 text-slate-400 border-slate-600/40",
    glow: "",
  };
}

const EXCEPTION_ICONS: Record<string, string> = {
  MISSING_ASN: "📦",
  MISSING_PICKUP: "🚚",
  GPS_OFFLINE: "📡",
  GPS_OFFLINE_CRITICAL: "🔴",
  DELAY_RISK_HIGH: "⚠️",
  CUSTOMS_HOLD: "🛃",
  CARRIER_NON_COMPLIANT: "📋",
  MILESTONE_SLA_BREACH: "⏱️",
};

interface ConfirmModal {
  exceptionId: string;
  action: string;
  label: string;
}

interface Props {
  exceptions: Exception[];
  onAction: (id: string, action: string) => void;
}

export function ExceptionQueue({ exceptions, onAction }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmModal | null>(null);
  const [severityFilter, setSeverityFilter] = useState<"ALL" | "P1" | "P2">("ALL");

  const filtered = exceptions.filter((e) => severityFilter === "ALL" || e.severity === severityFilter);
  const p1Count = exceptions.filter((e) => e.severity === "P1").length;

  const handleAction = (id: string, action: string, label: string) => {
    if (action === "approve_recommendation") {
      setConfirm({ exceptionId: id, action, label });
    } else {
      onAction(id, action);
    }
  };

  return (
    <>
      <div className="glass rounded-xl border border-slate-700/60 overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-700/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-100">Exception Queue</h2>
                {p1Count > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/25 text-red-300 border border-red-500/40">
                    {p1Count} P1
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Ranked by business impact · {exceptions.length} open</p>
            </div>
            <div className="flex gap-1 text-xs">
              {(["ALL", "P1", "P2"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSeverityFilter(f)}
                  className={`px-2 py-0.5 rounded transition ${
                    severityFilter === f
                      ? f === "P1" ? "bg-red-500/25 text-red-300" : f === "P2" ? "bg-amber-500/25 text-amber-300" : "bg-sky-600/30 text-sky-300"
                      : "text-slate-600 hover:text-slate-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto space-y-1 p-2">
          {filtered.length === 0 && (
            <div className="py-10 text-center">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-sm text-slate-500">No open exceptions</p>
            </div>
          )}

          {filtered.map((e) => {
            const style = severityStyle(e.severity);
            const isExpanded = expanded === e.exception_id;
            const icon = EXCEPTION_ICONS[e.exception_type] || "🔔";

            return (
              <div
                key={e.exception_id}
                className={`rounded-lg border-l-4 border border-slate-700/40 p-3 transition-all duration-200 cursor-pointer ${style.border} ${style.bg} ${style.glow}`}
                onClick={() => setExpanded(isExpanded ? null : e.exception_id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-base shrink-0 mt-0.5">{icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-slate-100">{e.exception_type.replace(/_/g, " ")}</p>
                        <span className={`status-badge border ${style.badge}`}>{e.severity}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{e.message}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-bold text-slate-300">Impact {e.business_impact_score}</span>
                    <span className="text-[10px] text-slate-600">{timeAgo(e.raised_at)}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 animate-fade-slide" onClick={(ev) => ev.stopPropagation()}>
                    {e.po_number && (
                      <div className="flex gap-3 text-xs">
                        <span className="text-slate-500">PO:</span>
                        <span className="text-slate-300 font-medium">{e.po_number}</span>
                        {e.lane_name && <><span className="text-slate-500">Lane:</span><span className="text-slate-300">{e.lane_name}</span></>}
                      </div>
                    )}
                    {e.root_cause && (
                      <div className="text-xs"><span className="text-slate-500">Root Cause: </span><span className="text-slate-300">{e.root_cause.replace(/_/g, " ")}</span></div>
                    )}
                    {e.recommended_action && (
                      <div className="glass rounded-lg p-2.5">
                        <p className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider mb-1">Recommended Action</p>
                        <p className="text-xs text-slate-300">{e.recommended_action}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleAction(e.exception_id, "acknowledge", "Acknowledge")}
                        className="flex-1 rounded-lg border border-slate-600 bg-slate-800/60 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700/60 transition"
                      >
                        Acknowledge
                      </button>
                      {e.recommended_action && (
                        <button
                          onClick={() => handleAction(e.exception_id, "approve_recommendation", "Approve Action")}
                          className="flex-1 rounded-lg bg-sky-600/30 border border-sky-500/40 px-2 py-1.5 text-xs text-sky-300 hover:bg-sky-600/50 transition font-medium"
                        >
                          ✓ Approve Action
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(e.exception_id, "resolve", "Resolve")}
                        className="flex-1 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-slide">
          <div className="glass rounded-2xl border border-slate-600 p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100">Confirm Action</h3>
            <p className="mt-2 text-sm text-slate-400">
              This will mark the exception as acknowledged and log the recommended action. Continue?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-400 hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onAction(confirm.exceptionId, confirm.action);
                  setConfirm(null);
                }}
                className="flex-1 rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-500 transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
