"""
Model weights downloader for EasyOCR and Ultralytics YOLOv8.
Handles zip extraction and SSL bypass for local developer environment.
"""
import io
import os
import zipfile
import httpx

EASYOCR_DIR = os.path.join(os.path.expanduser("~"), ".EasyOCR", "model")
YOLO_DIR = os.path.join(os.path.expanduser("~"), ".config", "Ultralytics")
LOCAL_YOLO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "yolov8n.pt")


def download_and_extract_zip(url: str, dest_dir: str, target_filename: str):
    target_path = os.path.join(dest_dir, target_filename)
    if os.path.exists(target_path) and os.path.getsize(target_path) > 1000000:
        print(f"Target file already exists: {target_path} ({os.path.getsize(target_path)} bytes)")
        return

    os.makedirs(dest_dir, exist_ok=True)
    print(f"Downloading ZIP: {url}...")
    with httpx.Client(verify=False, timeout=180.0, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
            z.extractall(dest_dir)
    print(f"Extracted to: {dest_dir}")


def download_file(url: str, dest_path: str):
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000000:
        print(f"File already exists: {dest_path} ({os.path.getsize(dest_path)} bytes)")
        return

    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    print(f"Downloading {url} -> {dest_path}...")
    with httpx.Client(verify=False, timeout=180.0, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        with open(dest_path, "wb") as f:
            f.write(resp.content)
    print(f"Saved: {dest_path} ({os.path.getsize(dest_path)} bytes)")


def ensure_all_models():
    os.makedirs(EASYOCR_DIR, exist_ok=True)

    # 1. EasyOCR CRAFT detection model
    craft_zip_url = "https://github.com/JaidedAI/EasyOCR/releases/download/pre-v1.1.6/craft_mlt_25k.zip"
    download_and_extract_zip(craft_zip_url, EASYOCR_DIR, "craft_mlt_25k.pth")

    # 2. EasyOCR English recognition model
    english_zip_url = "https://github.com/JaidedAI/EasyOCR/releases/download/v1.3/english_g2.zip"
    download_and_extract_zip(english_zip_url, EASYOCR_DIR, "english_g2.pth")

    # 3. YOLOv8n pretrained weights
    yolo_url = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.pt"
    download_file(yolo_url, LOCAL_YOLO_PATH)
    if os.path.exists(LOCAL_YOLO_PATH):
        # Also copy to root backend working directory
        import shutil
        root_yolo = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "yolov8n.pt")
        shutil.copyfile(LOCAL_YOLO_PATH, root_yolo)


if __name__ == "__main__":
    ensure_all_models()
