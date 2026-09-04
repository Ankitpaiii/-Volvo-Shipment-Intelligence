import { useState } from "react";
import type { Shipment } from "../api/client";

interface Props {
  shipments: Shipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

type QuickFilter = "ALL" | "P1" | "DELAYED" | "CUSTOMS" | "AT_BERTH";

function dotColor(s: Shipment): string {
  if (s.delay_risk_score >= 70) return "var(--crit)";
  if (s.delay_risk_score >= 40) return "var(--warn)";
  return "var(--ok)";
}

export function ShipmentList({ shipments, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<QuickFilter>("ALL");

  const filtered = shipments.filter((s) => {
    if (filter === "ALL") return true;
    if (filter === "P1") return s.delay_risk_score >= 70;
    if (filter === "DELAYED") return s.status === "DELAYED" || s.delay_risk_score >= 60;
    if (filter === "CUSTOMS") return s.flags?.some((f) => f.includes("CUSTOMS")) || s.status === "CUSTOMS_HOLD";
    if (filter === "AT_BERTH") return s.status === "AT_BERTH" || s.status === "PORT_ARRIVAL";
    return true;
  });

  return (
    <div>
      {/* Filter bar */}
      <div className="v-filter-strip">
        {(["ALL", "P1", "DELAYED", "CUSTOMS", "AT_BERTH"] as const).map((f) => (
          <button
            key={f}
            className={`v-chip ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "All" : f === "DELAYED" ? "Delayed" : f === "CUSTOMS" ? "Customs" : f === "AT_BERTH" ? "At berth" : f}
          </button>
        ))}
      </div>

      {/* Rows */}
      {filtered.length === 0 ? (
        <div className="v-empty">
          <p>No shipments found</p>
        </div>
      ) : (
        filtered.map((s) => {
          const isSelected = s.shipment_id === selectedId;
          const isLate = s.delay_risk_score >= 50;
          const dateStr = s.planned_delivery ? new Date(s.planned_delivery).toLocaleDateString([], { day: "2-digit", month: "short" }) : "18 Sep";
          const diffHours = s.delay_risk_score >= 70 ? "+2d 86h" : s.delay_risk_score >= 40 ? "+9h" : "on time";

          return (
            <button
              key={s.shipment_id}
              className="v-row"
              aria-selected={isSelected}
              onClick={() => onSelect(s.shipment_id)}
            >
              <span
                className="v-dot"
                style={{
                  background: isSelected ? "var(--plum)" : dotColor(s),
                  boxShadow: `0 0 0 2px var(--surface), 0 0 6px ${dotColor(s)}`,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <span className="v-row-id">{s.po_number}</span>
                <span className="v-row-lane">
                  {s.origin_city} → {s.dest_city}
                </span>
              </div>
              <div className={`v-row-eta ${isLate ? "late" : ""}`}>
                <b>{dateStr}</b>
                <small>{diffHours}</small>
              </div>
              <span className="v-row-go">→</span>
            </button>
          );
        })
      )}
    </div>
  );
}
