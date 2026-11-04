import assert from "node:assert/strict";
import test from "node:test";
import {
  getRoverApiUrl,
  getRoverSecureApiUrl,
  getRoverWsUrl,
  normalizeRoverUrl,
  testRoverConnection,
} from "./roverConnection";

test("normalizes a MiniPC address to port 5000 by default", () => {
  assert.equal(
    normalizeRoverUrl("http://roveros.local"),
    "http://roveros.local:5000",
  );
});

test("preserves an explicit MiniPC port", () => {
  assert.equal(
    normalizeRoverUrl("http://192.168.1.40:5100/"),
    "http://192.168.1.40:5100",
  );
});

test("rejects credentials, paths, queries, fragments, and unsupported protocols", () => {
  for (const address of [
    "ftp://192.168.1.40:5000",
    "http://user:password@192.168.1.40:5000",
    "http://192.168.1.40:5000/admin",
    "http://192.168.1.40:5000?debug=true",
    "http://192.168.1.40:5000#section",
  ]) {
    assert.throws(() => normalizeRoverUrl(address), address);
  }
});

test("builds API URLs on the configured MiniPC and blocks paths outside /api", () => {
  assert.equal(
    getRoverApiUrl("/api/system/info", "http://192.168.1.40:5000"),
    "http://192.168.1.40:5000/api/system/info",
  );
  assert.throws(
    () => getRoverApiUrl("/api/../admin", "http://192.168.1.40:5000"),
    /under \/api\//,
  );
});

test("normal operation uses the pinned HTTPS API and WSS endpoint", () => {
  const miniPc = "http://192.168.1.40:5000";
  assert.equal(
    getRoverSecureApiUrl("/api/config?section=drive", miniPc),
    "https://192.168.1.40:5443/api/config?section=drive",
  );
  assert.equal(getRoverWsUrl(miniPc), "wss://192.168.1.40:5443/ws/telemetry");
  assert.throws(() => getRoverSecureApiUrl("/admin", miniPc), /begin with \/api\//);
});

test("connection verification rejects a successful response from a non-RoverOS service", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    setTimeout,
    clearTimeout,
  } as unknown as Window & typeof globalThis;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ service: "unrelated" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      testRoverConnection("http://192.168.1.40:5000"),
      /did not identify itself as RoverOS/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});
