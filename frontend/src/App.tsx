import { useCallback, useEffect, useRef, useState } from "react";
import { api, subscribeToSSE, type Exception, type ExtendedKPIs, type MilestoneEvent, type Shipment, type ShipmentDetail, type SSEEvent } from "./api/client";
import { CopilotChat } from "./components/CopilotChat";
import { ExceptionQueue } from "./components/ExceptionQueue";
import { ExecutiveDashboard } from "./components/ExecutiveDashboard";
import { KpiStrip } from "./components/KpiStrip";
import { ShipmentDetailPanel } from "./components/ShipmentDetailPanel";
import { ShipmentList } from "./components/ShipmentList";
import { ShipmentMap } from "./components/ShipmentMap";

type Tab = "operations" | "executive";

interface ToastNotification {
  id: string;
  message: string;
  severity: string;
  type: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("operations");
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

  // Initial load + 15s polling as fallback
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  // SSE subscription for real-time push updates
  useEffect(() => {
    const unsubscribe = subscribeToSSE((event: SSEEvent) => {
      if (event.type === "connected") {
        setSseConnected(true);
      } else if (event.type === "new_exception") {
        // Show toast notification
        const toast: ToastNotification = {
          id: event.exception_id,
          message: event.message,
          severity: event.severity,
          type: event.exception_type,
        };
        setToasts((prev) => [toast, ...prev.slice(0, 4)]);
        // Auto-dismiss after 6s
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 6000);
        // Trigger data refresh
        refresh();
      } else if (event.type === "gps_update") {
        // Debounced refresh for GPS updates
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

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/60 glass px-6 py-0">
        <div className="mx-auto flex max-w-[1700px] items-center justify-between h-14">
          {/* Logo + Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded bg-[#003057] flex items-center justify-center">
                <span className="text-white font-black text-xs">V</span>
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-100">Volvo Shipment Intelligence</h1>
                <p className="text-[10px] text-slate-500">Operational Visibility &amp; Exception Management</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <nav className="flex gap-0 ml-8">
              {([
                { id: "operations", label: "Operations", icon: "🗺️" },
                { id: "executive", label: "Executive", icon: "📊" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 h-14 text-xs font-medium transition-all ${
                    activeTab === tab.id ? "tab-active" : "tab-inactive"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Status indicators */}
          <div className="flex items-center gap-4 text-right">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className="text-slate-500">{sseConnected ? "Live" : "Polling"}</span>
            </div>
            <div className="text-[10px] text-slate-600">
              <p>Updated {lastRefresh.toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-[1700px] p-6 space-y-6">
        {/* KPI strip — always visible */}
        <KpiStrip kpis={kpis} />

        {/* Tab content */}
        {activeTab === "operations" && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              {/* Left column */}
              <div className="space-y-5 min-w-0">
                <ShipmentMap shipments={shipments} selectedId={selectedId} onSelect={setSelectedId} />
                <ShipmentDetailPanel shipment={detail} events={events} />
              </div>
              {/* Right column: shipment list */}
              <ShipmentList shipments={shipments} selectedId={selectedId} onSelect={setSelectedId} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ExceptionQueue exceptions={exceptions} onAction={handleExceptionAction} />
              <CopilotChat />
            </div>
          </div>
        )}

        {activeTab === "executive" && (
          <ExecutiveDashboard extKpis={kpis} />
        )}
      </main>

      {/* Toast notifications (SSE-triggered) */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`glass rounded-xl border p-4 max-w-sm shadow-2xl animate-slide-right pointer-events-auto cursor-pointer ${
              toast.severity === "P1"
                ? "border-red-500/50 bg-red-500/10"
                : "border-amber-500/40 bg-amber-500/8"
            }`}
            onClick={() => dismissToast(toast.id)}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">{toast.severity === "P1" ? "🚨" : "⚠️"}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-100">{toast.type.replace(/_/g, " ")}</p>
                  <span className={`status-badge border ${toast.severity === "P1" ? "bg-red-500/20 text-red-300 border-red-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40"}`}>
                    {toast.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{toast.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
