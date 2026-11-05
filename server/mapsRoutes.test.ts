import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerMapsRoutes } from "./mapsRoutes";
import type { storage } from "./storage";
import type { RoverClientRole } from "./clientAuth";

test("Maps uses dedicated paired access, owner-only writes and a shared public browser key", async () => {
  let value = "";
  let writes = 0;
  const store = {
    getConfig: async () => ({ key: "google_maps_api_key", value, type: "string" }),
    setConfig: async (config: { value: string }) => { value = config.value; writes++; return config; },
  } as unknown as Pick<typeof storage, "getConfig" | "setConfig">;
  const app = express();
  app.use(express.json());
  registerMapsRoutes(app, async (req, res) => {
    const role = req.get("x-test-role") as RoverClientRole | undefined;
    if (!role) { res.status(401).end(); return null; }
    return { role };
  }, store);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const request = (role?: string, body?: unknown) => fetch(`http://127.0.0.1:${port}/api/maps/config`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    assert.equal((await request()).status, 401);
    assert.equal((await request("rover")).status, 403);
    const browserKey = "AIza" + "TESTONLY".repeat(5);
    for (const role of ["operator", "viewer", "rover"]) {
      assert.equal((await request(role, { browserKey, publicBrowserKey: true })).status, 403);
    }
    for (const body of [
      { browserKey: "not-a-browser-key", publicBrowserKey: true },
      { browserKey: { private_key: "not accepted" }, publicBrowserKey: true },
      { browserKey, publicBrowserKey: false },
      { browserKey },
      { browserKey, publicBrowserKey: true, source: "file:///etc/passwd" },
      { browserKey: "A".repeat(2000), publicBrowserKey: true },
    ]) assert.equal((await request("owner", body)).status, 400);
    assert.equal(writes, 0);
    const saved = await request("owner", { browserKey, publicBrowserKey: true });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { configured: true }, "writes do not echo keys");
    const shared = await request("viewer");
    assert.equal(shared.headers.get("cache-control"), "no-store");
    assert.deepEqual(await shared.json(), { configured: true, browserKey, canManage: false });
    assert.equal((await (await request("owner")).json()).canManage, true);
    assert.equal((await request("owner", { browserKey: "", publicBrowserKey: true })).status, 200);
    assert.deepEqual(await (await request("operator")).json(), { configured: false, browserKey: "", canManage: false });
    assert.equal(writes, 2);
    value = "invalid legacy value";
    assert.equal((await (await request("viewer")).json()).configured, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
