from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Volvo Shipment Intelligence Schemas
# ──────────────────────────────────────────────

class ShipmentReference(BaseModel):
    ref_type: str
    ref_value: str


class ShipmentCreate(BaseModel):
    po_number: str
    supplier_name: str
    carrier_name: str
    lane_name: str
    origin_city: str
    dest_city: str
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    part_criticality: str = "STANDARD"
    planned_pickup: datetime
    planned_delivery: datetime
    references: dict[str, str] = Field(default_factory=dict)
    container_id: Optional[str] = None


class ShipmentUpdate(BaseModel):
    status: Optional[str] = None
    carrier_name: Optional[str] = None
    delay_risk_score: Optional[int] = None
    health_score: Optional[int] = None


class ShipmentSummary(BaseModel):
    shipment_id: str
    po_number: str
    status: str
    supplier_name: str
    carrier_name: str
    lane_name: str
    origin_city: str
    dest_city: str
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    part_criticality: str
    planned_pickup: datetime
    planned_delivery: datetime
    delay_risk_score: int
    health_score: int
    predicted_delivery: Optional[datetime] = None
    eta_confidence: float
    flags: list[str]

    # Additional ML & Container fields
    id: Optional[str] = None
    container_id: Optional[str] = None
    container_number: Optional[str] = None
    distance: Optional[float] = None
    current_progress: Optional[float] = None
    current_speed: Optional[float] = None
    dwell_time: Optional[float] = None
    yard_congestion: Optional[float] = None
    historical_delay: Optional[float] = None
    predicted_delay: Optional[float] = None
    predicted_eta: Optional[datetime] = None
    priority: Optional[str] = None

    model_config = {"from_attributes": True}


class ShipmentDetail(ShipmentSummary):
    actual_pickup: Optional[datetime] = None
    actual_delivery: Optional[datetime] = None
    references: dict[str, str] = Field(default_factory=dict)
    created_at: datetime


class EventCreate(BaseModel):
    event_type: str
    source: str
    event_time: Optional[datetime] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class EventResponse(BaseModel):
    event_id: str
    shipment_id: str
    event_type: str
    source: str
    event_time: datetime
    received_time: datetime
    payload: dict[str, Any]

    model_config = {"from_attributes": True}


class ExceptionAction(BaseModel):
    action: str = Field(..., description="re_route | expedite | change_carrier | notify_supplier | ignore")
    reason: Optional[str] = None


class ExceptionResponse(BaseModel):
    exception_id: str
    shipment_id: str
    po_number: Optional[str] = None
    lane_name: Optional[str] = None
    dest_city: Optional[str] = None
    exception_type: str
    severity: str
    root_cause: Optional[str] = None
    status: str
    business_impact_score: int
    message: str
    recommended_action: Optional[str] = None
    raised_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class KPIResponse(BaseModel):
    shipments_in_transit: int
    at_risk_count: int
    missing_milestone_count: int
    open_exceptions: int
    avg_health_score: float


class ExtendedKPIResponse(KPIResponse):
    otif_pct: float
    on_time_pickup_pct: float
    avg_dwell_hours: float
    carrier_compliance_pct: float
    critical_at_risk: int   # JIT/JIS shipments at risk
    total_shipments: int


class CarrierScorecard(BaseModel):
    carrier_name: str
    total_shipments: int
    shipment_count: Optional[int] = None
    at_risk_count: int = 0
    avg_risk_score: float = 0.0
    on_time_rate: float = 0.0
    otif_rate: float = 0.0
    compliance_rate: float = 0.0
    p1_exception_count: int = 0
    exception_rate: float = 0.0
    avg_transit_days_variance: float = 0.0


class LanePerformance(BaseModel):
    lane_name: str
    origin_city: str
    dest_city: str
    total_shipments: int
    avg_risk_score: float = 0.0
    avg_delay_risk_score: float = 0.0
    on_time_rate: float = 0.0
    otif_rate: float = 0.0
    avg_milestone_completeness: float = 0.0
    active_exceptions: int = 0
    dominant_carrier: str = "Volvo Logistics"


