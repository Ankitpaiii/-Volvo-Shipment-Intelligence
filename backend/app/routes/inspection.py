"""Computer Vision & gate inspection endpoints."""
import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.audit import log_action
from app.auth import Actor, require_writer
from app.database import get_db
from app.ml.evaluation.eval_cv_ocr import evaluate_cv_ocr_pipeline
from app.schemas import (
    CVOCRMetricsResponse,
    GateInspectionRequest,
    GateInspectionResponse,
)
from app.services.inspection_service import process_gate_image

router = APIRouter()


@router.post("/inspection/process-gate", response_model=GateInspectionResponse)
async def process_gate_inspection(
    file: Optional[UploadFile] = File(None),
    payload: Optional[GateInspectionRequest] = None,
    db: Session = Depends(get_db),
    actor: Actor = Depends(require_writer),
):
    """
    Execute end-to-end Container Gate Processing:
    Image Input -> YOLOv8 Detection -> EasyOCR Extraction -> ISO 6346 Validation -> Database Logging.
    """
    MAX_UPLOAD_BYTES = 12 * 1024 * 1024
    try:
        if file is not None:
            if file.content_type and not file.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_IMAGE_TYPE", "message": "Only image uploads allowed"}})
            contents = await file.read()
            if len(contents) > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=400, detail={"error": {"code": "IMAGE_TOO_LARGE", "message": "Image exceeds 12MB limit"}})
            if not contents:
                raise HTTPException(status_code=400, detail={"error": {"code": "EMPTY_IMAGE", "message": "Empty upload"}})
            res = process_gate_image(contents, filename=file.filename, db=db)
        elif payload and payload.image_path:
            res = process_gate_image(payload.image_path, db=db)
        else:
            sample_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data", "sample_images", "gate_test_01_mscu.jpg"
            )
            if not os.path.exists(sample_path):
                from app.ml.evaluation.generate_test_dataset import create_standard_testbed
                create_standard_testbed()
            res = process_gate_image(sample_path, db=db)
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail={"error": {"code": "INVALID_IMAGE_PATH", "message": str(e)}})

    log_action(
        db, actor.name, "inspection.gate", "container", res.get("container_id") or "unknown",
        {"validated_code": res.get("validated_code"), "status": res.get("status")},
    )
    return GateInspectionResponse(**res)


@router.get("/inspection/metrics", response_model=CVOCRMetricsResponse)
def get_cv_ocr_metrics():
    """
    Returns actual measured Computer Vision and OCR benchmark evaluation metrics.
    """
    eval_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "ml", "evaluation", "cv_ocr_metrics.json"
    )
    if os.path.exists(eval_path):
        with open(eval_path, "r") as f:
            return json.load(f)
    return evaluate_cv_ocr_pipeline()
