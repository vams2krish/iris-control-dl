"""Build shareable preview assets; exclude all Chromium profiles/runtime state."""
from pathlib import Path
import hashlib
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
output = root / "release-assets"
output.mkdir(exist_ok=True)
bundle = root / "desktop/release/IrisControl-0.2.0-win32-x64"
archive = output / "iris-control-windows-0.2.0-x64.zip"
excluded = {".runtime", "iris-runtime", "node_modules", "startup.log"}
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, strict_timestamps=False) as z:
    for file in sorted(bundle.rglob("*")):
        relative = file.relative_to(bundle)
        if file.is_file() and not any(part in excluded for part in relative.parts):
            z.write(file, str(Path(bundle.name) / relative))
with zipfile.ZipFile(archive) as z:
    if any(any(part in excluded for part in Path(name).parts) for name in z.namelist()):
        raise SystemExit("Runtime files unexpectedly included")
apk = output / "iris-control-android-0.1.1.apk"
shutil.copyfile(root / "android/app/build/outputs/apk/debug/app-debug.apk", apk)
licenses = output / "third-party-licenses.zip"
with zipfile.ZipFile(licenses, "w", compression=zipfile.ZIP_DEFLATED, strict_timestamps=False) as z:
    z.write(root / "LICENSE", "Iris-Control-LICENSE.txt")
    z.write(root / "THIRD_PARTY_NOTICES.md", "THIRD_PARTY_NOTICES.md")
    z.write(root / "licenses/Apache-2.0.txt", "Apache-2.0.txt")
    for base in (root / "web/node_modules", root / "desktop/node_modules"):
        for file in base.rglob("*"):
            if file.is_file() and (file.name.upper().startswith("LICENSE") or file.name.upper().startswith("COPYING")):
                z.write(file, str(file.relative_to(root)))
lines = []
for file in (archive, apk, licenses):
    with file.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    lines.append(f"{digest}  {file.name}")
    print(f"Prepared {file.name} ({file.stat().st_size:,} bytes)")
(output / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
