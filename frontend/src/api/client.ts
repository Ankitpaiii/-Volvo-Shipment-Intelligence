const API_BASE = import.meta.env.VITE_API_URL || "";
import { mockShipments, mockExceptions, mockEvents, mockScorecards, mockLanes } from "./mockData";

// ──────────────────────────────────────────────
// Volvo Shipment Intelligence Interfaces
// ──────────────────────────────────────────────

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

  // Container & Yard ML additions
  id?: string;
  container_id?: string | null;
  container_number?: string | null;
  origin?: string;
  destination?: string;
  distance?: number;
  current_progress?: number;
  current_speed?: number;
  dwell_time?: number;
  yard_congestion?: number;
  historical_delay?: number;
  predicted_delay?: number;
  predicted_eta?: string | null;
  priority?: string;
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

// Mirrors backend/app/schemas.py: CarrierScorecard / LanePerformance.
// Canonical fields are required; legacy aliases stay optional for compat.
export interface CarrierScorecard {
  carrier_name: string;
  total_shipments: number;
  at_risk_count: number;
  avg_risk_score: number;
  on_time_rate: number;
  otif_rate: number;
  compliance_rate: number;
  p1_exception_count: number;
  exception_rate: number;
  avg_transit_days_variance: number;
  shipment_count?: number; // alias of total_shipments
}

export interface LanePerformance {
  lane_name: string;
  origin_city: string;
  dest_city: string;
  total_shipments: number;
  avg_risk_score: number;
  avg_delay_risk_score: number;
  on_time_rate: number;
  otif_rate: number;
  avg_milestone_completeness: number;
  active_exceptions: number;
  dominant_carrier: string;
}

export type SSEEvent =
  | { type: "connected"; message: string }
  | { type: "new_exception"; exception_id: string; shipment_id: string; exception_type: string; severity: string; message: string; business_impact_score: number }
  | { type: "gps_update"; count: number };


// ──────────────────────────────────────────────
// Container Yard & ML Interfaces
// ──────────────────────────────────────────────

export interface Container {
  id: string;
  container_number: string;
  size_teu: number;
  weight_tier: "LIGHT" | "MEDIUM" | "HEAVY" | string;
  hazard: boolean;
  destination: string;
  priority: "STANDARD" | "HIGH" | "URGENT" | string;
  status: "IN_TRANSIT" | "AT_GATE" | "YARD_STACKED" | "DEPARTED" | string;
  current_slot_id: string | null;
  created_at: string;
  dwell_days?: number;
  iso_code?: string;
  gross_weight_kg?: number;
  reefer?: boolean;
}

export interface SlotContainerInfo {
  id: string;
  container_number: string;
  size_teu: number;
  weight_tier: string;
  hazard: boolean;
  destination: string;
  priority: string;
  status: string;
}

export interface GateContainerSummary {
  id: string;
  container_number: string;
  size_teu: number;
  weight_tier: string;
  hazard: boolean;
  destination: string;
  priority: string;
  status: string;
  created_at?: string;
}

export interface YardSlot {
  id: string;
  block: string;
  bay: number;
  row: number;
  tier: number;
  is_occupied: boolean;
  container: SlotContainerInfo | null;
}

export interface YardState {
  total_slots: number;
  occupied_slots: number;
  available_slots: number;
  occupancy_rate_pct: number;
  blocks: Record<string, YardSlot[]>;
  containers_at_gate?: GateContainerSummary[];
}

export interface ModelMetricDetail {
  MAE: number;
  RMSE: number;
  R2: number;
}

export interface MLMetrics {
  features: string[];
  n_train_samples: number;
  n_test_samples: number;
  metrics: {
    Baseline_Linear: ModelMetricDetail;
    Random_Forest: ModelMetricDetail;
    XGBoost: ModelMetricDetail;
  };
  feature_importance?: {
    random_forest: Record<string, number>;
    xgboost: Record<string, number>;
  };
}

export interface DelayPredictionRequest {
  remaining_distance?: number;
  current_progress?: number;
  current_speed?: number;
  dwell_time?: number;
  yard_congestion?: number;
  historical_delay?: number;
  priority?: string;
  route_risk?: number;
  model_name?: "baseline_linear" | "random_forest" | "xgboost" | string;
  container_id?: string;
  shipment_id?: string;
}

