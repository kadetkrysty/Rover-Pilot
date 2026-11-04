import { test } from "node:test";
import assert from "node:assert/strict";
import { demoResponse, demoTelemetry, installDemoTransport, isDemoMode } from "./demoMode";

test("demo fixtures include bounded telemetry and never acknowledge real writes", async () => {
  const sample = demoTelemetry(10000);
  assert.equal(sample.battery, 85);
  assert.equal(sample.lidar.length, 72);
  assert.equal(sample.motorLeft, 0);
  assert.equal(sample.motorRight, 0);
  const response = demoResponse("/api/telemetry/current");
  assert.equal(response.headers.get("x-roveros-demo"), "1");
  assert.equal((await response.json()).gps.lat, 34.0522);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(demoResponse("/api/control/drive", { method }).status, 403);
  }
  assert.equal(demoResponse("/api/not-supported").status, 503);
});

test("offline transport blocks MiniPC requests without touching stored pairing credentials", async () => {
  const previousWindow = globalThis.window;
  let networkCalls = 0;
  const storage = new Map<string, string>();
  const fakeWindow = {
    location: { search: "?demo=1", protocol: "https:", origin: "https://client.test", href: "https://client.test/?demo=1" },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
    fetch: async () => { networkCalls++; return new Response("network"); },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  try {
    assert.equal(isDemoMode(), true);
    installDemoTransport();
    const response = await fakeWindow.fetch("https://roveros-server.local:5443/api/control/drive", { method: "POST" });
    assert.equal(response.status, 403);
    assert.equal((await fakeWindow.fetch("https://roveros-server.local:5443/health")).status, 503);
    assert.equal(networkCalls, 0);
    assert.deepEqual([...storage.keys()], ["roveros_offline_demo"]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});
