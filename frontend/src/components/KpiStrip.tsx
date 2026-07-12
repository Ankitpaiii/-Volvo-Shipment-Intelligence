import { useEffect, useRef, useState } from "react";
import type { ExtendedKPIs, KPIs } from "../api/client";

interface Card {
  key: keyof ExtendedKPIs;
  label: string;
  color: string;
  glow: string;
  suffix?: string;
  icon: string;
  threshold?: { warn: number; danger: number };
  higherIsBetter?: boolean;
}

const CARDS: Card[] = [
  { key: "shipments_in_transit", label: "In Transit", color: "text-sky-400", glow: "glow-blue", icon: "🚛", higherIsBetter: true },
  { key: "at_risk_count", label: "At Risk", color: "text-amber-400", glow: "glow-amber", icon: "⚠️", threshold: { warn: 5, danger: 12 } },
  { key: "critical_at_risk", label: "JIT/JIS Critical", color: "text-orange-400", glow: "glow-amber", icon: "🔴", threshold: { warn: 2, danger: 5 } },
  { key: "open_exceptions", label: "Open Exceptions", color: "text-red-400", glow: "glow-red", icon: "🚨", threshold: { warn: 5, danger: 10 } },
  { key: "otif_pct", label: "OTIF", color: "text-emerald-400", glow: "glow-green", icon: "✅", suffix: "%", higherIsBetter: true },
  { key: "avg_health_score", label: "Avg Health", color: "text-teal-400", glow: "glow-green", icon: "❤️", suffix: "%", higherIsBetter: true },
  { key: "carrier_compliance_pct", label: "Carrier Compliance", color: "text-violet-400", glow: "glow-blue", icon: "📋", suffix: "%", higherIsBetter: true },
  { key: "avg_dwell_hours", label: "Avg Dwell (hrs)", color: "text-slate-300", glow: "", icon: "⏱️", threshold: { warn: 3, danger: 6 } },
];

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
      else prevRef.current = end;
    };
    requestAnimationFrame(step);
  }, [value]);

  return (
    <span className="tabular-nums">
      {Number.isInteger(value) ? displayed : value.toFixed(1)}
      {suffix}
    </span>
  );
}

interface Props {
  kpis: KPIs | ExtendedKPIs | null;
}

export function KpiStrip({ kpis }: Props) {
  const extKpis = kpis as ExtendedKPIs | null;
  const visibleCards = extKpis?.otif_pct !== undefined ? CARDS : CARDS.slice(0, 5);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {visibleCards.map((card) => {
        const rawValue = extKpis ? (extKpis[card.key] as number) : null;
        const value = rawValue ?? 0;
        const isLoading = rawValue === null;

        let glowClass = card.glow;
        if (card.threshold && rawValue !== null) {
          if (value >= card.threshold.danger) glowClass = "glow-red";
          else if (value >= card.threshold.warn) glowClass = "glow-amber";
        }

        return (
          <div
            key={card.key}
            className={`glass rounded-xl p-4 transition-all duration-500 ${glowClass} animate-fade-slide`}
          >
            <div className="flex items-start justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{card.label}</p>
              <span className="text-base">{card.icon}</span>
            </div>
            <p className={`mt-2 text-2xl font-bold ${card.color}`}>
              {isLoading ? (
                <span className="skeleton block h-8 w-16" />
              ) : (
                <AnimatedNumber value={value} suffix={card.suffix} />
              )}
            </p>
            {/* Mini trend bar */}
            {!isLoading && card.threshold && (
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    value >= card.threshold.danger
                      ? "bg-red-500"
                      : value >= card.threshold.warn
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, (value / card.threshold.danger) * 100)}%` }}
                />
              </div>
            )}
            {!isLoading && card.higherIsBetter && card.suffix === "%" && (
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