class PaginatedShipments(BaseModel):
    items: list[ShipmentSummary]
    total: int
    page: int
    limit: int


class ETAResponse(BaseModel):
    shipment_id: str
    planned_delivery: datetime
    predicted_delivery: Optional[datetime] = None
    eta_confidence: float
    delay_minutes: int
    route_risk_factor: float
    factors: list[dict[str, Any]]


class CopilotRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class CopilotResponse(BaseModel):
    answer: str
    sources_used: list[str]
    session_id: str


# ──────────────────────────────────────────────
# Container Yard & Digital Twin Schemas
# ──────────────────────────────────────────────

class ContainerSummary(BaseModel):
    id: str
    container_number: str
    size_teu: int
    weight_tier: str
    hazard: bool
    destination: str
    priority: str
    status: str
    current_slot_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SlotContainerInfo(BaseModel):
    id: str
    container_number: str
    size_teu: int
    weight_tier: str
    hazard: bool
    destination: str
    priority: str
    status: str


class YardSlotDetail(BaseModel):
    id: str
    block: str
    bay: int
    row: int
    tier: int
    is_occupied: bool
    container: Optional[SlotContainerInfo] = None


class GateContainerSummary(BaseModel):
    id: str
    container_number: str
    size_teu: int
    weight_tier: str
    hazard: bool
    destination: str
    priority: str
    status: str
    predicted_delay: Optional[float] = None
    predicted_eta: Optional[datetime] = None
    created_at: Optional[datetime] = None


class YardStateResponse(BaseModel):
    total_slots: int
    occupied_slots: int
    available_slots: int
    occupancy_rate_pct: float
    blocks: Dict[str, List[YardSlotDetail]]
    containers_at_gate: Optional[List[GateContainerSummary]] = None


class SlotAllocationRequest(BaseModel):
    container_id: str
    strategy: str = "intelligent"  # "first_fit", "nearest", "intelligent", "rl", "compare"
    target_slot_id: Optional[str] = None  # Optional specific slot override


class CostBreakdown(BaseModel):
    movement_cost: float
    retrieval_cost: float
    congestion_penalty: float
    blocking_penalty: float
    priority_penalty: float
    cluster_bonus: float
    total_cost: float


class SlotAllocationResponse(BaseModel):
    container_id: str
    container_number: str
    allocated_slot_id: Optional[str]
    block: Optional[str] = None
    bay: Optional[int] = None
    row: Optional[int] = None
    tier: Optional[int] = None
    strategy_used: str
    cost_score: float
    cost_breakdown: Optional[Dict[str, float]] = None
    rationale: str
    rl_zone_action: Optional[str] = None


class AllocationComparisonResponse(BaseModel):
    container_id: str
    container_number: str
    destination: str
    priority: str
    weight_tier: str

    first_fit_slot: Optional[str] = None
    nearest_slot: Optional[str] = None
    intelligent_slot: Optional[str] = None
    rl_slot: Optional[str] = None
    rl_available: bool = False
    dqn_slot: Optional[str] = None
    dqn_available: bool = True

    recommended_slot: Optional[str] = None
    recommended_strategy: str = "intelligent"

    intelligent_cost_breakdown: Optional[Dict[str, float]] = None
    first_fit_cost: Optional[float] = None
    nearest_cost: Optional[float] = None
    intelligent_cost: Optional[float] = None
    rl_cost: Optional[float] = None
    dqn_cost: Optional[float] = None

    rl_zone_action: Optional[str] = None
    dqn_zone_action: Optional[str] = None
    reason: str = ""


# ──────────────────────────────────────────────
# ML & Prediction Schemas
# ──────────────────────────────────────────────

