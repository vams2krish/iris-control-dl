const fs = require("node:fs"), path = require("node:path");
const source = path.resolve(__dirname, "../../web/out");
if (!fs.existsSync(path.join(source, "index.html")) || !fs.existsSync(path.join(source, "models/face_landmarker.task"))) throw new Error("Build web and prepare local model assets before packaging");
fs.cpSync(source, path.resolve(__dirname, "../web"), { recursive: true });
console.log("Copied built web UI and local inference assets");
