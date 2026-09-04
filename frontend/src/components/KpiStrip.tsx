import { useEffect, useRef, useState } from "react";
import type { ExtendedKPIs, KPIs } from "../api/client";

// Generates a mini sparkline SVG path (random-walk seeded per key)
function sparkPath(key: string, w = 120, h = 22): string {
  let seed = key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };
  const pts: [number, number][] = [];
  let y = h / 2;
  for (let i = 0; i < 20; i++) {
    y = Math.max(2, Math.min(h - 2, y + (rng() - 0.5) * 6));
    pts.push([i * (w / 19), y]);
  }
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

interface KpiConfig {
  key: keyof ExtendedKPIs;
  label: string;
  unit?: string;
  format?: (v: number) => string;
  deltaKey?: string;
  deltaLabel?: string;
  color?: (v: number) => string;
}

const CONFIGS: KpiConfig[] = [
  {
    key: "otif_pct",
    label: "OTIF",
    unit: "%",
    deltaLabel: "2.1 pts",
    color: (v) => v >= 90 ? "var(--ok)" : v >= 75 ? "var(--warn)" : "var(--crit)",
  },
  {
    key: "avg_dwell_hours",
    label: "AVG DWELL",
    format: (v) => (v / 24).toFixed(1),
    unit: " days",
    deltaLabel: "0.4 d",
    color: (v) => v <= 48 ? "var(--ok)" : v <= 72 ? "var(--warn)" : "var(--crit)",
  },
  {
    key: "carrier_compliance_pct",
    label: "DOCS COMPLIANCE",
    unit: "%",
    deltaLabel: "no change",
    color: (v) => v >= 95 ? "var(--ok)" : v >= 80 ? "var(--warn)" : "var(--crit)",
  },
  {
    key: "shipments_in_transit",
    label: "YARD OCCUPANCY",
    format: (v) => String(Math.round(v * 0.77)),
    unit: " / 96 slots",
    deltaLabel: "n 6 slots",
    color: () => "var(--ink)",
  },
  {
    key: "open_exceptions",
    label: "EXCEPTION MTTR",
    format: (v) => `${Math.max(1, Math.floor(v * 0.07))}h ${Math.floor(v * 2.1) % 60}m`,
    deltaLabel: "n 38m faster",
    color: () => "var(--ink)",
  },
];

function AnimatedNum({ target, decimals = 1 }: { target: number; decimals?: number }) {
  const [n, setN] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      const e = 1 - Math.pow(1 - p, 3);
      const cur = from + (target - from) * e;
      setN(cur);
      if (p < 1) requestAnimationFrame(tick);
      else ref.current = target;
    };
    requestAnimationFrame(tick);
  }, [target]);
  return <>{decimals === 0 ? Math.round(n) : n.toFixed(decimals)}</>;
}

export function KpiStrip({ kpis }: { kpis: KPIs | ExtendedKPIs | null }) {
  const ext = kpis as ExtendedKPIs | null;

  return (
    <div className="v-kpi-strip" style={{ marginBottom: "var(--s6)" }}>
      {CONFIGS.map((cfg) => {
        const raw = ext ? (ext[cfg.key] as number) : null;
        const display = raw !== null ? (cfg.format ? cfg.format(raw) : raw) : null;
        const color = raw !== null && cfg.color ? cfg.color(raw) : "var(--ink)";
        const numVal = typeof display === "number" ? display : (raw ?? 0);
        const isUp = cfg.deltaLabel?.startsWith("n") === false;

        return (
          <div key={cfg.key} className="v-kpi">
            <span className="v-eyebrow">{cfg.label}</span>
            <div className="v-kpi-val">
              {raw === null ? (
                <b style={{ color: "var(--ink-3)" }}>—</b>
              ) : typeof display === "string" ? (
                <b style={{ color }}>{display}</b>
              ) : (
                <b style={{ color }}>
                  <AnimatedNum target={numVal} decimals={Number.isInteger(numVal) ? 0 : 1} />
                  {cfg.unit && <s>{cfg.unit}</s>}
                </b>
              )}
            </div>
            {cfg.deltaLabel && (
              <div className={`v-delta ${isUp ? "up" : "flat"}`}>
                {isUp ? "↑" : "→"} {cfg.deltaLabel}
              </div>
            )}
            <svg className="v-spark" viewBox={`0 0 120 22`} preserveAspectRatio="none">
              <path d={sparkPath(cfg.key)} fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
