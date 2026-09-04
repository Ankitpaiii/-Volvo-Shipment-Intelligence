"""
Gate Inspection Service.
Executes end-to-end Container Gate Processing:
Image Input -> Bounding Box Detection -> OCR Extraction -> ISO 6346 Validation -> Container Resolution -> Predictive Delay Trigger -> Database Logging.
"""
from datetime import datetime
import os
import uuid
from typing import Any, Dict, Optional, Union
import cv2
import numpy as np
from PIL import Image
from sqlalchemy.orm import Session

from app.ml.cv_detector import container_detector
from app.ml.ocr_engine import ocr_engine
from app.ml.delay_predictor import delay_predictor
from app.models import Container, ContainerStatus, GateInspection, InspectionStatus


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "uploads")


def process_gate_image(
    image_input: Union[str, bytes, np.ndarray, Image.Image],
    filename: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Process container image captured at gate checkpoint.
    Performs full resolution:
    1. Detection (YOLOv8 + Contour Fallback)
    2. OCR (EasyOCR)
    3. ISO 6346 Check-Digit Validation
    4. Database Resolution (Lookup/Create Container with status AT_GATE)
    5. Predictive ML Inference (Live XGBoost delay prediction on resolved shipment)
    6. Persistence: Logs GateInspection record with inspection status, predictions, and links.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    saved_path = ""

    # 1. Convert input to BGR numpy array and save copy to disk
    if isinstance(image_input, str):
        saved_path = image_input
        img_bgr = cv2.imread(image_input)
    elif isinstance(image_input, bytes):
        unique_name = f"gate_upload_{uuid.uuid4().hex[:8]}_{filename or 'image.jpg'}"
        saved_path = os.path.join(UPLOAD_DIR, unique_name)
        nparr = np.frombuffer(image_input, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is not None:
            cv2.imwrite(saved_path, img_bgr)
    elif isinstance(image_input, Image.Image):
        unique_name = f"gate_upload_{uuid.uuid4().hex[:8]}.jpg"
        saved_path = os.path.join(UPLOAD_DIR, unique_name)
        img_bgr = cv2.cvtColor(np.array(image_input), cv2.COLOR_RGB2BGR)
        cv2.imwrite(saved_path, img_bgr)
    elif isinstance(image_input, np.ndarray):
        unique_name = f"gate_upload_{uuid.uuid4().hex[:8]}.jpg"
        saved_path = os.path.join(UPLOAD_DIR, unique_name)
        img_bgr = image_input
        cv2.imwrite(saved_path, img_bgr)
    else:
        raise TypeError("Unsupported image input type for gate inspection")

    if img_bgr is None or img_bgr.size == 0:
        return {
            "status": InspectionStatus.FLAGGED.value,
            "container_number": None,
            "raw_ocr_text": "",
            "validated_code": None,
            "is_valid": False,
            "confidence": 0.0,
            "detection_confidence": 0.0,
            "ocr_confidence": 0.0,
            "detected_boxes": [],
            "message": "Invalid or unreadable image",
            "container_id": None,
            "container_status": None,
            "container_details": None,
            "prediction": None,
            "image_path": saved_path,
        }

    # 2. Multi-Class Container, Placard, and Corner Detection (ONNX / PyTorch)
    detections = container_detector.detect_containers(img_bgr, detect_substructures=True)
    primary_detection = next((d for d in detections if d.get("class_name") == "container"), (detections[0] if detections else None))
    placard_detection = next((d for d in detections if d.get("class_name") == "iso_placard"), None)

    detected_box = primary_detection["box_normalized"] if primary_detection else [0.0, 0.0, 1.0, 1.0]
    det_confidence = primary_detection["confidence"] if primary_detection else 0.50

    # 3. High-Accuracy OCR & ISO 6346 Validation
    # Prioritize enhanced placard crop; fallback to primary container crop or full frame
    ocr_result = None
    if placard_detection and placard_detection.get("crop") is not None:
        ocr_result = ocr_engine.extract_and_validate(placard_detection["crop"])

    if not ocr_result or not ocr_result.get("is_valid"):
        fallback_crop = primary_detection["crop"] if primary_detection else img_bgr
        fallback_ocr = ocr_engine.extract_and_validate(fallback_crop)
        if (not ocr_result) or (fallback_ocr.get("is_valid") and not ocr_result.get("is_valid")):
            ocr_result = fallback_ocr

    raw_text = ocr_result.get("raw_text", "")
    candidate_code = ocr_result.get("candidate_code")
    validated_code = ocr_result.get("validated_code")
    is_valid = ocr_result.get("is_valid", False)
    ocr_confidence = ocr_result.get("confidence", 0.0)
    validation_message = ocr_result.get("message", "")

    overall_confidence = round(float((det_confidence * 0.4) + (ocr_confidence * 0.6)), 2)
    inspection_status = InspectionStatus.SUCCESS.value if is_valid else InspectionStatus.FLAGGED.value

    # 4. Container Resolution & Digital Twin State Update
    matched_container_id = None
    container_status = None
    container_info = None
    prediction_info = None

    if db is not None:
        # Only resolve to a Container record if OCR successfully validated an ISO 6346 code
        # Invalid check digits do NOT create or falsely mutate containers
        if is_valid and validated_code:
            existing_container = db.query(Container).filter(Container.container_number == validated_code).first()
            if existing_container:
                # Existing container: advance status to AT_GATE if in transit or already at gate
                if existing_container.status in (ContainerStatus.IN_TRANSIT.value, ContainerStatus.AT_GATE.value):
                    existing_container.status = ContainerStatus.AT_GATE.value
                matched_container = existing_container
            else:
                # New container: create new Container record with documented standard defaults
                matched_container = Container(
                    container_number=validated_code,
                    size_teu=20,                    # Default standard TEU
                    weight_tier="MEDIUM",           # Default standard weight
                    hazard=False,                   # Default non-hazardous
                    destination="Rotterdam",        # Default hub terminal destination
                    priority="STANDARD",            # Default standard operational priority
                    status=ContainerStatus.AT_GATE.value,
                    current_slot_id=None,           # Not assigned to yard slot yet
                )
                db.add(matched_container)

            db.commit()
            db.refresh(matched_container)

            matched_container_id = matched_container.id
            container_status = matched_container.status
            container_info = {
                "id": matched_container.id,
                "container_number": matched_container.container_number,
                "size_teu": matched_container.size_teu,
                "weight_tier": matched_container.weight_tier,
                "hazard": matched_container.hazard,
                "destination": matched_container.destination,
                "priority": matched_container.priority,
                "status": matched_container.status,
                "current_slot_id": matched_container.current_slot_id,
                "created_at": matched_container.created_at.isoformat() if hasattr(matched_container, "created_at") and matched_container.created_at else None,
            }

            # 5. Execute Live Predictive Delay Model for this container
            try:
                pred_res = delay_predictor.predict_for_container(
                    db=db,
                    container_id=matched_container.id,
                    selected_model="xgboost",
                )
                prediction_info = {
                    "primary_predicted_delay_minutes": pred_res["primary_predicted_delay_minutes"],
                    "predicted_eta": pred_res["predicted_eta"],
                    "selected_model": pred_res["selected_model"],
                    "comparison": pred_res["comparison"],
                }
            except Exception as pe:
                print(f"Prediction during gate inspection notice: {pe}")

        # Persist GateInspection record
        try:
            inspection_record = GateInspection(
                timestamp=datetime.utcnow(),
                image_path=saved_path,
                raw_ocr_text=raw_text,
                validated_code=validated_code,
                confidence=overall_confidence,
                status=inspection_status,
                detected_box=detected_box,
            )
            db.add(inspection_record)
            db.commit()
            db.refresh(inspection_record)
        except Exception as e:
            print(f"Failed to log inspection record: {e}")
            db.rollback()

    return {
        "status": inspection_status,
        "container_number": validated_code or candidate_code,
        "raw_ocr_text": raw_text,
        "validated_code": validated_code,
        "is_valid": is_valid,
        "confidence": overall_confidence,
        "detection_confidence": det_confidence,
        "ocr_confidence": ocr_confidence,
        "detected_boxes": [d["box_normalized"] for d in detections] if detections else [detected_box],
        "detections": [
            {
                "class_name": d.get("class_name", "container"),
                "confidence": d.get("confidence", 0.0),
                "box_normalized": d.get("box_normalized", [0, 0, 1, 1]),
                "engine": d.get("engine", "onnx")
            }
            for d in detections
        ],
        "message": validation_message,
        "container_id": matched_container_id,
        "container_status": container_status,
        "container_details": container_info,
        "prediction": prediction_info,
        "image_path": saved_path,
        "engine": container_detector.engine_type
    }