export interface DelayPredictionResponse {
  primary_predicted_delay_minutes: number;
  selected_model: string;
  comparison: Record<string, number>;
  features_applied: Record<string, any>;
  predicted_eta?: string | null;
  container_id?: string | null;
  container_number?: string | null;
  shipment_id?: string | null;
  timestamp?: string | null;
}

export interface CostBreakdown {
  movement_cost: number;
  retrieval_cost: number;
  congestion_penalty: number;
  blocking_penalty: number;
  priority_penalty: number;
  cluster_bonus: number;
  total_cost: number;
}

export interface SlotAllocationResponse {
  container_id: string;
  container_number: string;
  allocated_slot_id: string | null;
  block: string | null;
  bay: number | null;
  row: number | null;
  tier: number | null;
  strategy_used: string;
  cost_score: number;
  cost_breakdown: CostBreakdown | null;
  rationale: string;
  rl_zone_action?: string | null;
}

export interface AllocationComparisonResponse {
  container_id: string;
  container_number: string;
  destination: string;
  priority: string;
  weight_tier: string;
  first_fit_slot: string | null;
  nearest_slot: string | null;
  intelligent_slot: string | null;
  rl_slot: string | null;
  rl_available: boolean;
  dqn_slot?: string | null;
  dqn_available?: boolean;
  recommended_slot: string | null;
  recommended_strategy: string;
  intelligent_cost_breakdown: CostBreakdown | null;
  first_fit_cost: number | null;
  nearest_cost: number | null;
  intelligent_cost: number | null;
  rl_cost: number | null;
  dqn_cost?: number | null;
  rl_zone_action: string | null;
  dqn_zone_action?: string | null;
  reason: string;
}

export interface AllocationStrategyMetrics {
  n_total?: number;
  n_success?: number;
  n_episodes?: number;
  avg_total_cost: number;
  avg_movement_cost: number;
  avg_retrieval_cost: number;
  avg_congestion_penalty?: number;
  avg_blocking_penalty?: number;
  avg_priority_penalty?: number;
  avg_cluster_bonus?: number;
  avg_reward_per_step?: number;
  avg_episode_reward?: number;
  avg_manhattan_distance?: number;
  blocked_access_count?: number;
  blocked_access_rate_pct: number;
  pct_improvement_over_first_fit?: number;
  pct_cost_improvement_over_first_fit?: number;
}

export interface AllocationBenchmarkResult {
  benchmark_config: {
    seed: number;
    n_arrivals: number;
    rl_agent_available: boolean;
  };
  summaries: Record<string, AllocationStrategyMetrics>;
}

export interface RLEvaluationResult {
  eval_config: {
    eval_seed: number;
    training_seed: number;
    n_eval_episodes: number;
    episode_length: number;
    rl_agent_available: boolean;
    elapsed_s: number;
  };
  strategy_results: Record<string, AllocationStrategyMetrics>;
  rl_vs_intelligent: {
    rl_avg_cost: number;
    intelligent_avg_cost: number;
    rl_outperforms_intelligent: boolean;
    cost_margin: number;
    verdict: string;
  } | null;
}

export interface GatePredictionDetail {
  primary_predicted_delay_minutes: number;
  predicted_eta: string;
  selected_model: string;
  comparison: Record<string, number>;
}

export interface GateInspectionResponse {
  status: "SUCCESS" | "FLAGGED" | string;
  container_number: string | null;
  raw_ocr_text: string;
  validated_code: string | null;
  is_valid: boolean;
  confidence: number;
  detection_confidence?: number;
  ocr_confidence?: number;
  detected_boxes: number[][];
  message: string;
  container_id: string | null;
  container_status?: string | null;
  container_details?: Record<string, any> | null;
  prediction?: GatePredictionDetail | null;
  allocation_recommendation?: AllocationComparisonResponse | null;
  image_path?: string | null;
  detections?: Array<{ bbox: number[]; class: string; confidence: number }>;
  ocr_results?: Array<{ text: string; confidence: number }>;
  latency_ms?: number;
}

export interface CVOCRMetrics {
  total_test_images: number;
  detection_success_rate_pct: number;
  ocr_exact_match_accuracy_pct: number;
  character_level_accuracy_pct: number;
  iso_validation_accuracy_pct: number;
  average_latency_ms: number;
  detailed_results: Array<{
    filename: string;
    expected_code: string;
    detected_code: string;
    is_exact_match: boolean;
    is_valid: boolean;
    expected_valid: boolean;
    latency_ms: number;
    confidence: number;
    message: string;
  }>;
  test_results?: Array<{ image_file: string; expected_code: string; extracted_code: string; exact_match: boolean }>;
  detection_rate?: number;
  ocr_exact_match_rate?: number;
  char_level_accuracy?: number;
  iso_validation_accuracy?: number;
  avg_latency_ms?: number;
}


