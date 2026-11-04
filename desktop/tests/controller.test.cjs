const { test } = require("node:test"), assert = require("node:assert/strict");
const { DesktopController, validFrame, toolbar } = require("../controller.cjs");
function setup() {
  let now = 0, sequence = 0; const commands = [];
  const c = new DesktopController(command => commands.push(command), () => now);
  c.attach({ x: 0, y: 0, width: 1920, height: 1080 }); c.calibrated = true;
  const frame = (x = .5, y = .5, confidence = .9, closed = false) => c.frame({ x, y, confidence, closed, sequence: ++sequence, sentAt: 10000 }, 10000);
  return { c, commands, frame, time: n => { now = n; } };
}
test("stale, non-finite and out-of-range IPC frames are rejected", () => {
  const f = { x: .5, y: .5, confidence: .9, closed: false, sequence: 1, sentAt: 1000 };
  assert.equal(validFrame(f, 1500), false);
  assert.equal(validFrame({ ...f, x: NaN }, 1000), false);
  assert.equal(validFrame({ ...f, x: 1.2 }, 1000), false);
  assert.equal(validFrame(f, 1000), true);
});
test("no OS actions while paused and a 3-second startup delay", () => {
  const { c, commands, frame, time } = setup(); frame(); time(2000); frame();
  assert.equal(commands.some(x => x.startsWith("MOVE") || x === "CLICK"), false);
  c.arm(); time(4000); frame(); assert.equal(commands.includes("STATE 1"), false);
  time(5100); frame(); assert.ok(commands.includes("MOVE 960 540"));
});
test("dwell fires once per fixation, then rearms after gaze moves", () => {
  const { c, commands, frame, time } = setup(); c.arm(); time(3100); frame(); time(4400); frame(); time(6500); frame();
  assert.equal(commands.filter(x => x === "CLICK").length, 1);
  time(6600); frame(.7); time(8000); frame(.7); assert.equal(commands.filter(x => x === "CLICK").length, 2);
});
test("face loss and stale watchdog release held input and cancel dwell", () => {
  const { c, commands, frame, time } = setup(); c.arm(); time(3100); frame(); time(4100); frame(.5,.5,0);
  assert.equal(commands.at(-1), "HIDE"); time(4200); frame(); assert.equal(commands.includes("CLICK"), false);
  time(5000); c.watchdog(); assert.deepEqual(commands.slice(-2), ["STATE 0", "HIDE"]);
});
test("toolbar pause consumes the fixation without clicking through", () => {
  const { c, commands, frame, time } = setup(); c.arm(); const bar = toolbar(c.bounds);
  const x = (bar.x + bar.width / 20) / 1919, y = (bar.y + 25) / 1079;
  time(3100); frame(x,y); time(4700); frame(x,y); assert.equal(c.armed, false); assert.equal(commands.includes("CLICK"), false);
});
test("emergency pause cannot resume from gaze", () => {
  const { c, frame, time } = setup(); c.pause(true); const bar = toolbar(c.bounds);
  const x = (bar.x + bar.width / 20) / 1919, y = (bar.y + 25) / 1079;
  time(1000); frame(x,y); time(3000); frame(x,y); assert.equal(c.armed, false);
});
test("deliberate double blink emits double click; natural blink does not", () => {
  const { c, frame, time, commands } = setup(); c.arm();
  time(3100); frame(.5,.5,.9,true); time(3180); frame(); assert.equal(commands.includes("DOUBLE"), false);
  time(4000); frame(.5,.5,.9,true); time(4250); frame(); time(4400); frame(.5,.5,.9,true); time(4650); frame();
  assert.equal(commands.filter(x => x === "DOUBLE").length, 1);
});
test("cannot arm without native helper and current desktop calibration", () => {
  const c = new DesktopController(() => {}); assert.throws(() => c.arm()); c.attach({x:0,y:0,width:1920,height:1080}); assert.throws(() => c.arm());
});
test("right-click mode acts on the next application target, never under the toolbar", () => {
  const { c, commands, frame, time } = setup(); c.arm(); const b = toolbar(c.bounds);
  const x = (b.x + b.width * .45) / 1919, y = (b.y + 25) / 1079;
  time(3100); frame(x,y); time(4700); frame(x,y); assert.equal(c.mode,"right"); assert.equal(commands.includes("RIGHT"),false);
  time(4800); frame(.3,.6); time(6100); frame(.3,.6); assert.ok(commands.includes("RIGHT")); assert.equal(c.mode,"cursor");
});
test("drag mode presses at the source and releases after a new destination dwell", () => {
  const { c, commands, frame, time } = setup(); c.arm(); c.mode="drag";
  time(3100); frame(.3,.5); time(4400); frame(.3,.5); assert.equal(c.dragging,true); assert.ok(commands.includes("DOWN"));
  time(4500); frame(.7,.5); time(5800); frame(.7,.5); assert.equal(c.dragging,false); assert.ok(commands.includes("UP")); assert.equal(c.mode,"cursor");
});
