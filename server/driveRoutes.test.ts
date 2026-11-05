import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import type { Server } from "node:http";
import { registerDriveRoutes, DriveBridgeError } from "./driveRoutes";
import { unavailableDriveStatus } from "../shared/drive";
import type { RoverClientRole } from "./clientAuth";

let server: Server, origin: string;
let calls: Record<string, unknown>[] = [];
let failure = false;
before(async () => {
  const app = express();
  app.use(express.json());
  registerDriveRoutes(app, async (req, res) => {
    const role = req.headers["x-test-role"] as RoverClientRole | undefined;
    if (!role) { res.status(401).json({ error: "Pair first." }); return null; }
    return { id: "authenticated-device", name: "Test client", role };
  }, async (body) => {
    calls.push(body);
    if (failure) throw new DriveBridgeError("Hardware unavailable.", 503);
    return { ...unavailableDriveStatus(), available: true, source: "joystick", commissioned: true,
      serialConnected: true, firmwareReady: true, owned: true, reason: "Stopped." };
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => new Promise<void>(resolve => server.close(() => resolve())));
const post = (body: unknown, role = "operator") => fetch(`${origin}/api/drive/action`, {
  method: "POST", headers: { "content-type": "application/json", "x-test-role": role }, body: JSON.stringify(body),
});

test("unpaired status reads are rejected", async () => {
  assert.equal((await fetch(`${origin}/api/drive/status`)).status, 401);
});
test("viewers cannot arm or drive", async () => {
  assert.equal((await post({ action: "arm", neutral: true }, "viewer")).status, 403);
});
test("source selection injects authenticated identity, never a submitted identity", async () => {
  calls = [];
  const result = await post({ action: "select", source: "gamepad" });
  assert.equal(result.status, 200);
  assert.deepEqual(calls[0], { action: "select", source: "gamepad", owner: "authenticated-device" });
  assert.equal((await post({ action: "select", source: "joystick", owner: "forged" })).status, 400);
});
test("arming requires an explicit neutral confirmation", async () => {
  for (const body of [{ action: "arm" }, { action: "arm", neutral: false }]) {
    assert.equal((await post(body)).status, 400);
  }
});
test("only owners may reset the latched E-STOP", async () => {
  assert.equal((await post({ action: "reset" }, "operator")).status, 403);
  assert.equal((await post({ action: "reset" }, "owner")).status, 200);
});
test("viewers can see state but not become drivers", async () => {
  const result = await fetch(`${origin}/api/drive/status`, { headers: { "x-test-role": "viewer" } });
  const data = await result.json();
  assert.equal(data.canDrive, false);
  assert.equal(data.canReset, false);
});
test("invalid source, frame range, stale lease shape and extra fields fail validation", async () => {
  for (const body of [
    { action: "select", source: "autonomous" },
    { action: "arm", neutral: true, command: "MOVE:1000,0" },
    { action: "frame", source: "joystick", lease: "x", sequence: 1, throttle: 1, steering: 0 },
    { action: "frame", source: "joystick", lease: "f37695a6-ceaa-4081-8a5a-9ffb10b0efa1", sequence: 1, throttle: 1.1, steering: 0 },
  ]) assert.equal((await post(body)).status, 400);
});
test("fast drive frames are rate limited but emergency stops are not", async () => {
  const body = { action: "frame", source: "joystick", lease: "f37695a6-ceaa-4081-8a5a-9ffb10b0efa1", sequence: 1, throttle: 0, steering: 0 };
  assert.equal((await post(body)).status, 200);
  assert.equal((await post({ ...body, sequence: 2 })).status, 429);
  assert.equal((await post({ action: "estop" })).status, 200);
});
test("an unavailable controller does not acknowledge motion or invent telemetry", async () => {
  failure = true;
  try {
    const response = await post({ action: "arm", neutral: true });
    assert.equal(response.status, 503);
    const status = await fetch(`${origin}/api/drive/status`, { headers: { "x-test-role": "owner" } });
    const data = await status.json();
    assert.equal(data.available, false);
    assert.equal(data.armed, false);
    assert.equal(data.imu, null);
  } finally { failure = false; }
});
