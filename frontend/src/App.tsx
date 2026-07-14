import { useCallback, useEffect, useRef, useState } from "react";
import { api, subscribeToSSE, type Exception, type ExtendedKPIs, type MilestoneEvent, type Shipment, type ShipmentDetail, type SSEEvent } from "./api/client";
import { CopilotChat } from "./components/CopilotChat";
import { ExceptionQueue } from "./components/ExceptionQueue";
import { ExecutiveDashboard } from "./components/ExecutiveDashboard";
import { KpiStrip } from "./components/KpiStrip";
import { ShipmentDetailPanel } from "./components/ShipmentDetailPanel";
import { ShipmentList } from "./components/ShipmentList";
import { ShipmentMap } from "./components/ShipmentMap";
import { VolvoLogo } from "./components/VolvoLogo";

type Page = "operations" | "analysis" | "bandhu";

interface ToastNotification {
  id: string;
  message: string;
  severity: string;
  type: string;
}

const NAV_ITEMS: { id: Page; label: string; icon: JSX.Element }[] = [
  {
    id: "operations",
    label: "Ops",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
    ),
  },
  {
    id: "analysis",
    label: "Analysis",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    id: "bandhu",
    label: "Bandhu",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
];

export default function App() {
  const [activePage, setActivePage] = useState<Page>("operations");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [kpis, setKpis] = useState<ExtendedKPIs | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [events, setEvents] = useState<MilestoneEvent[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [sseConnected, setSseConnected] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [theme]);

  const refresh = useCallback(async () => {
    try {
      const [kpiData, shipData, excData] = await Promise.all([
        api.getExtendedKPIs(),
        api.getShipments(),
        api.getExceptions("OPEN"),
      ]);
      setKpis(kpiData);
      setShipments(shipData.items);
      setExceptions(excData);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Refresh failed", e);
    }
  }, []);

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
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 6000);
        refresh();
      } else if (event.type === "gps_update") {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(refresh, 2000);
      }
    });
    return () => { unsubscribe(); setSseConnected(false); };
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setEvents([]); return; }
    Promise.all([api.getShipment(selectedId), api.getEvents(selectedId)]).then(([s, ev]) => {
      setDetail(s);
      setEvents(ev);
    });
  }, [selectedId]);

  const handleExceptionAction = async (id: string, action: string) => {
    await api.exceptionAction(id, action);
    refresh();
  };

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", backgroundColor: "var(--bg-void)" }}>

      {/* ── LEFT SIDEBAR ── */}
      <aside className="v-sidebar">
        {/* Volvo Logo Badge */}
        <div style={{ marginBottom: 20, position: "relative" }}>
          <VolvoLogo size={44} />
        </div>

        {/* Nav Items */}
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`v-nav-item${activePage === item.id ? " active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        {/* Live/Poll indicator at bottom */}
        <div style={{ marginTop: "auto", paddingBottom: 8 }}>
          {sseConnected
            ? <span className="v-pill-live">Live</span>
            : <span className="v-pill-poll">Poll</span>
          }
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <header className="v-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Compact Volvo badge in header */}
            <VolvoLogo size={28} />
            <div>
              <span className="v-text-primary" style={{ fontSize: "0.82rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", lineHeight: 1.1 }}>
                Volvo
              </span>
              <span className="v-text-secondary" style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Shipment Intelligence
              </span>
            </div>
            <span style={{ width: 1, height: 24, backgroundColor: "var(--graphite-line)" }} />
            <span className="v-text-secondary" style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {NAV_ITEMS.find((n) => n.id === activePage)?.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {exceptions.length > 0 && (
              <span className="v-badge v-badge-red">
                {exceptions.length} open
              </span>
            )}

            {/* VOLVO metallic wordmark next to theme toggle */}
            <span className="v-volvo-wordmark">VOLVO</span>

            <button
              className="v-theme-toggle"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <span className="v-text-secondary" style={{ fontSize: "0.65rem" }}>
              {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflow: "hidden" }}>

          {/* OPERATIONS */}
          {activePage === "operations" && (
            <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 310px 330px" }}>

              {/* Col 1: Map */}
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: "12px 6px 12px 12px" }}>
                <p className="v-section-title">Live Shipment Map</p>
                <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: "hidden", border: "1px solid var(--graphite-line)" }}>
                  <ShipmentMap shipments={shipments} selectedId={selectedId} onSelect={setSelectedId} theme={theme} />
                </div>
                {detail && (
                  <div style={{ flexShrink: 0, marginTop: 10, maxHeight: 280, overflowY: "auto" }}>
                    <ShipmentDetailPanel shipment={detail} events={events} />
                  </div>
                )}
              </div>

              {/* Col 2: Shipments list */}
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: "12px 6px", borderLeft: "1px solid var(--graphite-line)", borderRight: "1px solid var(--graphite-line)" }}>
                <p className="v-section-title">Shipments</p>
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                  <ShipmentList shipments={shipments} selectedId={selectedId} onSelect={setSelectedId} />
                </div>
              </div>

              {/* Col 3: Exceptions */}
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: "12px 12px 12px 6px" }}>
                <p className="v-section-title">Exception Queue</p>
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                  <ExceptionQueue exceptions={exceptions} onAction={handleExceptionAction} />
                </div>
              </div>
            </div>
          )}

          {/* ANALYSIS */}
          {activePage === "analysis" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ marginBottom: 20 }}>
                <h2 className="v-text-primary" style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                  Network Analytics
                </h2>
                <p className="v-text-secondary" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                  Real-time supply chain health — KPIs, Carrier Scorecards, Lane Performance
                </p>
              </div>
              <KpiStrip kpis={kpis} />
              <hr className="v-divider" style={{ margin: "20px 0" }} />
              <ExecutiveDashboard extKpis={kpis} />
            </div>
          )}

          {/* BANDHU */}
          {activePage === "bandhu" && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
              <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ textAlign: "center", marginBottom: 24, flexShrink: 0 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "linear-gradient(145deg, #6A6D78 0%, #3A3D47 45%, #0F1014 100%)",
                    border: "1px solid var(--chrome-shadow)",
                    boxShadow: "0 0 0 1px var(--chrome-shadow), 0 0 10px rgba(180,183,196,0.2)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--silver-700)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <h2 className="v-text-primary" style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Bandhu AI</h2>
                  <p className="v-text-secondary" style={{ fontSize: "0.8rem", marginTop: 6 }}>
                    Natural language shipment intelligence
                  </p>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <CopilotChat />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── TOAST NOTIFICATIONS ── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`v-card v-toast-animate${toast.severity === "P1" ? " v-p1-pulse" : ""}`}
            style={{ maxWidth: 320, pointerEvents: "all", cursor: "pointer" }}
            onClick={() => dismissToast(toast.id)}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={toast.severity === "P1" ? "var(--signal-red)" : "var(--signal-amber)"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span className="v-text-primary" style={{ fontSize: "0.75rem", fontWeight: 700 }}>
                    {toast.type.replace(/_/g, " ")}
                  </span>
                  <span className={`v-badge ${toast.severity === "P1" ? "v-badge-red" : "v-badge-amber"}`}>
                    {toast.severity}
                  </span>
                </div>
                <p className="v-text-secondary" style={{ fontSize: "0.7rem", margin: 0 }}>
                  {toast.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
