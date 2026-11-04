import { test } from "node:test";
import assert from "node:assert/strict";
import { fit, map, targets, validProfile, readFace } from "../lib/gaze";
test("calibration recovers a known screen mapping", () => {
  const p = fit(targets.map(target => ({ features: [target.x, target.y, 0, 0], target })));
  const result = map(p, [.4, .6, 0, 0]);
  assert.ok(Math.abs(result.x - .4) < .01); assert.ok(Math.abs(result.y - .6) < .01);
});
test("calibration rejects missing or invalid samples", () => { assert.throws(() => fit([])); assert.throws(() => fit(targets.map(target => ({ target, features: [NaN, 0, 0, 0] })))); });
test("saved profiles reject corrupted storage", () => {
  assert.equal(validProfile({ x: [0], y: [0] }), false);
  assert.equal(validProfile({ x: [0, 1, 0, NaN, 0], y: [0, 0, 1, 0, 0] }), false);
  assert.equal(validProfile({ x: [0, 1, 0, 0, 0], y: [0, 0, 1, 0, 0] }), true);
});
test("missing iris landmarks cannot create a gaze observation", () => { assert.equal(readFace([]), null); });
test("stationary eye features cannot create a usable calibration", () => { assert.throws(() => fit(targets.map(target => ({ target, features: [.5, .5, 0, 0] })))); });
