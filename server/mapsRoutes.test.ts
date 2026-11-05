import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerMapsRoutes } from "./mapsRoutes";
import type { storage } from "./storage";
import type { RoverClientRole } from "./clientAuth";
import { defaultMapsSettings, isPublicTileUrl, parseCoordinates } from "../shared/maps";
import { createPhotonSearch, MapSearchError } from "./mapSearch";

test("OSM configuration is shared, owner-managed, validated and rejects legacy credentials", async () => {
  let value = "";
  let writes = 0;
  const store = {
    getConfig: async () => ({ key: "maps_settings", value }),
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
  const request = (role?: string, body?: unknown, path = "config") => fetch(`http://127.0.0.1:${port}/api/maps/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    assert.equal((await request()).status, 401);
    assert.equal((await request("rover")).status, 403);
    const initial = await request("viewer");
    assert.equal(initial.headers.get("cache-control"), "no-store");
    assert.deepEqual(await initial.json(), { ...defaultMapsSettings, provider: "openstreetmap", canManage: false });
    for (const role of ["operator", "viewer", "rover"])
      assert.equal((await request(role, defaultMapsSettings)).status, 403);
    for (const body of [
      { browserKey: "obsolete", publicBrowserKey: true },
      { ...defaultMapsSettings, tileUrl: "http://tiles.example.org/{z}/{x}/{y}.png" },
      { ...defaultMapsSettings, tileUrl: "https://127.0.0.1/{z}/{x}/{y}.png" },
      { ...defaultMapsSettings, tileUrl: "https://user:pass@tiles.example.org/{z}/{x}/{y}.png" },
      { ...defaultMapsSettings, tileUrl: "https://tiles.example.org/{z}/{x}/{y}.png?secret=anything" },
      { ...defaultMapsSettings, unexpected: true },
    ]) assert.equal((await request("owner", body)).status, 400);
    assert.equal(writes, 0);
    const saved = await request("owner", { ...defaultMapsSettings, searchEnabled: false });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { saved: true });
    const shared = await (await request("operator")).json();
    assert.equal(shared.searchEnabled, false);
    assert.equal(shared.canManage, false);
    assert.equal(shared.browserKey, undefined);
    assert.equal((await (await request("owner")).json()).canManage, true);
    assert.equal((await request(undefined, { query: "London" }, "search")).status, 401);
    assert.equal((await request("rover", { query: "London" }, "search")).status, 403);
    for (const body of [{ query: "" }, { query: "A".repeat(161) }, { query: "bad\nquery" }, { query: "London", url: "http://localhost" }])
      assert.equal((await request("viewer", body, "search")).status, 400);
    assert.equal((await request("viewer", { query: "London" }, "search")).status, 403);
    value = "invalid persisted settings";
    assert.equal((await request("viewer")).status, 503, "corrupt settings must not silently enable external services");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("tile URL and local coordinate validation", () => {
  assert.ok(isPublicTileUrl(defaultMapsSettings.tileUrl));
  for (const url of ["file:///etc/{z}/{x}/{y}", "https://router.local/{z}/{x}/{y}", "https://[::1]/{z}/{x}/{y}", "https://tile.openstreetmap.org/no-template"])
    assert.equal(isPublicTileUrl(url), false);
  assert.deepEqual(parseCoordinates("0, -118.25"), { lat: 0, lng: -118.25, label: "0, -118.25" });
  assert.equal(parseCoordinates("91, 0"), null);
  assert.equal(parseCoordinates("0, 181"), null);
  assert.equal(parseCoordinates("<script>,0"), null);
});

test("Photon search is fixed-origin, credential-free, cached, bounded and throttled", async () => {
  let calls = 0;
  let clock = 10000;
  const search = createPhotonSearch((async (input, options) => {
    calls++;
    const url = new URL(input!.toString());
    assert.equal(url.origin, "https://photon.komoot.io");
    assert.equal(url.searchParams.get("limit"), "5");
    assert.equal(options?.redirect, "error");
    const headers = new Headers(options?.headers);
    assert.match(headers.get("User-Agent")!, /RoverOS/);
    assert.equal(headers.get("Authorization"), null);
    return new Response(JSON.stringify({ features: [
      { geometry: { type: "Point", coordinates: [-0.12, 51.5] }, properties: { name: "London" } },
      { geometry: { type: "Point", coordinates: [181, 200] }, properties: { name: "Invalid" } },
    ] }));
  }) as typeof fetch, () => clock);
  assert.deepEqual(await search("London"), [{ lat: 51.5, lng: -0.12, label: "London" }]);
  assert.equal((await search(" london ")).length, 1);
  assert.equal(calls, 1);
  await assert.rejects(search("Paris"), (error: unknown) => error instanceof MapSearchError && error.status === 429);
  clock += 1200;
  assert.equal((await search("Paris")).length, 1);
  assert.equal(calls, 2);
});

test("Photon fails explicitly for unavailable, malformed and oversized upstream responses", async () => {
  for (const response of [new Response("", { status: 503 }), new Response("not JSON"), new Response("x".repeat(100001))]) {
    const search = createPhotonSearch((async () => response) as typeof fetch);
    await assert.rejects(search("London"), (error: unknown) => error instanceof MapSearchError && error.status === 503);
  }
});
