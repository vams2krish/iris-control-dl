const { contextBridge, ipcRenderer } = require("electron");
let sequence = 0;
contextBridge.exposeInMainWorld("irisDesktop", {
  snapshot: () => ipcRenderer.invoke("iris:state"),
  arm: () => ipcRenderer.invoke("iris:arm"),
  pause: () => ipcRenderer.invoke("iris:pause"),
  calibrate: () => ipcRenderer.invoke("iris:calibrate"),
  calibrated: () => ipcRenderer.invoke("iris:calibrated"),
  cancelCalibration: () => ipcRenderer.invoke("iris:cancel-calibration"),
  configure: (dwellMs) => ipcRenderer.invoke("iris:configure", dwellMs),
  frame: (frame) => ipcRenderer.send("iris:frame", { x: frame?.x, y: frame?.y, confidence: frame?.confidence, closed: frame?.closed, sequence: ++sequence, sentAt: Date.now() }),
  onState: (callback) => { const listener = (_event, state) => callback(state); ipcRenderer.on("iris:state", listener); return () => ipcRenderer.removeListener("iris:state", listener); }
});
