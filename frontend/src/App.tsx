/* ══════════════════════════════════════════════════════════════════════════
   App.tsx — redesigned root shell (KIRUNA design system)
   Data flow, SSE wiring, polling and props are UNCHANGED from the original.
   Only markup, class names and motion were rebuilt.

   Changes vs. original:
   · Inline style objects replaced with semantic classes from index.css
   · Dark "Obsidian" chrome dropped; single intentional light palette
   · Theme toggle removed (one designed palette instead of two half-designed)
   · Toasts: severity icon + typographic hierarchy + exit animation
   · Nav rail: acid indicator slides in, mono labels, mobile bottom bar
   ══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  fetchContainers,
  fetchMLMetrics,
  fetchYardState,
  subscribeToSSE,
  type Container,
  type Exception,
  type ExtendedKPIs,
  type MilestoneEvent,
  type MLMetrics,
  type Shipment,
  type ShipmentDetail,
  type SSEEvent,
  type YardState,
} from "./api/client";
import { ContainerTrackingView } from "./components/ContainerTrackingView";
import { ExceptionQueue } from "./components/ExceptionQueue";
import { ExecutiveDashboard } from "./components/ExecutiveDashboard";
import { GateInspectionView } from "./components/GateInspectionView";
import { KpiStrip } from "./components/KpiStrip";
import { MLEvaluationDashboard } from "./components/MLEvaluationDashboard";
import { ShipmentDetailPanel } from "./components/ShipmentDetailPanel";
import { ShipmentList } from "./components/ShipmentList";
import { ShipmentMap } from "./components/ShipmentMap";
import { VolvoLogo } from "./components/VolvoLogo";
import { YardDigitalTwin } from "./components/YardDigitalTwin";
import "./styles/components.css";

type Page =
  | "operations"
  | "analysis"
  | "yard_twin"
  | "gate_inspection"
  | "containers"
  | "ml_evaluation";

interface ToastNotification {
  id: string;
  message: string;
  severity: string;
  type: string;
  leaving?: boolean;
}

const ICON = { w: 20, h: 20, sw: 1.7 };

const NAV_ITEMS: { id: Page; label: string; title: string; icon: JSX.Element }[] = [
  {
    id: "operations",
    label: "Ops",
    title: "Operations",
    icon: (
      <svg width={ICON.w} height={ICON.h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON.sw} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    ),
  },
  {
    id: "analysis",
    label: "Analysis",
    title: "Network performance",
    icon: (
      <svg width={ICON.w} height={ICON.h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON.sw} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    id: "yard_twin",
    label: "Yard",
    title: "Yard digital twin",
    icon: (
      <svg width={ICON.w} height={ICON.h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON.sw} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "gate_inspection",
    label: "Gate",
    title: "Gate inspection",
    icon: (
      <svg width={ICON.w} height={ICON.h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON.sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
        <line x1="7" y1="12" x2="17" y2="12" />
      </svg>
    ),
  },
  {
    id: "containers",
    label: "Stock",
    title: "Container registry",
    icon: (
      <svg width={ICON.w} height={ICON.h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON.sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: "ml_evaluation",
    label: "Models",
    title: "Model evaluation",
    icon: (
      <svg width={ICON.w} height={ICON.h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON.sw} strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="8" width="8" height="8" rx="1.5" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      </svg>
    ),
  },
];

const SEVERITY_ICON: Record<string, JSX.Element> = {
  P1: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--crit)" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" />
    </svg>
  ),
  P2: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" strokeLinecap="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12" y2="17" />
    </svg>
  ),
};

export default function App() {
  const [activePage, setActivePage] = useState<Page>("operations");
  const [kpis, setKpis] = useState<ExtendedKPIs | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [events, setEvents] = useState<MilestoneEvent[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Yard + ML state
  const [yardState, setYardState] = useState<YardState | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [mlMetrics, setMlMetrics] = useState<MLMetrics | null>(null);

  const loadYardData = useCallback(async () => {
    try {
      const [yard, conts, metrics] = await Promise.all([
        fetchYardState().catch(() => null),
        fetchContainers().catch(() => []),
        fetchMLMetrics().catch(() => null),
      ]);
      if (yard) setYardState(yard);
      if (conts) setContainers(conts);
      if (metrics) setMlMetrics(metrics);
    } catch (e) {
      console.error("Failed to load yard state", e);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [kpiData, shipData, excData] = await Promise.all([
        api.getExtendedKPIs().catch(() => null),
        api.getShipments().catch(() => ({ items: [], total: 0 })),
        api.getExceptions("OPEN").catch(() => []),
      ]);
      if (kpiData) setKpis(kpiData);
      if (shipData) setShipments(shipData.items);
      if (excData) setExceptions(excData);
      setLastRefresh(new Date());
      loadYardData();
    } catch (e) {
      console.error("Refresh failed", e);
    } finally {
      setRefreshing(false);
    }
  }, [loadYardData]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeToSSE((event: SSEEvent) => {
      if (event.type === "connected") {
        setSseConnected(true);
      } else if (event.type === "new_exception") {
        const toast: ToastNotification = {
          id: event.exception_id,
          message: event.message,
          severity: event.severity,
          type: event.exception_type,
        };
        setToasts((prev) => [toast, ...prev.slice(0, 4)]);
        setTimeout(() => dismissToast(toast.id), 6000);
        refresh();
      } else if (event.type === "gps_update") {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(refresh, 2000);
      }
    });
    return () => {
      unsubscribe();
      setSseConnected(false);
    };
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEvents([]);
      return;
    }
    Promise.all([api.getShipment(selectedId), api.getEvents(selectedId)]).then(([s, ev]) => {
      setDetail(s);
      setEvents(ev);
    });
  }, [selectedId]);

  const handleExceptionAction = async (id: string, action: string) => {
    await api.exceptionAction(id, action);
    refresh();
  };

  // animate out, then unmount
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  };

  const current = NAV_ITEMS.find((n) => n.id === activePage);

  return (
    <div className="v-shell">
      {/* ── NAV RAIL ─────────────────────────────────────── */}
      <aside className="v-sidebar">
        <div className="v-logo" style={{ marginBottom: "var(--s5)" }}>
          <VolvoLogo size={38} />
        </div>

        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`v-nav-item${activePage === item.id ? " active" : ""}`}
            aria-current={activePage === item.id ? "page" : undefined}
            title={item.title}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        <div className="v-rail-foot" style={{ marginTop: "auto", paddingBottom: "var(--s2)" }}>
          {sseConnected ? <span className="v-pill-live">Live</span> : <span className="v-pill-poll">Poll</span>}
        </div>
      </aside>

      {/* ── FRAME ────────────────────────────────────────── */}
      <div className="v-frame">
        <header className="v-header">
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <b style={{ fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.16em" }}>VOLVO</b>
            <small className="v-meta" style={{ fontSize: "0.625rem", letterSpacing: "0.07em" }}>
              Shipment &amp; Yard Intelligence
            </small>
          </div>

          <span className="v-rule-v" />
          <span style={{ fontSize: "1.0625rem", fontWeight: 600, letterSpacing: "-0.02em" }}>{current?.title}</span>

          <span style={{ flex: 1 }} />

          {exceptions.length > 0 && (
            <span className="v-badge v-badge-red">
              {exceptions.length} open {exceptions.length === 1 ? "exception" : "exceptions"}
            </span>
          )}

          <button className="v-btn" onClick={refresh} disabled={refreshing} aria-label="Refresh now">
            <svg className={refreshing ? "v-spin" : undefined} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-2.6-6.4" /><polyline points="21 3 21 9 15 9" />
            </svg>
            <span>{lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </button>

          <span className="v-volvo-wordmark">VOLVO</span>
        </header>

        <main style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div key={activePage} className="v-view-enter" style={{ height: "100%" }}>
            {activePage === "operations" && (
              <div className="v-ops">
                <div className="v-map">
                  <ShipmentMap shipments={shipments} selectedId={selectedId} onSelect={setSelectedId} />
                </div>

                <div className="v-col">
                  <div className="v-panel-head">
                    <h3>Live assets</h3>
                    <span className="v-meta" style={{ marginLeft: "auto" }}>
                      {shipments.length} tracked
                    </span>
                  </div>
                  <div className="v-scroll" style={{ flex: 1 }}>
                    <ShipmentList shipments={shipments} selectedId={selectedId} onSelect={setSelectedId} />
                  </div>
                </div>

                <div className="v-col v-col-detail v-scroll" style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
                  <ShipmentDetailPanel shipment={detail} events={events} />
                  <div className="v-block">
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                      <span className="v-eyebrow">Exception queue</span>
                      <span className="v-meta" style={{ marginLeft: "auto" }}>
                        {exceptions.length} open
                      </span>
                    </div>
                    <ExceptionQueue exceptions={exceptions} onAction={handleExceptionAction} />
                  </div>
                </div>
              </div>
            )}

            {activePage === "analysis" && (
              <div className="v-page v-scroll">
                <header>
                  <h1>Network performance</h1>
                  <p>Rolling 30 days across contracted carriers and active lanes.</p>
                </header>
                <KpiStrip kpis={kpis} />
                <ExecutiveDashboard extKpis={kpis} />
              </div>
            )}

            {activePage === "yard_twin" && (
              <div className="v-page v-scroll">
                <header>
                  <h1>Yard digital twin</h1>
                  <p>96 slots, four blocks, three bays deep. Click a slot to stage an allocation.</p>
                </header>
                <YardDigitalTwin yardState={yardState} onRefresh={loadYardData} containers={containers} />
              </div>
            )}

            {activePage === "gate_inspection" && (
              <div className="v-page v-scroll">
                <header>
                  <h1>Gate inspection</h1>
                  <p>YOLOv8 detection, EasyOCR extraction and ISO 6346 verification in one pass.</p>
                </header>
                <GateInspectionView onInspectionCompleted={loadYardData} />
              </div>
            )}

            {activePage === "containers" && (
              <div className="v-page v-scroll">
                <header>
                  <h1>Container registry</h1>
                  <p>Every box under terminal custody, from gate-in to gate-out.</p>
                </header>
                <ContainerTrackingView containers={containers} shipments={shipments} onRefresh={loadYardData} />
              </div>
            )}

            {activePage === "ml_evaluation" && (
              <div className="v-page v-scroll">
                <header>
                  <h1>Model evaluation</h1>
                  <p>Holdout metrics for perception, delay regression and the yard decision policy.</p>
                </header>
                <MLEvaluationDashboard metrics={mlMetrics} />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── TOASTS ───────────────────────────────────────── */}
      <div className="v-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`v-toast${t.leaving ? " leaving" : ""}`} role="status">
            {SEVERITY_ICON[t.severity] ?? SEVERITY_ICON.P2}
            <div>
              <b>{t.type.replace(/_/g, " ")}</b>
              <p>{t.message}</p>
            </div>
            <button className="v-toast-x" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
