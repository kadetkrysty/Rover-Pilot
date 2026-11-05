import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerRecordingRoutes } from "./recordingRoutes";
import type { RecordingService } from "./recordings";
import type { RoverClientRole } from "./clientAuth";

test("recording APIs enforce pairing, roles and bounded transfer arguments", async () => {
  const calls: string[] = [];
  const service = {
    status: async () => ({ recordings: [], active: null }),
    start: async () => { calls.push("start"); return {}; },
    stop: async () => { calls.push("stop"); return {}; },
    delete: async () => { calls.push("delete"); },
    chunk: async () => { calls.push("chunk"); return {}; },
  } as unknown as RecordingService;
  const app = express();
  app.use(express.json());
  registerRecordingRoutes(app, async (req, res) => {
    const role = req.get("x-test-role") as RoverClientRole | undefined;
    if (!role) { res.status(401).end(); return null; }
    return { role, id: "client", name: "test" };
  }, service);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const request = (route: string, role?: string, method = "GET", body?: unknown) =>
    fetch(`http://127.0.0.1:${port}/api/recordings${route}`, {
      method, headers: { ...(role ? { "x-test-role": role } : {}), "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.equal((await request("")).status, 401);
    assert.equal((await request("", "rover")).status, 403);
    assert.equal((await request("", "viewer")).status, 200);
    assert.equal((await request("/start", "viewer", "POST")).status, 403);
    assert.equal((await request("/start", "operator", "POST", { url: "file:///etc/passwd" })).status, 400);
    assert.equal((await request("/start", "operator", "POST")).status, 202);
    assert.equal((await request("/stop", "operator", "POST")).status, 200);
    assert.equal((await request("/id", "operator", "DELETE")).status, 403);
    assert.equal((await request("/id", "owner", "DELETE")).status, 204);
    assert.equal((await request("/id/chunks/-1", "viewer")).status, 400);
    assert.equal((await request("/id/chunks/NaN", "viewer")).status, 400);
    assert.equal((await request("/id/chunks/0", "viewer")).status, 200);
    assert.deepEqual(calls, ["start", "stop", "delete", "chunk"]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
