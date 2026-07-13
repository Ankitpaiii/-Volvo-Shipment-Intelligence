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

function sevColors(sev: string) {
  if (sev === "P1") return { left: "var(--signal-red)", badge: "v-badge-red", isP1: true };
  if (sev === "P2") return { left: "var(--signal-amber)", badge: "v-badge-amber", isP1: false };
  return { left: "var(--graphite-line)", badge: "v-badge-muted", isP1: false };
}

function ExceptionIcon({ type }: { type: string }) {
  const s = { width: 14, height: 14, flexShrink: 0, marginTop: 2 } as const;
  const stroke = "var(--silver-500)";
  const sw = "1.8";
  switch (type) {
    case "DELAY_RISK_HIGH":
    case "MISSING_PICKUP":
      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="var(--signal-amber)" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "GPS_OFFLINE":
    case "GPS_OFFLINE_CRITICAL":
      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>;
    case "CUSTOMS_HOLD":
      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case "MISSING_ASN":
      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
    default:
      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
  }
}

interface Props {
  exceptions: Exception[];
  onAction: (id: string, action: string) => void;
}

export function ExceptionQueue({ exceptions, onAction }: Props) {
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [confirm, setConfirm]           = useState<{ id: string; action: string } | null>(null);
  const [sevFilter, setSevFilter]       = useState<"ALL" | "P1" | "P2">("ALL");

  const filtered = exceptions.filter((e) => sevFilter === "ALL" || e.severity === sevFilter);
  const p1Count  = exceptions.filter((e) => e.severity === "P1").length;

  const handleAction = (id: string, action: string) => {
    if (action === "approve_recommendation") setConfirm({ id, action });
    else onAction(id, action);
  };

  return (
    <>
      <div className="v-card" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Header */}
        <div className="v-card-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="v-text-primary" style={{ fontSize: "0.8rem", fontWeight: 700 }}>Exception Queue</span>
              {p1Count > 0 && <span className="v-badge v-badge-red">{p1Count} P1</span>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["ALL", "P1", "P2"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSevFilter(f)}
                  className={`v-filter-pill${sevFilter === f ? " active" : ""}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <p className="v-text-secondary" style={{ fontSize: "0.65rem", marginTop: 4 }}>
            Ranked by business impact · {exceptions.length} open
          </p>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {filtered.length === 0 ? (
            <div className="v-empty-state">
              <svg className="v-empty-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p className="v-empty-title">No Open Exceptions</p>
              <p className="v-empty-sub">All shipments are operating within SLA parameters.</p>
            </div>
          ) : filtered.map((e) => {
            const { left, badge, isP1 } = sevColors(e.severity);
            const isOpen = expanded === e.exception_id;

            return (
              <div
                key={e.exception_id}
                className={isP1 ? "v-p1-pulse" : ""}
                style={{
                  marginBottom: 6,
                  borderRadius: 8,
                  border: `1px solid var(--graphite-line)`,
                  borderLeft: `3px solid ${left}`,
                  backgroundColor: "var(--bg-panel)",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease",
                }}
                onClick={() => setExpanded(isOpen ? null : e.exception_id)}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
                    <ExceptionIcon type={e.exception_type} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span className="v-text-primary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                          {e.exception_type.replace(/_/g, " ")}
                        </span>
                        <span className={`v-badge ${badge}`}>{e.severity}</span>
                      </div>
                      <p className="v-text-secondary" style={{ fontSize: "0.68rem", marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {e.message}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span className="v-text-emphasis" style={{ fontSize: "0.72rem", fontWeight: 700 }}>
                      {e.business_impact_score}
                    </span>
                    <p className="v-text-secondary" style={{ fontSize: "0.6rem", marginTop: 2 }}>
                      {timeAgo(e.raised_at)}
                    </p>
                  </div>
                </div>

                {isOpen && (
                  <div
                    className="v-animate"
                    style={{ borderTop: "1px solid var(--graphite-line)", padding: "10px 12px" }}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    {e.po_number && (
                      <div style={{ display: "flex", gap: 12, fontSize: "0.68rem", marginBottom: 6 }}>
                        <span className="v-text-secondary">PO:</span>
                        <span className="v-text-emphasis" style={{ fontWeight: 600 }}>{e.po_number}</span>
                        {e.lane_name && <>
                          <span className="v-text-secondary">Lane:</span>
                          <span className="v-text-emphasis">{e.lane_name}</span>
                        </>}
                      </div>
                    )}
                    {e.root_cause && (
                      <p style={{ fontSize: "0.68rem", marginBottom: 8 }}>
                        <span className="v-text-secondary">Root Cause: </span>
                        <span className="v-text-primary">{e.root_cause.replace(/_/g, " ")}</span>
                      </p>
                    )}
                    {e.recommended_action && (
                      <div style={{ backgroundColor: "var(--bg-panel-raised)", border: "1px solid var(--graphite-line)", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
                        <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--silver-700)", marginBottom: 4 }}>
                          Recommended Action
                        </p>
                        <p className="v-text-secondary" style={{ fontSize: "0.7rem" }}>{e.recommended_action}</p>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="v-btn-ghost" style={{ flex: 1, fontSize: "0.68rem", padding: "6px 10px" }}
                        onClick={() => handleAction(e.exception_id, "acknowledge", "Acknowledge")}>
                        Acknowledge
                      </button>
                      {e.recommended_action && (
                        <button className="v-btn-ghost" style={{ flex: 1, fontSize: "0.68rem", padding: "6px 10px", color: "var(--silver-700)", borderColor: "var(--silver-700)" }}
                          onClick={() => handleAction(e.exception_id, "approve_recommendation", "Approve")}>
                          Approve Action
                        </button>
                      )}
                      <button className="v-btn-ghost" style={{ flex: 1, fontSize: "0.68rem", padding: "6px 10px", color: "var(--signal-green)", borderColor: "var(--signal-green)" }}
                        onClick={() => onAction(e.exception_id, "resolve")}>
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

      {/* Confirm Modal */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(5,5,5,0.8)",
        }}>
          <div className="v-card" style={{ maxWidth: 360, width: "100%", margin: "0 16px", padding: 24 }}>
            <h3 className="v-text-primary" style={{ fontSize: "0.9rem", fontWeight: 700, margin: "0 0 8px" }}>Confirm Action</h3>
            <p className="v-text-secondary" style={{ fontSize: "0.75rem", marginBottom: 20 }}>
              This will acknowledge the exception and log the recommended action. Continue?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="v-btn-ghost" style={{ flex: 1 }} onClick={() => setConfirm(null)}>Cancel</button>
              <button className="v-btn-primary" style={{ flex: 1 }} onClick={() => { onAction(confirm.id, confirm.action); setConfirm(null); }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
