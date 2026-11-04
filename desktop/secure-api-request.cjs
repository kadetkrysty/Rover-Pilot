"use strict";

const crypto = require("node:crypto");
const https = require("node:https");

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function normalizeFingerprint(value) {
  const normalized = String(value || "").replace(/SHA256:?/i, "").replace(/:/g, "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function requestSecureApi({ serverOrigin, url, fingerprint, token, method = "GET", body }, transport = {}) {
  const expectedFingerprint = normalizeFingerprint(fingerprint);
  let origin;
  let target;
  try {
    origin = new URL(serverOrigin);
    target = new URL(url);
  } catch {
    return Promise.reject(new Error("Invalid MiniPC API address."));
  }
  if (!expectedFingerprint || origin.protocol !== "http:" ||
      target.protocol !== "https:" || target.port !== "5443" ||
      target.hostname.toLowerCase() !== origin.hostname.toLowerCase() ||
      target.username || target.password || target.hash ||
      (target.search && (target.search.length > 512 || /[\r\n]/.test(target.search))) ||
      !/^\/api\/[A-Za-z0-9_./-]+$/.test(target.pathname) ||
      target.pathname.includes("/../") ||
      target.pathname.startsWith("/api/provisioning/") ||
      !["GET", "POST", "PATCH", "DELETE", "HEAD"].includes(method) ||
      (token && !/^[a-f0-9]{64}$/i.test(token))) {
    return Promise.reject(new Error("Invalid certificate-pinned RoverOS API request."));
  }

  const encodedBody = body === undefined ? null : Buffer.from(body, "utf8");
  if (encodedBody && encodedBody.length > MAX_BODY_BYTES) {
    return Promise.reject(new Error("RoverOS API request is too large."));
  }

  return new Promise((resolve, reject) => {
    let verified = false;
    const request = https.request({
      hostname: transport.hostname || target.hostname,
      port: transport.port || 5443,
      path: `${target.pathname}${target.search}`,
      method,
      agent: false,
      rejectUnauthorized: false,
      headers: {
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
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
        if (length > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("MiniPC API response is too large."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        status: response.statusCode || 502,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
      response.on("error", () => reject(new Error("MiniPC API response was interrupted.")));
    });

    request.on("socket", (socket) => {
      socket.once("secureConnect", () => {
        try {
          const raw = socket.getPeerCertificate()?.raw;
          if (!raw) throw new Error("MiniPC certificate is missing.");
          const certificate = new crypto.X509Certificate(raw);
          const now = Date.now();
          if (now < Date.parse(certificate.validFrom) || now > Date.parse(certificate.validTo)) {
            throw new Error("MiniPC certificate has expired.");
          }
          const actual = crypto.createHash("sha256").update(raw).digest("hex");
          if (!crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expectedFingerprint, "hex"))) {
            throw new Error("MiniPC certificate fingerprint does not match.");
          }
          verified = true;
          if (encodedBody) request.write(encodedBody);
          request.end();
        } catch {
          request.destroy(new Error("MiniPC certificate fingerprint does not match."));
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("MiniPC API request timed out.")));
    request.on("error", () => reject(new Error("Could not securely connect to the MiniPC API.")));
  });
}

module.exports = { normalizeFingerprint, requestSecureApi };
