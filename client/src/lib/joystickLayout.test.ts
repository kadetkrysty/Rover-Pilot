import test from "node:test";
import assert from "node:assert/strict";
import { fitJoystick } from "./joystickLayout";

test("fits wide, short NAV panels using height, including the direction labels", () => {
  const result = fitJoystick(320, 150, "90%");
  assert.equal(result.outerSize, 135);
  assert.equal(result.diameter + result.labelOffset * 2, result.outerSize);
  assert.ok(result.outerSize <= 150);
});

test("fits tall, narrow panels using width and preserves a square footprint", () => {
  assert.equal(fitJoystick(180, 400, "95%").outerSize, 171);
});

test("numeric sizes remain bounded and include label space", () => {
  assert.equal(fitJoystick(500, 500, 192).outerSize, 228);
  assert.equal(fitJoystick(90, 60, 192).outerSize, 60);
});

test("labels and circle shrink together for small panels", () => {
  for (const edge of [0, 10, 36, 80, 120, 250, 500]) {
    const result = fitJoystick(edge, edge, "100%");
    assert.ok(result.diameter >= 0);
    assert.ok(result.outerSize <= edge);
    assert.ok(result.labelOffset >= 0 && result.labelOffset <= 18);
    assert.ok(Math.abs(result.diameter + result.labelOffset * 2 - edge) < 0.001);
  }
});

test("recomputes fitting after orientation and height changes", () => {
  assert.equal(fitJoystick(400, 160, "90%").outerSize, 144);
  assert.equal(fitJoystick(160, 400, "90%").outerSize, 144);
  assert.equal(fitJoystick(400, 320, "90%").outerSize, 288);
});

test("invalid dimensions and oversized percentages cannot overflow the slot", () => {
  assert.equal(fitJoystick(NaN, 200, "90%").outerSize, 0);
  assert.equal(fitJoystick(-10, 200, "90%").outerSize, 0);
  assert.equal(fitJoystick(100, 80, "200%").outerSize, 80);
});
