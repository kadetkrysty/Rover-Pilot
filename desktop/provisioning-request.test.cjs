const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { requestProvisioning, normalizeFingerprint } = require("./provisioning-request.cjs");

test("fingerprints and request allowlists reject malformed setup requests", async () => {
  assert.equal(normalizeFingerprint("ab:".repeat(31) + "ab"), "ab".repeat(32));
  assert.equal(normalizeFingerprint("not-a-pin"), null);
  await assert.rejects(requestProvisioning({ fingerprint: "a".repeat(64), pairingCode: "b".repeat(32), path: "/arbitrary" }), /Invalid/);
});
test("pinned HTTPS succeeds repeatedly, while a wrong pin sends no credential request", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roveros-pin-test-"));
  let requests = 0;
  let receivedBody = "";
  let server;
  try {
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", path.join(dir, "key"), "-out", path.join(dir, "cert"), "-subj", "/CN=fixture"],
    { stdio: "ignore" });
    const cert = fs.readFileSync(path.join(dir, "cert"));
    const fingerprint = new crypto.X509Certificate(cert).fingerprint256.replaceAll(":", "").toLowerCase();
    server = https.createServer({ key: fs.readFileSync(path.join(dir, "key")), cert }, (req, res) => {
      requests++;
      req.on("data", (data) => receivedBody += data);
      req.on("end", () => { res.setHeader("content-type", "application/json"); res.end('{"accepted":true}'); });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const transport = { hostname: "127.0.0.1", port: server.address().port };
    const options = { fingerprint, pairingCode: "b".repeat(32), path: "/api/provisioning/wifi", method: "POST", body: { ssid: "Fixture", password: "fixture-passphrase" } };
    assert.equal((await requestProvisioning(options, transport)).accepted, true);
    assert.equal((await requestProvisioning(options, transport)).accepted, true);
    assert.ok(receivedBody.includes("fixture-passphrase"));
    await assert.rejects(requestProvisioning({ ...options, fingerprint: "0".repeat(64) }, transport));
    assert.equal(requests, 2, "The wrong-pin connection must not send headers or credentials.");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
