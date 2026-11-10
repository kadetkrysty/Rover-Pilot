import test from "node:test";
import assert from "node:assert/strict";
import {
  hasConfirmedDriveLease,
  pageForDriveSource,
  shouldActivateAfterArm,
} from "./driveLifecycle";
import { unavailableDriveStatus, type DriveStatus } from "@shared/drive";

test("a pending arm cannot restore local engagement after blur or stop invalidates its epoch", () => {
  assert.equal(shouldActivateAfterArm(7, 8, true), false);
  assert.equal(shouldActivateAfterArm(7, 7, true), false);
  assert.equal(shouldActivateAfterArm(7, 7, false), true);
});

test("automatic navigation requires a confirmed, owned, commissioned drive lease", () => {
  const armedStatus: DriveStatus = {
    ...unavailableDriveStatus(),
    available: true,
    commissioned: true,
    serialConnected: true,
    firmwareReady: true,
    canDrive: true,
    source: "gamepad",
    armed: true,
    owned: true,
    lease: "00000000-0000-4000-8000-000000000001",
  };

  assert.equal(hasConfirmedDriveLease(armedStatus, "gamepad"), true);
  assert.equal(hasConfirmedDriveLease(armedStatus, "flysky"), false);
  assert.equal(hasConfirmedDriveLease({ ...armedStatus, owned: false }, "gamepad"), false);
  assert.equal(hasConfirmedDriveLease({ ...armedStatus, lease: null }, "gamepad"), false);
  assert.equal(hasConfirmedDriveLease({ ...armedStatus, estop: true }, "gamepad"), false);
  assert.equal(hasConfirmedDriveLease({ ...armedStatus, commissioned: false }, "gamepad"), false);
  assert.equal(hasConfirmedDriveLease({ ...armedStatus, serialConnected: false }, "gamepad"), false);
  assert.equal(hasConfirmedDriveLease({ ...armedStatus, firmwareReady: false }, "gamepad"), false);
});

test("each drive source opens its matching operator page", () => {
  assert.equal(pageForDriveSource("joystick"), "/");
  assert.equal(pageForDriveSource("gamepad"), "/gamepad");
  assert.equal(pageForDriveSource("flysky"), "/flysky");
});
