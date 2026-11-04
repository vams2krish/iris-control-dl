const { app, BrowserWindow, ipcMain, session, dialog, screen, powerMonitor, shell } = require("electron");
const path = require("node:path"), fs = require("node:fs"), readline = require("node:readline"), { spawn } = require("node:child_process");
const { DesktopController } = require("./controller.cjs");
const { createStaticServer } = require("./static-server.cjs");

// Keep disposable Chromium files on the same drive as this checkout / portable app.
const runtime = process.env.IRIS_RUNTIME_DIR || (app.isPackaged ? path.join(path.dirname(app.getPath("exe")), "iris-runtime") : path.join(__dirname, ".runtime"));
fs.mkdirSync(runtime, { recursive: true });
app.setPath("userData", runtime);
app.setPath("sessionData", path.join(runtime, "session"));
app.commandLine.appendSwitch("disable-http-cache");
function log(message) { fs.appendFileSync(path.join(runtime, "startup.log"), new Date().toISOString() + " " + message + "\n"); }
let window, helper, server, origin, calibration = false, oldBounds, error = "", permissionGranted = false, quitting = false;
const controller = new DesktopController(line => {
  if (helper?.stdin.writable) helper.stdin.write(line + "\n");
});
function state() { return { ...controller.snapshot(), calibrating: calibration, error }; }
function notify() { if (window && !window.isDestroyed()) window.webContents.send("iris:state", state()); }
function trusted(event) { return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url.startsWith(origin + "/"); }
function handle(channel, callback) { ipcMain.handle(channel, (event, value) => { if (!trusted(event)) throw new Error("Untrusted desktop request"); return callback(value); }); }
function pause(emergency = false) { controller.pause(emergency); notify(); }
function openDocumentation(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && (url.hostname === "github.com" && url.pathname.startsWith("/vams2krish/iris-control-dl") || url.hostname === "support.apple.com")) void shell.openExternal(url.href);
  } catch { /* External navigation never enters the privileged app renderer. */ }
}
function endCalibration() {
  calibration = false;
  if (window && !window.isDestroyed()) { window.setFullScreen(false); if (oldBounds) window.setBounds(oldBounds); }
}
async function start() {
  if (process.platform !== "win32") throw new Error("The native desktop controller requires Windows 10 or 11 x64");
  const helperPath = path.join(__dirname, "native/bin/IrisInput.exe");
  if (!fs.existsSync(helperPath)) throw new Error("Build the native helper: npm run build:native");
  const root = fs.existsSync(path.join(__dirname, "web/index.html")) ? path.join(__dirname, "web") : path.resolve(__dirname, "../web/out");
  if (!fs.existsSync(path.join(root, "index.html"))) throw new Error("Build the web UI first: cd web && npm run build");
  ({ server, origin } = await createStaticServer(root));
  log("Serving local UI " + origin);
  window = new BrowserWindow({ width: 1280, height: 900, title: "Iris Control · Windows", backgroundColor: "#f7f8fb",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, webSecurity: true, spellcheck: false } });
  window.removeMenu();
  helper = spawn(helperPath, [], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  window.webContents.on("did-fail-load", (_event, code, description) => log("UI load failed " + code + " " + description));
  window.webContents.on("render-process-gone", (_event, details) => log("Renderer stopped " + details.reason));
  helper.on("error", cause => { error = cause.message; controller.bounds = null; pause(true); });
  helper.on("exit", () => { controller.bounds = null; error = quitting ? "" : "Native input helper stopped. Restart the desktop app."; pause(true); });
  helper.stdin.on("error", () => { error = "Native helper connection lost"; controller.bounds = null; pause(true); });
  readline.createInterface({ input: helper.stdout }).on("line", line => {
    const p = line.split(" ");
    if (p[0] === "READY" && p.length === 5) {
      const [x, y, width, height] = p.slice(1).map(Number);
      if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) { controller.attach({ x, y, width, height }); notify(); }
    } else if (line === "EMERGENCY") { pause(true); }
    else if (line === "DISPLAY_CHANGED") { controller.invalidate(); error = "Display layout changed. Restart and recalibrate."; pause(true); }
    else if (line.startsWith("ERROR")) { error = line.slice(6).replaceAll("_", " "); pause(true); }
    else if (line === "STALE") { pause(true); error = "Tracking connection stalled. Enable actions again when ready."; notify(); }
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => permissionGranted && contents === window?.webContents && permission === "media" && requestingOrigin === origin);
  session.defaultSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (contents !== window?.webContents || permission !== "media" || !details.mediaTypes?.length || !details.mediaTypes.every(type => type === "video") || !contents.getURL().startsWith(origin + "/")) { callback(false); return; }
    if (!permissionGranted) {
      const answer = await dialog.showMessageBox(window, { type: "question", buttons: ["Use camera locally", "Cancel"], defaultId: 1, cancelId: 1, title: "Iris camera", message: "Use your front camera for on-device gaze tracking?", detail: "Frames stay in memory. Desktop input stays paused until you calibrate and enable actions." });
      permissionGranted = answer.response === 0;
    }
    callback(permissionGranted);
  });
  window.webContents.setWindowOpenHandler(({ url }) => { openDocumentation(url); return { action: "deny" }; });
  window.webContents.on("will-navigate", (event, url) => { if (url !== origin + "/") { event.preventDefault(); openDocumentation(url); } });
  window.webContents.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) { controller.invalidate(); notify(); } });
  window.webContents.on("render-process-gone", () => pause(true));
  window.webContents.on("unresponsive", () => pause(true));
  window.on("closed", () => app.quit());
  handle("iris:state", () => state());
  handle("iris:pause", () => { pause(); return state(); });
  handle("iris:arm", () => { if (calibration) throw new Error("Finish calibration first"); error = ""; controller.arm(); helper.stdin.write("RESET\n"); notify(); return state(); });
  handle("iris:configure", dwell => { controller.configure(dwell); notify(); return state(); });
  handle("iris:calibrate", () => {
    controller.invalidate(); helper.stdin.write("HIDE\n"); calibration = true; oldBounds = window.getBounds();
    window.setBounds(screen.getPrimaryDisplay().bounds); window.setFullScreen(true); window.focus(); notify(); return state();
  });
  handle("iris:calibrated", () => {
    if (!calibration || !window.isFullScreen()) throw new Error("Start full-screen desktop calibration first");
    controller.calibrated = true; endCalibration(); notify(); return state();
  });
  handle("iris:cancel-calibration", () => { controller.invalidate(); endCalibration(); notify(); return state(); });
  ipcMain.on("iris:frame", (event, frame) => { if (!trusted(event) || calibration) return; const before = `${controller.armed}:${controller.mode}:${controller.dragging}`; controller.frame(frame); if (before !== `${controller.armed}:${controller.mode}:${controller.dragging}`) notify(); });
  powerMonitor.on("suspend", () => pause(true));
  powerMonitor.on("lock-screen", () => pause(true));
  setInterval(() => controller.watchdog(), 200).unref();
  log("Loading interface");
  await window.loadURL(origin);
  log("Interface loaded");
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { window?.show(); window?.focus(); });
  app.whenReady().then(start).catch(async cause => { log("Startup failed " + cause.message); await dialog.showMessageBox({ type: "error", message: "Iris Control could not start", detail: cause.message }); app.quit(); });
}
app.on("before-quit", () => { quitting = true; controller.pause(); helper?.stdin.end("QUIT\n"); server?.close(); });
app.on("window-all-closed", () => app.quit());