// ──────────────────────────────────────────────
// API Fetch Infrastructure
// ──────────────────────────────────────────────

const USE_MOCK = false;

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.error?.message || err?.detail || res.statusText);
  }
  return res.json();
}

export function subscribeToSSE(onEvent: (event: SSEEvent) => void): () => void {
  if (USE_MOCK) {
    setTimeout(() => onEvent({ type: "connected", message: "Connected to live stream" }), 500);
    return () => {};
  }

  const es = new EventSource(`${API_BASE}/api/v1/stream`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as SSEEvent;
      onEvent(data);
    } catch {
      // ignore
    }
  };
  es.onerror = () => {};
  return () => es.close();
}


function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

export function normalizeScorecard(raw: any): CarrierScorecard {
  const total = num(raw.total_shipments ?? raw.shipment_count, 0);
  const otif = num(raw.otif_rate ?? raw.on_time_rate, 0);
  return {
    carrier_name: String(raw.carrier_name ?? "Unknown"),
    total_shipments: total,
    at_risk_count: num(raw.at_risk_count, 0),
    avg_risk_score: num(raw.avg_risk_score, 0),
    on_time_rate: num(raw.on_time_rate ?? raw.otif_rate, otif),
    otif_rate: otif,
    compliance_rate: num(raw.compliance_rate, 0),
    p1_exception_count: num(raw.p1_exception_count, 0),
    exception_rate: num(raw.exception_rate, 0),
    avg_transit_days_variance: num(raw.avg_transit_days_variance, 0),
    shipment_count: num(raw.shipment_count ?? total, total),
  };
}

export function normalizeLane(raw: any): LanePerformance {
  const risk = num(raw.avg_risk_score ?? raw.avg_delay_risk_score, 0);
  const otif = num(raw.otif_rate ?? raw.on_time_rate, 0);
  return {
    lane_name: String(raw.lane_name ?? "Unknown"),
    origin_city: String(raw.origin_city ?? ""),
    dest_city: String(raw.dest_city ?? ""),
    total_shipments: num(raw.total_shipments, 0),
    avg_risk_score: risk,
    avg_delay_risk_score: num(raw.avg_delay_risk_score ?? risk, risk),
    on_time_rate: num(raw.on_time_rate ?? raw.otif_rate, otif),
    otif_rate: otif,
    avg_milestone_completeness: num(raw.avg_milestone_completeness, 0),
    active_exceptions: num(raw.active_exceptions, 0),
    dominant_carrier: String(raw.dominant_carrier ?? "Volvo Logistics"),
  };
}


// ──────────────────────────────────────────────
// Volvo API Client Object
// ──────────────────────────────────────────────

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
  getShipments: async (params?: { status?: string; carrier?: string; lane?: string; search?: string; criticality?: string; sort?: string; page?: number; limit?: number }) => {
    if (USE_MOCK) {
      return { items: mockShipments, total: mockShipments.length, page: 1, limit: mockShipments.length };
    }
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.carrier) q.set("carrier", params.carrier);
    if (params?.lane) q.set("lane", params.lane);
    if (params?.search) q.set("search", params.search);
    if (params?.criticality) q.set("criticality", params.criticality);
    if (params?.sort) q.set("sort", params.sort);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return fetchJson<{ items: Shipment[]; total: number; page: number; limit: number }>(`/api/v1/shipments${qs ? `?${qs}` : ""}`);
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
      // Backend returns {answer, sources_used, session_id}; normalize to UI shape.
      const raw = await fetchJson<{ answer: string; sources_used?: string[]; sources?: string[]; session_id?: string }>(
        "/api/v1/copilot/chat",
        {
          method: "POST",
          body: JSON.stringify({ question, session_id: sessionId }),
        }
      );
      return { answer: raw.answer, sources: raw.sources_used ?? raw.sources ?? [] };
    } catch (e) {
      if (!USE_MOCK) throw e;
      console.warn("Backend copilot API failed, using mock fallback:", e);
      return { 
        answer: "Based on latest telemetry, shipment SHP-10492 is at risk near Hamburg due to weather.", 
        sources: ["Weather API", "Carrier Update"] 
      };
    }
  },
  getCarrierScorecards: async () => {
    const raw = USE_MOCK ? (mockScorecards as any[]) : await fetchJson<any[]>("/api/v1/reports/carrier-scorecards");
    return raw.map(normalizeScorecard);
  },
  getLanePerformance: async () => {
    const raw = USE_MOCK ? (mockLanes as any[]) : await fetchJson<any[]>("/api/v1/reports/lane-performance");
    return raw.map(normalizeLane);
  },
};


