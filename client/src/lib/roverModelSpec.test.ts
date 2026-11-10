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

test("internal hardware has distinct selectable identities and approximate placement metadata", () => {
  const { internalHardware, body } = ROVER_MODEL_SPEC;
  const components = internalHardware.components;
  const ids = components.map((component) => component.id);
  assert.deepEqual(ids, ["mini-pc", "mega-2560", "mpu6050", "feru-foc", "battery-bms", "wiring"]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(internalHardware.placementEvidence, "concept-estimate");
  assert.equal(internalHardware.dimensionsEvidence, "concept-estimate");

  for (const component of components) {
    assert.ok(component.role.length > 0);
    assert.ok(component.connections.length > 0);
    assert.ok(component.placementMm.fromFrontMm >= 0);
    assert.ok(component.placementMm.fromFrontMm <= body.lengthMm);
    assert.ok(
      Math.abs(component.placementMm.lateralMm) + component.visualEnvelopeMm[1] / 2 <= body.widthMm / 2,
      `${component.id} display envelope fits within the approximate body width`,
    );
    assert.ok(
      component.placementMm.fromFrontMm - component.visualEnvelopeMm[0] / 2 >= 0,
      `${component.id} display envelope starts within the approximate body length`,
    );
    assert.ok(
      component.placementMm.fromFrontMm + component.visualEnvelopeMm[0] / 2 <= body.lengthMm,
      `${component.id} display envelope fits within the approximate body length`,
    );
    assert.ok(
      component.placementMm.aboveGroundMm - component.visualEnvelopeMm[2] / 2 >= body.baseAboveGroundMm + body.heightMm,
      `${component.id} is visibly exploded above the body roof`,
    );
    for (const connection of component.connections) {
      assert.ok(ids.includes(connection.targetId), `${component.id} connects to known ${connection.targetId}`);
      assert.match(connection.label, /conceptual/i);
    }
  }
});
