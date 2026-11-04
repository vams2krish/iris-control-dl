import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("public/wasm", { recursive: true });
await mkdir("public/models", { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  await copyFile(`node_modules/@mediapipe/tasks-vision/wasm/${file}`, `public/wasm/${file}`);
}
const url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const response = await fetch(url); if (!response.ok) throw new Error(`Model download: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash("sha256").update(bytes).digest("hex") !== "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff") throw new Error("Model checksum mismatch");
await writeFile("public/models/face_landmarker.task", bytes);
console.log(`Model prepared locally (${bytes.length} bytes), SHA256 ${createHash("sha256").update(bytes).digest("hex")}`);
