"""
Container Image Testbed Generator for CV and OCR Evaluation.
Generates realistic container images with authentic ISO 6346 markings,
door textures, corner castings, varying angles, and lighting conditions.
"""
import os
import random
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from app.ml.ocr_engine import ContainerOCREngine

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "sample_images")


def generate_valid_iso_container_code(owner_prefix: str, serial_6: int) -> str:
    """Generate an authentic ISO 6346 container code with correct 11th check digit."""
    prefix_10 = f"{owner_prefix}{serial_6:06d}"
    check_digit = ContainerOCREngine.calculate_iso_check_digit(prefix_10)
    return f"{prefix_10}{check_digit}"


def render_container_image(
    container_code: str,
    output_path: str,
    width: int = 800,
    height: int = 600,
    bg_color: tuple = (30, 70, 140),  # Ocean Blue / Industrial
    noise_level: float = 0.05,
    angle: float = 0.0,
):
    """
    Render a photorealistic container gate inspection image with ISO markings,
    corrugated panel lines, container border framing, and labels.
    """
    # 1. Base container corrugated texture
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = bg_color

    # Add vertical corrugation ribs
    for x in range(50, width - 50, 40):
        cv2.line(img, (x, 50), (x, height - 50), (max(0, bg_color[0] - 25), max(0, bg_color[1] - 25), max(0, bg_color[2] - 25)), 8)
        cv2.line(img, (x + 10, 50), (x + 10, height - 50), (min(255, bg_color[0] + 25), min(255, bg_color[1] + 25), min(255, bg_color[2] + 25)), 4)

    # Add steel container perimeter border and corner castings
    cv2.rectangle(img, (40, 40), (width - 40, height - 40), (20, 20, 25), 10)
    # Corner castings
    cv2.rectangle(img, (35, 35), (85, 85), (60, 60, 65), -1)
    cv2.rectangle(img, (width - 85, 35), (width - 35, 85), (60, 60, 65), -1)
    cv2.rectangle(img, (35, height - 85), (85, height - 35), (60, 60, 65), -1)
    cv2.rectangle(img, (width - 85, height - 85), (width - 35, height - 35), (60, 60, 65), -1)

    # Convert to PIL for crisp typography
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil_img)

    # White identification plate background
    plate_x1, plate_y1 = 440, 110
    plate_x2, plate_y2 = 730, 210
    draw.rectangle([plate_x1, plate_y1, plate_x2, plate_y2], fill=(245, 245, 245), outline=(20, 20, 20), width=3)

    # Format text: e.g. "MSCU 782910 4" or "MSCU 7829104"
    formatted_code = f"{container_code[:4]} {container_code[4:10]} [{container_code[10]}]"
    
    # Render main container identification code
    try:
        # Try loading Arial or default font
        font = ImageFont.truetype("arial.ttf", 30)
        sub_font = ImageFont.truetype("arial.ttf", 16)
    except Exception:
        font = ImageFont.load_default()
        sub_font = font

    draw.text((plate_x1 + 15, plate_y1 + 18), formatted_code, fill=(10, 10, 10), font=font)
    draw.text((plate_x1 + 15, plate_y1 + 65), "MAX. GROSS  32,500 KG  71,650 LBS", fill=(50, 50, 50), font=sub_font)

    # Convert back to cv2 for noise / lighting
    res_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    # Add subtle gaussian noise
    if noise_level > 0:
        gauss = np.random.normal(0, noise_level * 255, (height, width, 3)).astype(np.float32)
        noisy = np.clip(res_bgr.astype(np.float32) + gauss, 0, 255).astype(np.uint8)
        res_bgr = noisy

    # Apply perspective / rotation if requested
    if abs(angle) > 0.1:
        M = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1.0)
        res_bgr = cv2.warpAffine(res_bgr, M, (width, height), borderValue=(30, 30, 35))

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, res_bgr)
    return container_code


def create_standard_testbed():
    """Create a curated dataset of test container images with ground truth labels."""
    os.makedirs(DATA_DIR, exist_ok=True)

    ground_truth = [
        # (Prefix, Serial, Color, Angle, Noise, is_corrupt)
        ("MSCU", 782910, (30, 70, 140), 0.0, 0.02, False),    # MSC Mediterranean Blue
        ("CMAU", 523190, (130, 30, 30), 1.5, 0.04, False),    # CMA CGM Burgundy
        ("MAEU", 918230, (140, 130, 40), -1.0, 0.03, False),  # Maersk Cyan-Gray
        ("HLCU", 602931, (20, 80, 160), 0.0, 0.05, False),    # Hapag-Lloyd Orange-Blue
        ("ONEU", 382109, (120, 20, 120), 2.0, 0.03, False),   # ONE Magenta
        ("EVER", 491028, (30, 110, 40), -2.0, 0.04, False),   # Evergreen Green
        ("COSU", 248190, (30, 40, 110), 0.5, 0.03, False),    # COSCO Dark Blue
        ("ZIMU", 850124, (100, 100, 100), 0.0, 0.06, False),  # ZIM Metallic Gray
        ("MSCU", 123456, (30, 70, 140), 0.0, 0.02, True),     # Corrupt check digit test
        ("MAEU", 654321, (140, 130, 40), 0.0, 0.03, True),    # Corrupt check digit test
    ]

    metadata = []

    for idx, (prefix, serial, color, angle, noise, is_corrupt) in enumerate(ground_truth, 1):
        true_code = generate_valid_iso_container_code(prefix, serial)
        test_code = true_code
        if is_corrupt:
            # Deliberately corrupt check digit to test validation failure detection
            wrong_check = (int(true_code[10]) + 3) % 10
            test_code = f"{true_code[:10]}{wrong_check}"

        filename = f"gate_test_{idx:02d}_{prefix.lower()}.jpg"
        filepath = os.path.join(DATA_DIR, filename)

        render_container_image(
            container_code=test_code,
            output_path=filepath,
            bg_color=color,
            noise_level=noise,
            angle=angle,
        )

        metadata.append({
            "filename": filename,
            "filepath": filepath,
            "expected_code": test_code,
            "expected_is_valid": not is_corrupt,
            "is_corrupt_test": is_corrupt,
        })

    print(f"Successfully generated {len(metadata)} test container images in: {DATA_DIR}")
    return metadata


if __name__ == "__main__":
    create_standard_testbed()
