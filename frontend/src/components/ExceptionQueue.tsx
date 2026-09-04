import { useState } from "react";
import type { Exception } from "../api/client";

interface Props {
  exceptions: Exception[];
  onAction: (id: string, action: string) => void;
}

export function ExceptionQueue({ exceptions, onAction }: Props) {
  const [sevFilter, setSevFilter] = useState<"ALL" | "P1" | "P2">("ALL");

  const filtered = exceptions.filter((e) => sevFilter === "ALL" || e.severity === sevFilter);
  const p1Count = exceptions.filter((e) => e.severity === "P1").length;

  return (
    <div>
      {/* Filter strip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--s3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {p1Count > 0 && <span className="v-prio-p1">{p1Count} P1</span>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["ALL", "P1", "P2"] as const).map((sev) => (
            <button
              key={sev}
              className={`v-chip ${sevFilter === sev ? "active" : ""}`}
              onClick={() => setSevFilter(sev)}
              style={{ padding: "3px 9px", fontSize: "0.6875rem" }}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Exception cards */}
      {filtered.length === 0 ? (
        <div className="v-empty" style={{ padding: "var(--s5) 0" }}>
          <p>No open exceptions for this filter.</p>
        </div>
      ) : (
        filtered.map((e) => {
          const isP1 = e.severity === "P1";
          return (
            <div key={e.exception_id} className="v-exception">
              <div className="v-exception-top">
                <span className={isP1 ? "v-prio-p1" : "v-prio-p2"}>{e.severity}</span>
                <h4 style={{ margin: 0, fontWeight: 600 }}>{e.exception_type.replace(/_/g, " ")}</h4>
              </div>
              <p>{e.message}</p>
              <div className="v-exception-acts">
                <button
                  className="v-btn v-btn-sm v-btn-key"
                  onClick={() => onAction(e.exception_id, "acknowledge")}
                >
                  Acknowledge
                </button>
                <button
                  className="v-btn v-btn-sm"
                  onClick={() => onAction(e.exception_id, "reroute")}
                >
                  {isP1 ? "Reroute" : "Mute 1h"}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