// ──────────────────────────────────────────────
// Standalone Yard & ML API Client Functions
// ──────────────────────────────────────────────

export async function fetchYardState(): Promise<YardState> {
  const res = await fetch(`${API_BASE}/api/v1/yard/state`);
  if (!res.ok) throw new Error(`Failed to fetch yard state: ${res.statusText}`);
  return res.json();
}

export async function fetchContainers(status?: string, priority?: string): Promise<Container[]> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (priority) params.append("priority", priority);
  const url = `${API_BASE}/api/v1/containers${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch containers: ${res.statusText}`);
  return res.json();
}

export async function fetchShipments(status?: string): Promise<Shipment[]> {
  // Single source of truth: delegate to api.getShipments (handles mock + paginated shape).
  const data = await api.getShipments(status ? { status, limit: 200 } : { limit: 200 });
  if (Array.isArray(data)) return data as Shipment[];
  return (data as { items?: Shipment[] }).items || [];
}

export async function fetchMLMetrics(): Promise<MLMetrics> {
  const res = await fetch(`${API_BASE}/api/v1/ml/metrics`);
  if (!res.ok) throw new Error(`Failed to fetch ML metrics: ${res.statusText}`);
  return res.json();
}

export async function predictDelay(payload: DelayPredictionRequest): Promise<DelayPredictionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ml/predict-delay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Prediction failed: ${res.statusText}`);
  return res.json();
}

export async function allocateSlot(
  containerId: string,
  strategy: "first_fit" | "nearest" | "intelligent" | "rl" | string = "intelligent",
  targetSlotId?: string
): Promise<SlotAllocationResponse> {
  const res = await fetch(`${API_BASE}/api/v1/yard/allocate-slot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      container_id: containerId,
      strategy,
      target_slot_id: targetSlotId,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Slot allocation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function compareAllocation(containerId: string): Promise<AllocationComparisonResponse> {
  const res = await fetch(`${API_BASE}/api/v1/yard/allocate-slot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ container_id: containerId, strategy: "compare" }),
  });
  if (!res.ok) throw new Error(`Allocation comparison failed: ${res.statusText}`);
  return res.json();
}

export async function fetchAllocationBenchmark(): Promise<AllocationBenchmarkResult> {
  const res = await fetch(`${API_BASE}/api/v1/yard/benchmark`);
  if (!res.ok) throw new Error(`Benchmark not available: ${res.statusText}`);
  return res.json();
}

export async function fetchRLEvaluation(): Promise<RLEvaluationResult> {
  const res = await fetch(`${API_BASE}/api/v1/yard/rl-evaluation`);
  if (!res.ok) throw new Error(`RL evaluation not available: ${res.statusText}`);
  return res.json();
}

export async function processGateInspectionFile(file?: File): Promise<GateInspectionResponse> {
  let res: Response;
  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    res = await fetch(`${API_BASE}/api/v1/inspection/process-gate`, {
      method: "POST",
      body: formData,
    });
  } else {
    res = await fetch(`${API_BASE}/api/v1/inspection/process-gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }
  if (!res.ok) throw new Error(`Gate inspection failed: ${res.statusText}`);
  return res.json();
}

export async function fetchCVOCRMetrics(): Promise<CVOCRMetrics> {
  const res = await fetch(`${API_BASE}/api/v1/inspection/metrics`);
  if (!res.ok) throw new Error(`Failed to fetch CV/OCR metrics: ${res.statusText}`);
  return res.json();
}

export async function fetchDqnTrainingLog(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/yard/dqn-training-log`);
  if (!res.ok) throw new Error(`Failed to fetch DQN training log: ${res.statusText}`);
  return res.json();
}

export async function fetchDriftStatus(sampleSize: number = 200): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/ml/drift-status?sample_size=${sampleSize}`);
  if (!res.ok) throw new Error(`Failed to fetch drift status: ${res.statusText}`);
  return res.json();
}

export async function triggerRetraining(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/ml/trigger-retrain`, { method: "POST" });
  if (!res.ok) throw new Error(`Retraining request failed: ${res.statusText}`);
  return res.json();
}

