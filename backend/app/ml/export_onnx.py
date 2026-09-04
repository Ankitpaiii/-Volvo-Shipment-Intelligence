"""
ONNX Model Exporter for YOLOv8 Container & Placard Detection.
Exports PyTorch weights (.pt) to optimized ONNX Runtime format (.onnx)
with dynamic input tensor shapes and optional half-precision.
"""
import os
import sys
import time
from typing import Optional

try:
    from ultralytics import YOLO
    import onnx
    import onnxruntime as ort
    _EXPORT_DEPS_AVAILABLE = True
except ImportError:
    _EXPORT_DEPS_AVAILABLE = False

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(BASE_DIR, "ml")
ARTIFACTS_DIR = os.path.join(ML_DIR, "artifacts")
DEFAULT_PT_PATH = os.path.join(ML_DIR, "yolov8n.pt")
DEFAULT_ONNX_PATH = os.path.join(ARTIFACTS_DIR, "yolov8_container.onnx")


def export_yolo_to_onnx(
    pt_path: Optional[str] = None,
    output_onnx_path: Optional[str] = None,
    img_size: int = 640,
    half: bool = False,
    dynamic: bool = True
) -> str:
    """
    Export YOLOv8 model to ONNX format and verify using ONNX Runtime session.
    """
    if not _EXPORT_DEPS_AVAILABLE:
        raise RuntimeError("Required packages (ultralytics, onnx, onnxruntime) not installed.")

    pt_model_path = pt_path or DEFAULT_PT_PATH
    target_onnx = output_onnx_path or DEFAULT_ONNX_PATH

    if not os.path.exists(pt_model_path):
        raise FileNotFoundError(f"PyTorch weight file not found at: {pt_model_path}")

    os.makedirs(os.path.dirname(target_onnx), exist_ok=True)

    print(f"[ONNX Export] Loading YOLOv8 model from {pt_model_path}...")
    model = YOLO(pt_model_path)

    print(f"[ONNX Export] Exporting to ONNX (imgsz={img_size}, dynamic={dynamic})...")
    t0 = time.perf_counter()
    exported_path = model.export(
        format="onnx",
        imgsz=img_size,
        dynamic=dynamic,
        opset=12,
        simplify=False
    )
    t1 = time.perf_counter()
    print(f"[ONNX Export] Export finished in {t1 - t0:.2f}s -> {exported_path}")

    # If ultralytics exported alongside pt, move or copy to target_onnx if different
    if os.path.abspath(exported_path) != os.path.abspath(target_onnx):
        import shutil
        shutil.copy2(exported_path, target_onnx)
        print(f"[ONNX Export] Stored artifact at: {target_onnx}")

    # Verify ONNX model with onnxruntime
    print("[ONNX Export] Verifying ONNX Runtime Inference Session...")
    ort_session = ort.InferenceSession(target_onnx, providers=["CPUExecutionProvider"])
    inputs = ort_session.get_inputs()
    outputs = ort_session.get_outputs()

    print(f"[ONNX Export] Verification Succeeded! Input shape: {[i.shape for i in inputs]}, Output shape: {[o.shape for o in outputs]}")
    return target_onnx


if __name__ == "__main__":
    export_yolo_to_onnx()
