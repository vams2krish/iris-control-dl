// Electron's manual distribution layout: runtime + resources/app, no installer or signing.
const fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, ".."), target = path.join(root, "release/IrisControl-0.2.0-win32-x64");
fs.mkdirSync(target, { recursive: true });
fs.cpSync(path.join(root, "node_modules/electron/dist"), target, { recursive: true });
const app = path.join(target, "resources/app"); fs.mkdirSync(app, { recursive: true });
for (const file of ["main.cjs", "preload.cjs", "controller.cjs", "static-server.cjs", "web", "native/bin"]) fs.cpSync(path.join(root, file), path.join(app, file), { recursive: true });
fs.copyFileSync(path.resolve(root,"../LICENSE"),path.join(app,"LICENSE"));
fs.copyFileSync(path.resolve(root,"../THIRD_PARTY_NOTICES.md"),path.join(app,"THIRD_PARTY_NOTICES.md"));
fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "iris-control-desktop", version: "0.2.0", main: "main.cjs" }, null, 2));
const executable = path.join(target, "electron.exe");
fs.renameSync(executable, path.join(target, "IrisControl.exe"));
console.log(`Portable app: ${path.join(target, "IrisControl.exe")}`);
