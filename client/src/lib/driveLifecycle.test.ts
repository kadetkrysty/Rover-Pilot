import test from "node:test";
import assert from "node:assert/strict";
import { shouldActivateAfterArm } from "./driveLifecycle";

test("a pending arm cannot restore local engagement after blur or stop invalidates its epoch", () => {
  assert.equal(shouldActivateAfterArm(7, 8, true), false);
  assert.equal(shouldActivateAfterArm(7, 7, true), false);
  assert.equal(shouldActivateAfterArm(7, 7, false), true);
});
