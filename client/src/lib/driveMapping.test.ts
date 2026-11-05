import test from "node:test";
import assert from "node:assert/strict";
import { isFlyskyArmReady, readGamepadDriveSample } from "./driveMapping";

test("maps standard left Y to forward/reverse and right X to steering", () => {
  const pad = {
    connected: true, mapping: "standard", axes: [0, -0.7, 0.35, 0],
    buttons: Array.from({ length: 8 }, (_, index) => ({ pressed: index === 5 })),
  } as unknown as Gamepad;
  assert.deepEqual(readGamepadDriveSample(pad), {
    connected: true, standard: true, throttle: 0.7, steering: 0.35, deadman: true, neutralAndReleased: false,
  });
});

test("refuses non-standard mappings and requires neutral sticks with R1 released", () => {
  const pad = {
    connected: true, mapping: "", axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 8 }, () => ({ pressed: false })),
  } as unknown as Gamepad;
  assert.equal(readGamepadDriveSample(pad).standard, false);
  const standard = { ...pad, mapping: "standard" } as Gamepad;
  assert.equal(readGamepadDriveSample(standard).neutralAndReleased, true);
});

test("FlySky requires fresh receiver, centered CH1/CH3, and high CH5 deadman", () => {
  const receiver = { connected: true, channels: [1500, 1100, 1510, 1500, 1950], ageMs: 100, failsafe: false };
  assert.equal(isFlyskyArmReady(receiver), true);
  assert.equal(isFlyskyArmReady({ ...receiver, failsafe: true }), false);
  assert.equal(isFlyskyArmReady({ ...receiver, ageMs: 501 }), false);
  assert.equal(isFlyskyArmReady({ ...receiver, channels: [1700, 1100, 1500, 1500, 1950] }), false);
});
