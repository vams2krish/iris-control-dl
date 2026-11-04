"use strict";
const { performance } = require("node:perf_hooks");

const LABELS = ["Pause", "Cursor", "Scroll", "Double", "Right", "Drag", "Keyboard", "Back", "Next tab", "Apps"];
function validFrame(f, wallNow = Date.now()) {
  return f && Number.isInteger(f.sequence) && f.sequence >= 0 &&
    Number.isFinite(f.sentAt) && wallNow - f.sentAt >= -100 && wallNow - f.sentAt <= 300 &&
    [f.x, f.y, f.confidence].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1) && typeof f.closed === "boolean";
}
function toolbar(bounds) {
  const width = Math.min(1000, Math.floor(bounds.width * .94));
  return { x: bounds.x + Math.floor((bounds.width - width) / 2), y: bounds.y + 12, width, height: 54 };
}
/** Pure state machine. No OS access: all generated commands go through the native helper. */
class DesktopController {
  constructor(send, clock = () => performance.now()) {
    this.send = send; this.clock = clock;
    this.bounds = null; this.calibrated = false; this.armed = false; this.emergency = false;
    this.mode = "cursor"; this.dragging = false; this.lastSequence = -1; this.lastFrame = 0;
    this.anchor = null; this.since = 0; this.fired = false; this.closedAt = null; this.firstBlink = null;
    this.lastAction = -Infinity; this.readyAt = 0; this.dwellMs = 1200; this.lockRadius = .04; this.escapeAt = null;
  }
  attach(bounds) { this.bounds = bounds; this.pause(); }
  snapshot() { return { connected: !!this.bounds, calibrated: this.calibrated, armed: this.armed, emergency: this.emergency, mode: this.mode, dragging: this.dragging, dwellMs: this.dwellMs, lockRadius: this.lockRadius }; }
  configure(value) {
    const dwell = typeof value === "number" ? value : value?.dwellMs;
    if (Number.isFinite(dwell)) this.dwellMs = Math.max(700, Math.min(2500, Math.round(dwell)));
    if (typeof value === "object" && Number.isFinite(value?.lockRadius)) this.lockRadius = Math.max(.015, Math.min(.08, value.lockRadius));
    this.resetFixation();
  }
  resetFixation() { this.anchor = null; this.since = 0; this.fired = false; this.closedAt = null; this.firstBlink = null; this.escapeAt = null; }
  pause(emergency = false) {
    this.armed = false; this.emergency = emergency; this.dragging = false; this.resetFixation();
    this.send("STATE 0");
  }
  arm() {
    if (!this.bounds || !this.calibrated) throw new Error("Complete desktop calibration first");
    this.emergency = false; this.armed = true; this.readyAt = this.clock() + 3000;
    this.resetFixation(); this.send("STATE 0"); // native injection starts only after fresh frames + countdown
  }
  invalidate() { this.calibrated = false; this.pause(); }
  watchdog() { if (this.clock() - this.lastFrame > 500) { this.resetFixation(); this.dragging = false; this.send("STATE 0"); this.send("HIDE"); } }
  action(command, now) {
    if (!this.armed || now < this.readyAt || now - this.lastAction < 900) return false;
    this.lastAction = now; this.send(command); return true;
  }
  frame(f, wallNow) {
    const now = this.clock();
    if (!validFrame(f, wallNow) || f.sequence <= this.lastSequence) return false;
    this.lastSequence = f.sequence; this.lastFrame = now;
    if (!this.bounds || !this.calibrated || f.confidence < .65) {
      this.resetFixation(); this.dragging = false; this.send("STATE 0"); this.send("HIDE"); return false;
    }
    this.send("HEARTBEAT");
    const b = this.bounds, x = b.x + Math.round(f.x * (b.width - 1)), y = b.y + Math.round(f.y * (b.height - 1));
    const bar = toolbar(b), slot = x >= bar.x && x < bar.x + bar.width && y >= bar.y && y < bar.y + bar.height ? Math.floor((x - bar.x) * LABELS.length / bar.width) : -1;
    const live = this.armed && now >= this.readyAt;
    this.send(`STATE ${live ? 1 : 0}`);
    if (f.closed) {
      if (this.closedAt === null) this.closedAt = now;
      if (now - this.closedAt > 2200) { this.dragging = false; this.send("STATE 0"); this.send("HIDE"); this.anchor = null; return true; }
      this.anchor = null; this.send(`DRAW ${x} ${y} 0 ${live ? 1 : 0} ${this.mode} ${this.dragging ? 1 : 0}`); return true;
    }
    const closedMs = this.closedAt === null ? 0 : now - this.closedAt; this.closedAt = null;
    if (live && slot < 0) {
      if (closedMs >= 850 && closedMs < 2200) { this.firstBlink = null; this.action("LONG", now); }
      else if (closedMs >= 180 && closedMs <= 450) {
        if (this.firstBlink !== null && now - this.firstBlink <= 500 + closedMs) { this.firstBlink = null; this.action("DOUBLE", now); }
        else this.firstBlink = now;
      }
    }
    if (this.firstBlink !== null && now - this.firstBlink > 950) this.firstBlink = null;
    if ((!live && (slot !== 0 || this.emergency || !this.armed && !this.calibrated)) || this.armed && !live) {
      this.anchor = null; this.send(`DRAW ${x} ${y} 0 0 ${this.mode} 0`); return true;
    }
    const key = slot >= 0 ? `toolbar:${slot}` : this.mode === "scroll" ? (f.y < .25 ? "up" : f.y > .75 ? "down" : "center") : "point";
    let outside = false;
    let moved = !this.anchor || this.anchor.key !== key;
    if (!moved && Math.hypot(x - this.anchor.x, y - this.anchor.y) > Math.max(20, b.width * this.lockRadius)) {
      outside = true;
      if (this.escapeAt === null) this.escapeAt = now;
      // Brief outliers no longer throw away the fixation. Intentional movement rearms.
      if (now - this.escapeAt >= 160) moved = true;
    } else this.escapeAt = null;
    if (moved) { this.anchor = { x, y, key }; this.since = now; this.fired = false; this.escapeAt = null; outside = false; }
    // First let the gaze settle, then pin the physical pointer AND dwell ring to the
    // same target. Otherwise eye jitter keeps moving the point that will be clicked.
    if (now - this.since < 250 && !outside) { this.anchor.x += .4 * (x - this.anchor.x); this.anchor.y += .4 * (y - this.anchor.y); }
    const locked = now - this.since >= 250 && !(this.dragging && this.fired);
    const outputX = locked && slot < 0 ? Math.round(this.anchor.x) : x;
    const outputY = locked && slot < 0 ? Math.round(this.anchor.y) : y;
    if (live && slot < 0) this.send(`MOVE ${outputX} ${outputY}`);
    const duration = slot >= 0 ? Math.max(1500, this.dwellMs) : this.dwellMs;
    const progress = Math.min(1, (now - this.since) / duration);
    this.send(`DRAW ${outputX} ${outputY} ${progress.toFixed(3)} ${live ? 1 : 0} ${this.mode} ${this.dragging ? 1 : 0}`);
    if (progress < 1 || this.fired || outside) return true;
    this.fired = true;
    if (slot >= 0) {
      if (slot === 0) { if (this.armed) this.pause(); else this.arm(); return true; }
      if (!live) return true;
      if (slot >= 1 && slot <= 5) {
        if (this.dragging) { this.action("UP", now); this.dragging = false; }
        this.mode = { 1: "cursor", 2: "scroll", 3: "double", 4: "right", 5: "drag" }[slot];
        this.resetFixation(); return true;
      }
      this.action({ 6: "KEYBOARD", 7: "BACK", 8: "NEXTTAB", 9: "APPS" }[slot], now);
    } else if (this.mode === "scroll") {
      if (key !== "center") { this.action(key === "up" ? "SCROLL 120" : "SCROLL -120", now); this.since = now; this.fired = false; }
    } else if (this.mode === "drag") {
      if (this.action(this.dragging ? "UP" : "DOWN", now)) { this.dragging = !this.dragging; if (!this.dragging) this.mode = "cursor"; }
    } else if (!this.dragging) {
      if (this.action(this.mode === "right" ? "RIGHT" : this.mode === "double" ? "DOUBLE" : "CLICK", now)) this.mode = "cursor";
    }
    return true;
  }
}
module.exports = { DesktopController, validFrame, toolbar, LABELS };
