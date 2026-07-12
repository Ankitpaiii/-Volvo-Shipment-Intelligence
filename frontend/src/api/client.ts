const API_BASE = import.meta.env.VITE_API_URL || "";

export interface Shipment {
  shipment_id: string;
  po_number: string;
  status: string;
  supplier_name: string;
  carrier_name: string;
  lane_name: string;
  origin_city: string;
  dest_city: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  current_lat: number | null;
  current_lng: number | null;
  part_criticality: string;
  planned_pickup: string;
  planned_delivery: string;
  delay_risk_score: number;
  health_score: number;
  predicted_delivery: string | null;
  eta_confidence: number;
  flags: string[];
}

export interface ShipmentDetail extends Shipment {
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  actual_pickup: string | null;
  actual_delivery: string | null;
  references: Record<string, string>;
  created_at: string;
}

export interface MilestoneEvent {
  event_id: string;
  shipment_id: string;
  event_type: string;
  source: string;
  event_time: string;
  received_time: string;
  payload: Record<string, unknown>;
}

export interface Exception {
  exception_id: string;
  shipment_id: string;
  po_number?: string;
  lane_name?: string;
  dest_city?: string;
  exception_type: string;
  severity: string;
  root_cause: string | null;
  status: string;
  business_impact_score: number;
  message: string;
  recommended_action: string | null;
  raised_at: string;
  resolved_at: string | null;
}

export interface KPIs {
  shipments_in_transit: number;
  at_risk_count: number;
  missing_milestone_count: number;
  open_exceptions: number;
  avg_health_score: number;
}

export interface ExtendedKPIs extends KPIs {
  otif_pct: number;
  on_time_pickup_pct: number;
  avg_dwell_hours: number;
  carrier_compliance_pct: number;
  critical_at_risk: number;
  total_shipments: number;
}

export interface CarrierScorecard {
  carrier_name: string;
  total_shipments: number;
  at_risk_count: number;
  avg_risk_score: number;
  on_time_rate: number;
  compliance_rate: number;
  p1_exception_count: number;
}

export interface LanePerformance {
  lane_name: string;
  origin_city: string;
  dest_city: string;
  total_shipments: number;
  avg_risk_score: number;
  on_time_rate: number;
  avg_milestone_completeness: number;
  active_exceptions: number;
}

export type SSEEvent =
  | { type: "connected"; message: string }
  | { type: "new_exception"; exception_id: string; shipment_id: string; exception_type: string; severity: string; message: string; business_impact_score: number }
  | { type: "gps_update"; count: number };

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.error?.message || res.statusText);
  }
  return res.json();
}

export function subscribeToSSE(onEvent: (event: SSEEvent) => void): () => void {
  const es = new EventSource(`${API_BASE}/api/v1/stream`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as SSEEvent;
      onEvent(data);
    } catch {
      // ignore malformed events
    }
  };
  es.onerror = () => {
    // EventSource auto-reconnects on error
  };
  return () => es.close();
}

export const api = {
  getKPIs: () => fetchJson<KPIs>("/api/v1/kpis"),
  getExtendedKPIs: () => fetchJson<ExtendedKPIs>("/api/v1/kpis/extended"),
  getShipments: (params?: { status?: string; lane?: string; search?: string; criticality?: string; sort?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.lane) q.set("lane", params.lane);
    if (params?.search) q.set("search", params.search);
    if (params?.criticality) q.set("criticality", params.criticality);
    if (params?.sort) q.set("sort", params.sort);
    return fetchJson<{ items: Shipment[]; total: number }>(`/api/v1/shipments?${q}`);
  },
  getShipment: (id: string) => fetchJson<ShipmentDetail>(`/api/v1/shipments/${id}`),
  getEvents: (id: string) => fetchJson<MilestoneEvent[]>(`/api/v1/shipments/${id}/events`),
  getExceptions: (status = "OPEN") => fetchJson<Exception[]>(`/api/v1/exceptions?status=${status}`),
  exceptionAction: (id: string, action: string, notes?: string) =>
    fetchJson<Exception>(`/api/v1/exceptions/${id}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    }),
  copilotChat: (question: string, sessionId = "default") =>
    fetchJson<{ answer: string; sources: string[] }>("/api/v1/copilot/chat", {
      method: "POST",
      body: JSON.stringify({ question, session_id: sessionId }),
    }),
  getCarrierScorecards: () => fetchJson<CarrierScorecard[]>("/api/v1/reports/carrier-scorecards"),
  getLanePerformance: () => fetchJson<LanePerformance[]>("/api/v1/reports/lane-performance"),
};
