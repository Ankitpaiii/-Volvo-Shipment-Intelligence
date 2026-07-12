import { useState } from "react";
import type { Shipment } from "../api/client";

function riskColor(score: number) {
  if (score >= 70) return { text: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" };
  if (score >= 40) return { text: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" };
  return { text: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" };
}

function criticalityBadge(c: string) {
  if (c === "JIT") return "bg-sky-500/20 text-sky-300 border border-sky-500/30";
  if (c === "JIS") return "bg-violet-500/20 text-violet-300 border border-violet-500/30";
  if (c === "LOW") return "bg-slate-600/30 text-slate-400 border border-slate-600/30";
  return "";
}

interface Props {
  shipments: Shipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_FILTERS = ["ALL", "IN_TRANSIT", "AT_RISK", "DELAYED", "DELIVERED", "PLANNED"] as const;

export function ShipmentList({ shipments, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [critFilter, setCritFilter] = useState<string>("ALL");
  const [sort, setSort] = useState<"risk" | "eta">("risk");

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
    .sort((a, b) => {
      if (sort === "eta") return new Date(a.planned_delivery).getTime() - new Date(b.planned_delivery).getTime();
      return b.delay_risk_score - a.delay_risk_score;
    });

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-700/60 glass" style={{ maxHeight: 880 }}>
      {/* Header */}
      <div className="border-b border-slate-700/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-100">Live Shipments</h2>
            <p className="text-xs text-slate-500">{filtered.length} of {shipments.length} shown</p>
          </div>
          <div className="flex gap-1.5 text-xs">
            <button
              onClick={() => setSort("risk")}
              className={`px-2 py-1 rounded transition ${sort === "risk" ? "bg-sky-600/30 text-sky-300" : "text-slate-500 hover:text-slate-300"}`}
            >
              By Risk
            </button>
            <button
              onClick={() => setSort("eta")}
              className={`px-2 py-1 rounded transition ${sort === "eta" ? "bg-sky-600/30 text-sky-300" : "text-slate-500 hover:text-slate-300"}`}
            >
              By ETA
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, supplier, carrier…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500/60 transition"
          />
        </div>

        {/* Status filter pills */}
        <div className="mt-2 flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition ${
                statusFilter === f
                  ? "bg-sky-600/40 text-sky-300 border border-sky-500/40"
                  : "text-slate-500 border border-slate-700 hover:text-slate-300"
              }`}
            >
              {f === "ALL" ? "All" : f.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Criticality filter */}
        <div className="mt-1.5 flex gap-1">
          {["ALL", "JIT", "JIS", "STANDARD"].map((c) => (
            <button
              key={c}
              onClick={() => setCritFilter(c)}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                critFilter === c ? "bg-violet-600/30 text-violet-300" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Shipment list */}
      <div className="overflow-y-auto flex-1">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-slate-600 text-sm">No shipments match filters</div>
        )}
        {filtered.map((s) => {
          const { text, bg, border } = riskColor(s.delay_risk_score);
          const isSelected = s.shipment_id === selectedId;
          return (
            <button
              key={s.shipment_id}
              onClick={() => onSelect(s.shipment_id)}
              className={`w-full border-b border-slate-800/60 px-4 py-3 text-left transition-all duration-200 glass-hover ${
                isSelected ? "bg-sky-900/20 border-l-2 border-l-sky-500" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-slate-100 text-sm truncate">{s.po_number}</p>
                    {s.part_criticality !== "STANDARD" && s.part_criticality !== "LOW" && (
                      <span className={`status-badge ${criticalityBadge(s.part_criticality)}`}>
                        {s.part_criticality}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{s.origin_city} → {s.dest_city}</p>
                  <p className="text-xs text-slate-600 mt-0.5 truncate">{s.carrier_name}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${text} ${bg} ${border}`}>
                    {s.delay_risk_score}%
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">{s.status.replace("_", " ")}</span>
                </div>
              </div>

              {/* Risk bar */}
              <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    s.delay_risk_score >= 70 ? "bg-red-500" : s.delay_risk_score >= 40 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${s.delay_risk_score}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