class DelayPredictionRequest(BaseModel):
    container_id: Optional[str] = None
    shipment_id: Optional[str] = None
    remaining_distance: Optional[float] = Field(None, ge=0.0, description="Remaining distance in km")
    current_progress: Optional[float] = Field(None, ge=0.0, le=1.0, description="Trip progress fraction (0.0 - 1.0)")
    current_speed: Optional[float] = Field(None, ge=0.0, description="Current speed in km/h")
    dwell_time: Optional[float] = Field(None, ge=0.0, description="Dwell / checkpoint waiting hours")
    yard_congestion: Optional[float] = Field(None, ge=0.0, le=1.0, description="Yard congestion ratio (0.0 - 1.0)")
    historical_delay: Optional[float] = Field(None, ge=0.0, description="Historical average delay in mins")
    priority: Optional[str] = Field("STANDARD", description="STANDARD, HIGH, or URGENT")
    route_risk: Optional[float] = Field(1.0, description="Corridor risk multiplier")
    model_name: str = Field("xgboost", description="baseline_linear, random_forest, or xgboost")


class DelayPredictionResponse(BaseModel):
    primary_predicted_delay_minutes: float
    selected_model: str
    comparison: Dict[str, float]
    features_applied: Dict[str, Any]
    predicted_eta: Optional[str] = None
    container_id: Optional[str] = None
    container_number: Optional[str] = None
    shipment_id: Optional[str] = None
    timestamp: Optional[str] = None


class ModelMetricDetail(BaseModel):
    MAE: float
    RMSE: float
    R2: float


class MLMetricsResponse(BaseModel):
    serialization: Optional[Dict[str, str]] = None
    features: List[str]
    n_train_samples: int
    n_test_samples: int
    metrics: Dict[str, ModelMetricDetail]
    feature_importance: Optional[Dict[str, Dict[str, float]]] = None
    feature_distributions: Optional[Dict[str, Any]] = None



# ──────────────────────────────────────────────
# Gate Inspection & CV/OCR Schemas
# ──────────────────────────────────────────────

class GateInspectionRequest(BaseModel):
    image_path: Optional[str] = None


class GatePredictionDetail(BaseModel):
    primary_predicted_delay_minutes: float
    predicted_eta: str
    selected_model: str
    comparison: Dict[str, float]


class GateInspectionResponse(BaseModel):
    status: str
    container_number: Optional[str] = None
    raw_ocr_text: str
    validated_code: Optional[str] = None
    is_valid: bool
    confidence: float
    detection_confidence: Optional[float] = None
    ocr_confidence: Optional[float] = None
    detected_boxes: List[List[float]] = []
    message: str
    container_id: Optional[str] = None
    container_status: Optional[str] = None
    container_details: Optional[Dict[str, Any]] = None
    prediction: Optional[GatePredictionDetail] = None
    allocation_recommendation: Optional[AllocationComparisonResponse] = None
    image_path: Optional[str] = None


class CVOCRMetricsResponse(BaseModel):
    total_test_images: int
    detection_success_rate_pct: float
    ocr_exact_match_accuracy_pct: float
    character_level_accuracy_pct: float
    iso_validation_accuracy_pct: float
    average_latency_ms: float
    detailed_results: List[Dict[str, Any]] = []


# ──────────────────────────────────────────────
# Allocation Benchmark & RL Evaluation Schemas
# ──────────────────────────────────────────────

class AllocationStrategyMetrics(BaseModel):
    n_episodes: Optional[int] = None
    n_total: Optional[int] = None
    n_success: Optional[int] = None
    avg_total_cost: float
    avg_movement_cost: float
    avg_retrieval_cost: float
    avg_congestion_penalty: Optional[float] = None
    avg_blocking_penalty: Optional[float] = None
    avg_priority_penalty: Optional[float] = None
    avg_cluster_bonus: Optional[float] = None
    avg_reward_per_step: Optional[float] = None
    avg_episode_reward: Optional[float] = None
    avg_manhattan_distance: Optional[float] = None
    blocked_access_count: Optional[int] = None
    blocked_access_rate_pct: float
    pct_improvement_over_first_fit: Optional[float] = None
    pct_cost_improvement_over_first_fit: Optional[float] = None


class AllocationBenchmarkResponse(BaseModel):
    benchmark_config: Dict[str, Any]
    summaries: Dict[str, AllocationStrategyMetrics]


class RLEvaluationResponse(BaseModel):
    eval_config: Dict[str, Any]
    strategy_results: Dict[str, AllocationStrategyMetrics]
    rl_vs_intelligent: Optional[Dict[str, Any]] = None
