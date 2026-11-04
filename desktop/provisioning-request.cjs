"use strict";

const crypto = require("node:crypto");
const https = require("node:https");

const HOST = "roveros-server.local";
const PORT = 5443;
const PATHS = new Set([
  "/api/provisioning/networks",
  "/api/provisioning/wifi",
  "/api/provisioning/retry",
]);

function normalizeFingerprint(value) {
  const normalized = String(value || "").replace(/SHA256:?/i, "").replace(/:/g, "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function requestProvisioning({ fingerprint, pairingCode, path, method = "GET", body }) {
  const expectedFingerprint = normalizeFingerprint(fingerprint);
  if (!expectedFingerprint || !/^[a-f0-9]{32}$/i.test(pairingCode || "") ||
      !PATHS.has(path) || !["GET", "POST"].includes(method)) {
    return Promise.reject(new Error("Invalid RoverOS setup request."));
  }

  const encodedBody = body === undefined ? null : Buffer.from(JSON.stringify(body), "utf8");
  if (encodedBody && encodedBody.length > 8192) {
    return Promise.reject(new Error("Setup request is too large."));
  }

  return new Promise((resolve, reject) => {
    let verified = false;
    const request = https.request({
      hostname: HOST,
      port: PORT,
      path,
      method,
      rejectUnauthorized: false,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${pairingCode}`,
        ...(encodedBody ? {
          "content-type": "application/json",
          "content-length": encodedBody.length,
        } : {}),
      },
      timeout: 15_000,
    }, (response) => {
      if (!verified) {
        response.destroy();
        reject(new Error("MiniPC certificate verification failed."));
        return;
      }
      const chunks = [];
      let length = 0;
      response.on("data", (chunk) => {
        length += chunk.length;
        if (length > 65536) {
          request.destroy(new Error("MiniPC setup response is too large."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        let parsed = {};
        try {
          parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          reject(new Error("MiniPC returned an invalid setup response."));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(parsed.message || parsed.error || `MiniPC returned HTTP ${response.statusCode}.`));
          return;
        }
        resolve(parsed);
      });
    });

    request.on("socket", (socket) => {
      socket.once("secureConnect", () => {
        try {
          const certificate = socket.getPeerCertificate();
          const raw = certificate && certificate.raw;
          if (!raw) throw new Error("Missing certificate.");
          const x509 = new crypto.X509Certificate(raw);
          const now = Date.now();
          if (now < Date.parse(x509.validFrom) || now > Date.parse(x509.validTo)) {
            throw new Error("Expired certificate.");
          }
          const actual = crypto.createHash("sha256").update(raw).digest("hex");
          if (!crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expectedFingerprint, "hex"))) {
            throw new Error("Certificate fingerprint mismatch.");
          }
          verified = true;
          if (encodedBody) request.write(encodedBody);
          request.end();
        } catch {
          request.destroy(new Error("MiniPC certificate fingerprint does not match."));
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("MiniPC setup request timed out.")));
    request.on("error", () => reject(new Error("Could not securely connect to the MiniPC setup service.")));
  });
}

module.exports = { normalizeFingerprint, requestProvisioning };
