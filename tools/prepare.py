"""Download pinned local inference assets. Run before builds; no runtime networking."""
from pathlib import Path
from urllib.request import urlopen
import hashlib

ROOT = Path(__file__).resolve().parents[1]
URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"
target = ROOT / "android/app/src/main/assets/face_landmarker.task"
data = urlopen(URL, timeout=90).read()
if hashlib.sha256(data).hexdigest() != SHA256:
    raise SystemExit("Model checksum mismatch; do not use these bytes")
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(data)
print(f"Verified Android model: {len(data)} bytes")
