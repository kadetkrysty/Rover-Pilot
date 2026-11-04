const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roveros-provision-test-"));
process.env.ROVEROS_STATE_DIR = dir;
process.env.ROVEROS_PAIRING_CODE_FILE = path.join(dir, "test-pairing-code");
const pairingCode = "a".repeat(32); // Test fixture, not a device credential.
fs.writeFileSync(process.env.ROVEROS_PAIRING_CODE_FILE, pairingCode);
const { validateWifi, splitNmcliRow, escapeKeyfileValue, createHandler, saveState } = require("./provisioner.cjs");
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("Wi-Fi validation is byte-bounded, typed, and rejects control characters", () => {
  assert.deepEqual(validateWifi({ ssid: "Test Wi-Fi", password: "fixture-passphrase", hidden: true }), {
    ssid: "Test Wi-Fi", password: "fixture-passphrase", hidden: true,
  });
  for (const value of [
    null, [], { ssid: "", password: "fixture-passphrase" },
    { ssid: "é".repeat(17), password: "fixture-passphrase" },
    { ssid: "Test\ninjection", password: "fixture-passphrase" },
    { ssid: "Test", password: "short" },
    { ssid: "Test", password: 123456789 },
    { ssid: "Test", password: "bad\npassword" },
    { ssid: "Test", password: "fixture-passphrase", hidden: "yes" },
  ]) assert.throws(() => validateWifi(value));
  assert.equal(validateWifi({ ssid: "Test", password: "b".repeat(64) }).password.length, 64);
});
test("SSID metacharacters are data rather than shell arguments or keyfile lines", () => {
  const value = '$(touch x);a\\b';
  assert.equal(validateWifi({ ssid: value, password: "fixture-passphrase" }).ssid, value);
  assert.equal(escapeKeyfileValue("a\\b\nc"), "a\\\\b\\nc");
  assert.equal(escapeKeyfileValue(" leading and trailing "), "\\sleading\\sand\\strailing\\s");
  assert.deepEqual(splitNmcliRow("SSID\\:name:WPA2:88"), ["SSID:name", "WPA2", "88"]);
});
async function withServer(secure, callback) {
  const server = http.createServer(createHandler(secure));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
test("public status includes Android CORS but never accepts HTTP credentials", async () => {
  await withServer(false, async (base) => {
    const response = await fetch(`${base}/api/provisioning/status`, { headers: { Origin: "https://localhost" } });
    assert.equal(response.headers.get("access-control-allow-origin"), "https://localhost");
    const body = await response.text();
    assert.equal(JSON.parse(body).service, "RoverOS");
    assert.ok(!body.includes(pairingCode));
    assert.equal((await fetch(`${base}/api/provisioning/wifi`, { method: "POST" })).status, 404);
  });
});
test("paired setup rejects unauthorized, non-JSON and invalid Wi-Fi before any OS call", async () => {
  await withServer(true, async (base) => {
    assert.equal((await fetch(`${base}/api/provisioning/networks`)).status, 401);
    const headers = { Authorization: `Bearer ${pairingCode}`, "Content-Type": "application/json" };
    const response = await fetch(`${base}/api/provisioning/wifi`, {
      method: "POST", headers, body: JSON.stringify({ ssid: "", password: "fixture-passphrase" }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "INVALID_SSID");
    assert.equal((await fetch(`${base}/api/provisioning/wifi`, {
      method: "POST", headers: { Authorization: `Bearer ${pairingCode}` }, body: "{}",
    })).status, 415);
    saveState({ state: "installing", stage: "software", progress: 25, message: "Installing." });
    assert.equal((await fetch(`${base}/api/provisioning/wifi`, {
      method: "POST", headers, body: "{}",
    })).status, 409);
    const stored = fs.readFileSync(path.join(dir, "state.json"), "utf8");
    assert.ok(!stored.includes(pairingCode));
    assert.equal(fs.statSync(path.join(dir, "state.json")).mode & 0o777, 0o644);
  });
});
