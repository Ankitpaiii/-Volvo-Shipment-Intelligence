const API_BASE = import.meta.env.VITE_API_URL || "";
import { mockShipments, mockExceptions, mockEvents, mockScorecards, mockLanes } from "./mockData";export interface Shipment {
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
  shipment_count: number;
  at_risk_count: number;
  avg_risk_score: number;
  otif_rate: number;
  compliance_rate: number;
  exception_rate: number;
  avg_transit_days_variance: number;
}

export interface LanePerformance {
  lane_name: string;
  origin_city: string;
  dest_city: string;
  total_shipments: number;
  avg_delay_risk_score: number;
  otif_rate: number;
  avg_milestone_completeness: number;
  active_exceptions: number;
  dominant_carrier: string;
}

export type SSEEvent =
  | { type: "connected"; message: string }
  | { type: "new_exception"; exception_id: string; shipment_id: string; exception_type: string; severity: string; message: string; business_impact_score: number }
  | { type: "gps_update"; count: number };

const USE_MOCK = false;

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
  if (USE_MOCK) {
    // Simulate connection
    setTimeout(() => onEvent({ type: "connected", message: "Connected to live stream" }), 500);

    // Simulate an exception after 10 seconds
    const timeoutId = setTimeout(() => {
      onEvent({
        type: "new_exception",
        exception_id: "EXC-103",
        shipment_id: "SHP-33451",
        exception_type: "TEMPERATURE_ALERT",
        severity: "P1",
        message: "Temperature deviation detected in reefer unit.",
        business_impact_score: 95
      });
    }, 10000);
    return () => clearTimeout(timeoutId);
  }

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
  getKPIs: async () => {
    if (USE_MOCK) {
      return { shipments_in_transit: 1243, at_risk_count: 42, missing_milestone_count: 18, open_exceptions: 12, avg_health_score: 88 } as KPIs;
    }
    return fetchJson<KPIs>("/api/v1/kpis");
  },
  getExtendedKPIs: async () => {
    if (USE_MOCK) {
      return { shipments_in_transit: 1243, at_risk_count: 42, missing_milestone_count: 18, open_exceptions: 12, avg_health_score: 88, otif_pct: 94.2, on_time_pickup_pct: 96.5, avg_dwell_hours: 4.2, carrier_compliance_pct: 98.1, critical_at_risk: 8, total_shipments: 4520 } as ExtendedKPIs;
    }
    return fetchJson<ExtendedKPIs>("/api/v1/kpis/extended");
  },
  getShipments: async (params?: { status?: string; lane?: string; search?: string; criticality?: string; sort?: string }) => {
    if (USE_MOCK) {
      return { items: mockShipments, total: mockShipments.length };
    }
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.lane) q.set("lane", params.lane);
    if (params?.search) q.set("search", params.search);
    if (params?.criticality) q.set("criticality", params.criticality);
    if (params?.sort) q.set("sort", params.sort);
    return fetchJson<{ items: Shipment[]; total: number }>(`/api/v1/shipments?${q}`);
  },
  getShipment: async (id: string) => {
    if (USE_MOCK) {
      const s = mockShipments.find(x => x.shipment_id === id);
      return { ...s, actual_pickup: s?.planned_pickup || null, actual_delivery: null, references: { "Bill of Lading": "BOL-9921", "Container": "HLXU829103" }, created_at: "2026-07-01T10:00:00Z" } as ShipmentDetail;
    }
    return fetchJson<ShipmentDetail>(`/api/v1/shipments/${id}`);
  },
  getEvents: async (id: string) => {
    if (USE_MOCK) return mockEvents as MilestoneEvent[];
    return fetchJson<MilestoneEvent[]>(`/api/v1/shipments/${id}/events`);
  },
  getExceptions: async (status = "OPEN") => {
    if (USE_MOCK) return mockExceptions as Exception[];
    return fetchJson<Exception[]>(`/api/v1/exceptions?status=${status}`);
  },
  exceptionAction: async (id: string, action: string, notes?: string) => {
    if (USE_MOCK) return { ...mockExceptions[0], status: "RESOLVED" } as Exception;
    return fetchJson<Exception>(`/api/v1/exceptions/${id}/actions`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    });
  },
  copilotChat: async (question: string, sessionId = "default") => {
    try {
      return await fetchJson<{ answer: string; sources: string[] }>("/api/v1/copilot/chat", {
        method: "POST",
        body: JSON.stringify({ question, session_id: sessionId }),
      });
    } catch (e) {
      if (!USE_MOCK) throw e;
      console.warn("Backend copilot API failed, using mock fallback:", e);
      return { 
        answer: "Based on the latest supply chain data, the shipment from Stuttgart (SHP-10492) is delayed due to severe weather near Hamburg. The JIT inventory at the Gothenburg plant is at risk. I recommend rerouting via rail corridor.", 
        sources: ["Weather API", "Carrier Update", "Inventory DB"] 
      };
    }
  },
  getCarrierScorecards: async () => {
    if (USE_MOCK) return mockScorecards as CarrierScorecard[];
    return fetchJson<CarrierScorecard[]>("/api/v1/reports/carrier-scorecards");
  },
  getLanePerformance: async () => {
    if (USE_MOCK) return mockLanes as LanePerformance[];
    return fetchJson<LanePerformance[]>("/api/v1/reports/lane-performance");
  },
};
