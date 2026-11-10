import assert from "node:assert/strict";
import test from "node:test";
import { getRoverModelPart, ROVER_MODEL_SPEC } from "./roverModelSpec";

test("concept body meets the user's confirmed minimum envelope", () => {
  const [minimumLength, minimumWidth, minimumHeight] = ROVER_MODEL_SPEC.minimumBodyEnvelopeMm;
  assert.ok(ROVER_MODEL_SPEC.body.lengthMm >= minimumLength);
  assert.ok(ROVER_MODEL_SPEC.body.widthMm >= minimumWidth);
  assert.ok(ROVER_MODEL_SPEC.body.heightMm >= minimumHeight);
});

test("six-wheel layout has three unique longitudinal stations on both sides", () => {
  const { wheels } = ROVER_MODEL_SPEC;
  assert.equal(wheels.count, 6);
  assert.equal(wheels.centerXMm.length * wheels.centerYMm.length, wheels.count);
  assert.equal(new Set(wheels.centerXMm).size, 3);
  assert.deepEqual(wheels.centerYMm, [-260, 260]);
});

test("major viewer parts have stable, unique identifiers", () => {
  const ids = ROVER_MODEL_SPEC.parts.map((part) => part.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.length >= 8);
  assert.equal(getRoverModelPart("camera-head")?.name, "Three-aperture camera head");
  assert.equal(getRoverModelPart("not-a-part"), undefined);
});

test("dimensions inferred from the render are marked as estimates, not confirmed facts", () => {
  assert.equal(ROVER_MODEL_SPEC.wheels.evidence, "concept-estimate");
  assert.equal(ROVER_MODEL_SPEC.mast.evidence, "concept-estimate");
  assert.equal(ROVER_MODEL_SPEC.body.evidence, "concept-estimate");
  assert.deepEqual(ROVER_MODEL_SPEC.minimumBodyEnvelopeMm, [600, 400, 200]);
});
