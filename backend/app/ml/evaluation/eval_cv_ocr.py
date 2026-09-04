"""
CV Detection & OCR Evaluation Benchmark Script.
Executes the container detection and OCR extraction pipeline on the sample container dataset,
calculates measurable metrics (Detection Rate, Exact-Match Accuracy, Char-Level Accuracy, ISO Validation Rate, Latency).
"""
import json
import os
import time
from typing import Any, Dict, List
import cv2

from app.ml.cv_detector import container_detector
from app.ml.ocr_engine import ocr_engine
from app.ml.evaluation.generate_test_dataset import create_standard_testbed


def evaluate_cv_ocr_pipeline() -> Dict[str, Any]:
    """Run full benchmark on container test images."""
    dataset = create_standard_testbed()

    total_images = len(dataset)
    successful_detections = 0
    exact_matches = 0
    total_chars = 0
    matched_chars = 0
    correct_validations = 0
    latencies: List[float] = []
    results_detail = []

    print(f"\n=== Running CV & OCR Evaluation on {total_images} Test Images ===")

    for item in dataset:
        filepath = item["filepath"]
        expected_code = item["expected_code"]
        expected_valid = item["expected_is_valid"]

        t0 = time.perf_counter()

        # 1. Detection
        detections = container_detector.detect_containers(filepath)
        has_detection = len(detections) > 0
        if has_detection:
            successful_detections += 1

        # Use primary detected crop
        crop = detections[0]["crop"] if has_detection else cv2.imread(filepath)

        # 2. OCR & ISO 6346 Validation
        ocr_res = ocr_engine.extract_and_validate(crop)

        t1 = time.perf_counter()
        latency_ms = (t1 - t0) * 1000.0
        latencies.append(latency_ms)

        candidate_code = ocr_res.get("candidate_code") or ""
        is_valid = ocr_res.get("is_valid", False)

        # Metrics computation
        is_exact = (candidate_code == expected_code)
        if is_exact:
            exact_matches += 1

        # Character-level matching
        min_len = min(len(candidate_code), len(expected_code))
        char_match_count = sum(1 for a, b in zip(candidate_code[:min_len], expected_code[:min_len]))
        matched_chars += char_match_count
        total_chars += len(expected_code)

        # Validation accuracy (whether the validator correctly verified valid or correctly flagged corrupt)
        if is_valid == expected_valid:
            correct_validations += 1

        print(f"[{item['filename']}] Expected: {expected_code} | Got: {candidate_code} | Valid: {is_valid} | Match: {is_exact} | Latency: {latency_ms:.1f}ms")

        results_detail.append({
            "filename": item["filename"],
            "expected_code": expected_code,
            "detected_code": candidate_code,
            "is_exact_match": is_exact,
            "is_valid": is_valid,
            "expected_valid": expected_valid,
            "latency_ms": round(latency_ms, 2),
            "confidence": ocr_res.get("confidence", 0.0),
            "message": ocr_res.get("message", ""),
        })

    detection_rate = round((successful_detections / total_images) * 100.0, 2)
    exact_match_acc = round((exact_matches / total_images) * 100.0, 2)
    char_acc = round((matched_chars / max(1, total_chars)) * 100.0, 2)
    val_acc = round((correct_validations / total_images) * 100.0, 2)
    avg_latency = round(sum(latencies) / len(latencies), 2)

    summary = {
        "total_test_images": total_images,
        "detection_success_rate_pct": detection_rate,
        "ocr_exact_match_accuracy_pct": exact_match_acc,
        "character_level_accuracy_pct": char_acc,
        "iso_validation_accuracy_pct": val_acc,
        "average_latency_ms": avg_latency,
        "detailed_results": results_detail,
    }

    # Persist evaluation results
    eval_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cv_ocr_metrics.json")
    with open(eval_path, "w") as f:
        json.dump(summary, f, indent=2)

    print("\n=== Final CV + OCR Evaluation Benchmark Summary ===")
    print(f"Total Test Images:            {total_images}")
    print(f"Detection Success Rate:       {detection_rate}%")
    print(f"OCR Exact Match Accuracy:     {exact_match_acc}%")
    print(f"Character-Level Accuracy:     {char_acc}%")
    print(f"ISO 6346 Validation Accuracy: {val_acc}%")
    print(f"Average Latency per Image:    {avg_latency:.1f} ms")

    return summary


if __name__ == "__main__":
    evaluate_cv_ocr_pipeline()
