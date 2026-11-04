"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { normalizeFingerprint, requestSecureApi } = require("./secure-api-request.cjs");

test("secure API helper validates certificate pins and allowed local API targets", async () => {
  assert.equal(normalizeFingerprint("SHA256:" + "AB:".repeat(31) + "AB"), "ab".repeat(32));

  const base = {
    serverOrigin: "http://roveros-server.local:5000",
    url: "https://roveros-server.local:5443/api/config",
    fingerprint: "a".repeat(64),
  };
  for (const options of [
    { ...base, url: "https://other.local:5443/api/config" },
    { ...base, url: "https://roveros-server.local:5443/api/../admin" },
    { ...base, url: "https://roveros-server.local:5443/api/provisioning/wifi" },
    { ...base, token: "not-a-token" },
    { ...base, fingerprint: "bad" },
  ]) {
    await assert.rejects(requestSecureApi(options), /Invalid/);
  }
});

test("secure API sends credentials only after the exact TLS certificate pin matches", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roveros-api-pin-test-"));
  let requests = 0;
  let receivedAuthorization = "";
  let server;
  try {
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", path.join(dir, "key"), "-out", path.join(dir, "cert"), "-subj", "/CN=fixture",
    ], { stdio: "ignore" });
    const cert = fs.readFileSync(path.join(dir, "cert"));
    const key = fs.readFileSync(path.join(dir, "key"));
    const fingerprint = new crypto.X509Certificate(cert).fingerprint256.replaceAll(":", "").toLowerCase();
    server = https.createServer({ key, cert }, (req, res) => {
      requests++;
      receivedAuthorization = req.headers.authorization || "";
      res.setHeader("content-type", "application/json");
      res.end('{"settings":[]}');
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const transport = { hostname: "127.0.0.1", port: server.address().port };
    const options = {
      serverOrigin: "http://127.0.0.1:5000",
      url: "https://127.0.0.1:5443/api/config",
      fingerprint,
      token: "a".repeat(64),
    };
    const response = await requestSecureApi(options, transport);
    assert.equal(response.status, 200);
    assert.equal(receivedAuthorization, `Bearer ${options.token}`);
    await assert.rejects(requestSecureApi({ ...options, fingerprint: "0".repeat(64) }, transport));
    assert.equal(requests, 1, "A wrong certificate pin must not send the token.");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
