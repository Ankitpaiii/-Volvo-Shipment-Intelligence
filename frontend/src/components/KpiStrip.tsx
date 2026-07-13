import { useEffect, useRef, useState } from "react";
import type { ExtendedKPIs, KPIs } from "../api/client";

interface CardConfig {
  key: keyof ExtendedKPIs;
  label: string;
  suffix?: string;
  thresholdWarn?: number;
  thresholdDanger?: number;
  higherIsBetter?: boolean;
}

const CARDS: CardConfig[] = [
  { key: "shipments_in_transit", label: "In Transit", higherIsBetter: true },
  { key: "at_risk_count",       label: "At Risk",    thresholdWarn: 5, thresholdDanger: 12 },
  { key: "critical_at_risk",    label: "JIT / JIS",  thresholdWarn: 2, thresholdDanger: 5 },
  { key: "open_exceptions",     label: "Exceptions", thresholdWarn: 5, thresholdDanger: 10 },
  { key: "otif_pct",            label: "OTIF",       suffix: "%", higherIsBetter: true },
  { key: "avg_health_score",    label: "Avg Health", suffix: "%", higherIsBetter: true },
  { key: "carrier_compliance_pct", label: "Compliance", suffix: "%", higherIsBetter: true },
  { key: "avg_dwell_hours",     label: "Dwell",      thresholdWarn: 3, thresholdDanger: 6 },
];

function valueColor(card: CardConfig, value: number): string {
  if (card.higherIsBetter) {
    if (value >= 90) return "var(--signal-green)";
    if (value >= 70) return "var(--signal-amber)";
    return "var(--signal-red)";
  }
  if (card.thresholdDanger !== undefined && value >= card.thresholdDanger) return "var(--signal-red)";
  if (card.thresholdWarn   !== undefined && value >= card.thresholdWarn)   return "var(--signal-amber)";
  return "var(--platinum-100)";
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const duration = 550;
    const startTime = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (p < 1) requestAnimationFrame(step);
      else prevRef.current = end;
    };
    requestAnimationFrame(step);
  }, [value]);

  return <span>{Number.isInteger(value) ? displayed : value.toFixed(1)}{suffix}</span>;
}

export function KpiStrip({ kpis }: { kpis: KPIs | ExtendedKPIs | null }) {
  const ext = kpis as ExtendedKPIs | null;
  const visible = ext?.otif_pct !== undefined ? CARDS : CARDS.slice(0, 5);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
      {visible.map((card) => {
        const raw = ext ? (ext[card.key] as number) : null;
        const val = raw ?? 0;
        const color = raw !== null ? valueColor(card, val) : "var(--silver-500)";
        const progress = card.thresholdDanger
          ? Math.min(100, (val / card.thresholdDanger) * 100)
          : card.higherIsBetter ? Math.min(100, val) : 0;

        return (
          <div
            key={card.key}
            className="v-card"
            style={{ padding: "14px 16px" }}
          >
            <p className="v-kpi-label" style={{ marginBottom: 8 }}>{card.label}</p>
            <p className="v-kpi-value" style={{ color, marginBottom: 8 }}>
              {raw === null
                ? <span style={{ color: "var(--silver-500)", fontSize: "0.85rem" }}>—</span>
                : <AnimatedNumber value={val} suffix={card.suffix} />
              }
            </p>
            {/* Progress bar */}
            <div className="v-progress-track">
              <div
                className="v-progress-fill"
                style={{
                  width: `${progress}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
