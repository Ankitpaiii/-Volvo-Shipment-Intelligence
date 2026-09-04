import { useState } from "react";
import { Container, Shipment, allocateSlot } from "../api/client";

interface ContainerTrackingViewProps {
  containers: Container[];
  shipments: Shipment[];
  onAllocated?: () => void;
  onRefresh?: () => void;
}

type FilterKey = "ALL" | "AT_GATE" | "YARD_STACKED" | "IN_TRANSIT" | "HAZARD" | "REEFER" | "DWELL";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    YARD_STACKED: { label: "In yard",     cls: "v-tag v-tag-ok" },
    AT_GATE:      { label: "At gate",     cls: "v-tag v-tag-warn" },
    IN_TRANSIT:   { label: "In transit",  cls: "v-tag" },
    DEPARTED:     { label: "Gate out",    cls: "v-tag" },
    INSPECTION:   { label: "Inspection",  cls: "v-tag v-tag-crit" },
  };
  const m = map[status] ?? { label: status, cls: "v-tag" };
  return <span className={m.cls}>{m.label}</span>;
}

export function ContainerTrackingView({
  containers,
  shipments: _shipments,
  onAllocated,
  onRefresh,
}: ContainerTrackingViewProps) {
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [allocatingId, setAllocatingId] = useState<string | null>(null);
  const [allocMsg, setAllocMsg] = useState<{ id: string; text: string } | null>(null);

  const hazardCount  = containers.filter((c) => c.hazard).length;
  const dwellCount   = containers.filter((c) => (c.dwell_days ?? 0) > 5).length;
  const atGateCount  = containers.filter((c) => c.status === "AT_GATE").length;
  const inYardCount  = containers.filter((c) => c.status === "YARD_STACKED").length;
  const reeferCount  = containers.filter((c) => c.reefer || c.hazard).length;

  const filtered = containers.filter((c) => {
    if (filter === "ALL")          return true;
    if (filter === "AT_GATE")      return c.status === "AT_GATE";
    if (filter === "YARD_STACKED") return c.status === "YARD_STACKED";
    if (filter === "IN_TRANSIT")   return c.status === "IN_TRANSIT";
    if (filter === "REEFER")       return c.reefer || c.hazard;
    if (filter === "HAZARD")       return c.hazard;
    if (filter === "DWELL")        return (c.dwell_days ?? 0) > 5;
    return true;
  });

  const handleAllocate = async (containerId: string) => {
    setAllocatingId(containerId);
    try {
      const res = await allocateSlot(containerId, "intelligent");
      setAllocMsg({ id: containerId, text: `→ ${res.allocated_slot_id}` });
      if (onAllocated) onAllocated();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setAllocMsg({ id: containerId, text: `Error` });
    } finally {
      setAllocatingId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s5)" }}>
      {/* Filter strip */}
      <div className="v-filter-strip">
        {[
          { key: "ALL" as FilterKey,          label: `All ${containers.length}` },
          { key: "AT_GATE" as FilterKey,      label: `At gate ${atGateCount}` },
          { key: "YARD_STACKED" as FilterKey, label: `In yard ${inYardCount}` },
          { key: "REEFER" as FilterKey,       label: `Reefer ${reeferCount}` },
          { key: "HAZARD" as FilterKey,       label: `Hazard ${hazardCount}` },
          { key: "DWELL" as FilterKey,        label: `Dwell > 5 d ${dwellCount}` },
        ].map((f, i) => (
          <button
            key={i}
            className={`v-chip${filter === f.key ? " active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="v-table-wrap">
        <table className="v-table">
          <thead>
            <tr>
              <th>Container</th>
              <th>ISO</th>
              <th>Status</th>
              <th>Slot</th>
              <th className="r">TEU</th>
              <th className="r">Gross KG</th>
              <th>Dwell</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "var(--s7)", color: "var(--ink-3)" }}>
                  No containers match this filter
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const dwell = c.dwell_days ?? 0;
              const flags: string[] = [];
              if (c.hazard) flags.push("Hazard");
              if (dwell > 5) flags.push("Dwell");
              if (c.reefer) flags.push("Reefer");

              return (
                <tr key={c.id}>
                  <td>
                    <span className="v-table-id">{c.container_number}</span>
                    {allocMsg?.id === c.id && (
                      <span className="v-meta" style={{ marginLeft: 8, color: "var(--ok)" }}>{allocMsg.text}</span>
                    )}
                  </td>
                  <td className="v-meta">{c.iso_code ?? `${c.size_teu}01`}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="v-mono v-meta">{c.current_slot_id || "—"}</td>
                  <td className="r v-mono">{c.size_teu}</td>
                  <td className="r v-mono">{c.gross_weight_kg?.toLocaleString() ?? `${c.size_teu === 40 ? "~30" : "~18"},000`}</td>
                  <td className="v-meta">
                    {dwell > 0 ? `${Math.floor(dwell)} d ${Math.round((dwell % 1) * 24)}h` : "0 d 0h"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {flags.map((f) => (
                        <span key={f} className={`v-tag ${f === "Dwell" ? "v-tag-warn" : f === "Hazard" ? "v-tag-crit" : "v-tag"}`}>
                          {f}
                        </span>
                      ))}
                      {c.status !== "YARD_STACKED" && (
                        <button
                          className="v-btn v-btn-sm v-btn-key"
                          onClick={() => handleAllocate(c.id)}
                          disabled={allocatingId === c.id}
                          style={{ marginLeft: flags.length ? 4 : 0 }}
                        >
                          {allocatingId === c.id ? "…" : "Stack"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
