"""Verify the packaged Android permission boundary, including dependency manifests."""
from pathlib import Path
import os
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
sdk = Path(os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT", ""))
tool = sdk / "build-tools/36.0.0" / ("aapt.exe" if os.name == "nt" else "aapt")
apk = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "android/app/build/outputs/apk/debug/app-debug.apk"
permissions = subprocess.check_output([str(tool), "dump", "permissions", str(apk)], text=True)
for permission in ("android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE"):
    if f"name='{permission}'" in permissions:
        raise SystemExit(f"Offline boundary failed: packaged APK includes {permission}")
if "name='android.permission.CAMERA'" not in permissions:
    raise SystemExit("Camera permission is missing")
print("APK permission check passed: camera available; no INTERNET or ACCESS_NETWORK_STATE")
