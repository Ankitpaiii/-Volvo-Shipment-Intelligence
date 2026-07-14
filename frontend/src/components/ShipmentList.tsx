import { useState } from "react";
import type { Shipment } from "../api/client";

function riskColor(score: number): string {
  if (score >= 70) return "var(--signal-red)";
  if (score >= 40) return "var(--signal-amber)";
  return "var(--signal-green)";
}

const STATUS_FILTERS = ["ALL", "IN_TRANSIT", "AT_RISK", "DELAYED", "DELIVERED", "PLANNED"] as const;

interface Props {
  shipments: Shipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ShipmentList({ shipments, selectedId, onSelect }: Props) {
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [critFilter, setCritFilter]     = useState<string>("ALL");
  const [sort, setSort]                 = useState<"risk" | "eta">("risk");

  const filtered = shipments
    .filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (critFilter !== "ALL" && s.part_criticality !== critFilter) return false;
      if (search) {
        const t = search.toLowerCase();
        return (
          s.po_number.toLowerCase().includes(t) ||
          s.supplier_name.toLowerCase().includes(t) ||
          s.carrier_name.toLowerCase().includes(t) ||
          s.dest_city.toLowerCase().includes(t)
        );
      }
      return true;
    })
    .sort((a, b) => sort === "eta"
      ? new Date(a.planned_delivery).getTime() - new Date(b.planned_delivery).getTime()
      : b.delay_risk_score - a.delay_risk_score
    );

  return (
    <div className="v-card" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="v-card-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <p className="v-text-primary" style={{ fontSize: "0.8rem", fontWeight: 700, margin: 0 }}>Live Shipments</p>
            <p className="v-text-secondary" style={{ fontSize: "0.65rem", marginTop: 2 }}>
              {filtered.length} of {shipments.length} shown
            </p>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["risk", "eta"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`v-filter-pill${sort === s ? " active" : ""}`}
              >
                {s === "risk" ? "By Risk" : "By ETA"}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="var(--silver-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="v-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, supplier, carrier…"
          />
        </div>

        {/* Status pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`v-filter-pill${statusFilter === f ? " active" : ""}`}
            >
              {f === "ALL" ? "All" : f.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Criticality pills */}
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          {["ALL", "JIT", "JIS", "STANDARD"].map((c) => (
            <button
              key={c}
              onClick={() => setCritFilter(c)}
              className={`v-filter-pill${critFilter === c ? " active" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div className="v-empty-state">
            <svg className="v-empty-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <p className="v-empty-title">No Shipments Found</p>
            <p className="v-empty-sub">Try resetting active filters or clearing your search query.</p>
          </div>
        ) : (
          filtered.map((s) => {
            const color = riskColor(s.delay_risk_score);
            const isSelected = s.shipment_id === selectedId;

            return (
              <button
                key={s.shipment_id}
                onClick={() => onSelect(s.shipment_id)}
                className={isSelected ? "v-row-selected" : ""}
                style={{
                  width: "100%",
                  display: "block",
                  textAlign: "left",
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--graphite-line)",
                  cursor: "pointer",
                  backgroundColor: isSelected ? "var(--bg-panel-raised)" : "transparent",
                  borderLeft: isSelected ? `3px solid var(--signal-amber)` : "3px solid transparent",
                  transition: "background-color 0.15s ease, box-shadow 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="v-text-primary" style={{ fontSize: "0.8rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.po_number}
                      </span>
                      {s.part_criticality !== "STANDARD" && s.part_criticality !== "LOW" && (
                        <span className="v-badge v-badge-amber">{s.part_criticality}</span>
                      )}
                    </div>
                    <p className="v-text-secondary" style={{ fontSize: "0.68rem", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.origin_city} → {s.dest_city}
                    </p>
                    <p style={{ fontSize: "0.62rem", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--silver-500)" }}>
                      {s.carrier_name}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span className="v-badge" style={{ color, borderColor: color, fontSize: "0.65rem", fontWeight: 700 }}>
                      {s.delay_risk_score}%
                    </span>
                    <span style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--silver-500)" }}>
                      {s.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
                {/* Risk bar */}
                <div className="v-progress-track" style={{ marginTop: 8 }}>
                  <div className="v-progress-fill" style={{ width: `${s.delay_risk_score}%`, backgroundColor: color }} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
