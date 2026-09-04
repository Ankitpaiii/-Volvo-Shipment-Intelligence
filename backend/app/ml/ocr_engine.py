"""
OCR Extraction and ISO 6346 Container Code Validation Engine.
Utilizes EasyOCR and OpenCV image preprocessing to extract alphanumeric container identifiers
and validates them against official ISO 6346 check-digit standards.
"""
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import cv2
import numpy as np
from PIL import Image

try:
    import easyocr
    _EASYOCR_AVAILABLE = True
except ImportError:
    _EASYOCR_AVAILABLE = False


class ContainerOCREngine:
    # Standard ISO 6346 pattern: 4 uppercase letters (Owner code + 'U'/'J'/'Z') + 6 serial digits + 1 check digit
    ISO_REGEX = re.compile(r"[A-Z]{4}\s?[0-9]{6}\s?[0-9]")

    # Character numerical value table per ISO 6346 standard
    # (Note: powers of 11, i.e., 11, 22, 33, are intentionally omitted per ISO specifications)
    CHAR_MAP: Dict[str, int] = {
        'A': 10, 'B': 12, 'C': 13, 'D': 14, 'E': 15, 'F': 16, 'G': 17, 'H': 18, 'I': 19, 'J': 20,
        'K': 21, 'L': 23, 'M': 24, 'N': 25, 'O': 26, 'P': 27, 'Q': 28, 'R': 29, 'S': 30, 'T': 31,
        'U': 32, 'V': 34, 'W': 35, 'X': 36, 'Y': 37, 'Z': 38
    }
    for i in range(10):
        CHAR_MAP[str(i)] = i

    def __init__(self, languages: Optional[List[str]] = None, gpu: bool = False):
        self.languages = languages or ["en"]
        self.gpu = gpu
        self.reader = None
        self._init_reader()

    def _init_reader(self):
        """Initialize EasyOCR reader."""
        if _EASYOCR_AVAILABLE:
            try:
                self.reader = easyocr.Reader(self.languages, gpu=self.gpu)
            except Exception as e:
                print(f"Warning: EasyOCR initialization error: {e}")
                self.reader = None

    @staticmethod
    def calculate_iso_check_digit(first_10_chars: str) -> Optional[int]:
        """
        Calculate the official ISO 6346 check digit (11th character) for 10 alphanumeric characters.
        """
        code_10 = re.sub(r"[^A-Za-z0-9]", "", first_10_chars.upper())
        if len(code_10) != 10:
            return None

        total = 0
        for i, char in enumerate(code_10):
            val = ContainerOCREngine.CHAR_MAP.get(char)
            if val is None:
                return None
            total += val * (2 ** i)

        calculated_check = (total % 11) % 10
        return calculated_check

    @staticmethod
    def validate_iso_6346(code: str) -> Tuple[bool, Optional[str], Optional[int]]:
        """
        Validate container identification code according to ISO 6346 rules and check digit algorithm.
        Returns (is_valid, validation_reason, expected_check_digit).
        """
        cleaned = re.sub(r"[^A-Za-z0-9]", "", code.upper())
        if len(cleaned) != 11:
            return False, f"Invalid length {len(cleaned)} (must be exactly 11 characters)", None

        if not cleaned[:4].isalpha():
            return False, "First 4 characters must be owner code letters (A-Z)", None

        if not cleaned[4:].isdigit():
            return False, "Last 7 characters must be digits (0-9)", None

        calculated_check = ContainerOCREngine.calculate_iso_check_digit(cleaned[:10])
        if calculated_check is None:
            return False, "Failed to compute check digit", None

        actual_check = int(cleaned[10])
        if calculated_check == actual_check:
            return True, "Valid ISO 6346 container code and check digit", calculated_check
        else:
            return False, f"Check digit mismatch: expected {calculated_check}, got {actual_check}", calculated_check

    def preprocess_image(self, img_bgr: np.ndarray) -> List[np.ndarray]:
        """
        Apply computer vision preprocessing variations to optimize OCR text legibility.
        """
        variants = []
        # Variant 1: Original BGR
        variants.append(img_bgr)

        # Variant 2: Grayscale + CLAHE contrast enhancement
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced_gray = clahe.apply(gray)
        variants.append(enhanced_gray)

        # Variant 3: Adaptive Gaussian thresholding (binarization)
        thresh = cv2.adaptiveThreshold(
            enhanced_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 4
        )
        variants.append(thresh)

        return variants

    def extract_and_validate(
        self,
        image_input: Union[str, np.ndarray, Image.Image]
    ) -> Dict[str, Any]:
        """
        Perform OCR on container image crop and execute ISO 6346 validation.
        """
        # Convert to numpy array
        if isinstance(image_input, str):
            img_bgr = cv2.imread(image_input)
        elif isinstance(image_input, Image.Image):
            img_bgr = cv2.cvtColor(np.array(image_input), cv2.COLOR_RGB2BGR)
        elif isinstance(image_input, np.ndarray):
            img_bgr = image_input
        else:
            raise TypeError("Unsupported image input type for OCR")

        if img_bgr is None or img_bgr.size == 0:
            return {
                "raw_text": "",
                "candidate_code": None,
                "validated_code": None,
                "is_valid": False,
                "confidence": 0.0,
                "message": "Empty or invalid image input",
                "all_detected_texts": [],
            }

        all_detected_texts: List[str] = []
        best_candidate: Optional[str] = None
        best_conf: float = 0.0

        if self.reader is not None:
            preprocessed_variants = self.preprocess_image(img_bgr)

            for var in preprocessed_variants:
                try:
                    results = self.reader.readtext(var)
                    for (bbox, text, conf) in results:
                        cleaned_str = text.strip()
                        if cleaned_str and cleaned_str not in all_detected_texts:
                            all_detected_texts.append(cleaned_str)

                        # Match ISO pattern (e.g., MSCU 782910 4 or MSCU7829104)
                        matches = ContainerOCREngine.ISO_REGEX.findall(cleaned_str.upper())
                        for m in matches:
                            m_clean = re.sub(r"\s+", "", m)
                            if len(m_clean) == 11:
                                if conf > best_conf:
                                    best_candidate = m_clean
                                    best_conf = float(conf)
                except Exception as e:
                    print(f"OCR reading pass error: {e}")

                if best_candidate is not None and best_conf > 0.85:
                    break

        # If no regex match found from single line, try joining all detected tokens
        if not best_candidate and all_detected_texts:
            joined = "".join(re.sub(r"[^A-Za-z0-9]", "", t.upper()) for t in all_detected_texts)
            for i in range(len(joined) - 10):
                sub = joined[i:i+11]
                if sub[:4].isalpha() and sub[4:].isdigit():
                    best_candidate = sub
                    best_conf = 0.75
                    break

        raw_text_summary = " | ".join(all_detected_texts) if all_detected_texts else (best_candidate or "")

        # Run ISO 6346 check digit validation
        if best_candidate:
            is_valid, reason, expected_check = self.validate_iso_6346(best_candidate)
            return {
                "raw_text": raw_text_summary,
                "candidate_code": best_candidate,
                "validated_code": best_candidate if is_valid else None,
                "is_valid": is_valid,
                "confidence": round(best_conf, 3),
                "message": reason,
                "expected_check_digit": expected_check,
                "all_detected_texts": all_detected_texts,
            }
        else:
            return {
                "raw_text": raw_text_summary,
                "candidate_code": None,
                "validated_code": None,
                "is_valid": False,
                "confidence": 0.0,
                "message": "No valid 11-character container identifier detected",
                "all_detected_texts": all_detected_texts,
            }


# Global instance
ocr_engine = ContainerOCREngine()
