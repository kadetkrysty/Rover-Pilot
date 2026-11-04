const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeServerUrl } = require("./server-url.cjs");

test("normalizes a local MiniPC address", () => {
  assert.equal(
    normalizeServerUrl("  http://192.168.1.40:5000/  "),
    "http://192.168.1.40:5000",
  );
});

test("accepts a local hostname and HTTPS address", () => {
  assert.equal(normalizeServerUrl("http://roveros.local:5000"), "http://roveros.local:5000");
  assert.equal(normalizeServerUrl("https://roveros.example.com"), "https://roveros.example.com");
});

test("rejects schemes other than HTTP and HTTPS", () => {
  assert.throws(() => normalizeServerUrl("file:///etc/passwd"), /http:\/\/ or https:\/\//);
  assert.throws(() => normalizeServerUrl("javascript:alert(1)"), /http:\/\/ or https:\/\//);
});

test("rejects credentials, paths, queries, fragments, and oversized values", () => {
  for (const value of [
    "http://user:password@roveros.local",
    "http://roveros.local/dashboard",
    "http://roveros.local/?next=other",
    "http://roveros.local/#section",
    `http://${"a".repeat(2050)}.local`,
  ]) {
    assert.throws(() => normalizeServerUrl(value));
  }
});
