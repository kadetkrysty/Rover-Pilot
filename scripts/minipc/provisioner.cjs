#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const http = require("node:http");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");

const STATE_DIR = process.env.ROVEROS_STATE_DIR || "/var/lib/roveros-provisioner";
const STATE_FILE = path.join(STATE_DIR, "state.json");
const TOKEN_FILE = process.env.ROVEROS_PAIRING_CODE_FILE || "/etc/roveros-provisioner/pairing-code";
const TLS_CERT = process.env.ROVEROS_TLS_CERT || "/etc/roveros-provisioner/server.crt";
const TLS_KEY = process.env.ROVEROS_TLS_KEY || "/etc/roveros-provisioner/server.key";
const RELEASE_INSTALLER =
  process.env.ROVEROS_INSTALLER || "/usr/local/lib/roveros-provisioner/install-release.sh";
const MAX_BODY_BYTES = 8 * 1024;
const attempts = new Map();
let provisioning = false;

const publicState = {
  state: "setup_required",
  stage: "wifi",
  progress: 0,
  message: "Connect RoverOS-Server to a Wi-Fi network to continue setup.",
  updatedAt: new Date().toISOString(),
};

function saveState(next) {
  Object.assign(publicState, next, { updatedAt: new Date().toISOString() });
  if (!Object.hasOwn(next, "errorCode")) delete publicState.errorCode;
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o755 });
  fs.chmodSync(STATE_DIR, 0o755);
  const temporary = `${STATE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(publicState)}\n`, { mode: 0o644 });
  fs.chmodSync(temporary, 0o644);
  fs.renameSync(temporary, STATE_FILE);
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": data.length,
    "x-content-type-options": "nosniff",
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request too large."), { statusCode: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Invalid JSON."), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function rateLimit(req) {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  if (attempts.size >= 1024 && !attempts.has(ip)) attempts.clear();
  const previous = attempts.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (previous.resetAt <= now) {
    previous.count = 0;
    previous.resetAt = now + 60_000;
  }
  previous.count += 1;
  attempts.set(ip, previous);
  return previous.count <= 12;
}

function authorized(req) {
  const expected = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  const supplied = /^Bearer ([a-f0-9]{32})$/i.exec(req.headers.authorization || "")?.[1];
  if (!supplied || !/^[a-f0-9]{32}$/i.test(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

function run(command, args, timeout = 20_000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout, maxBuffer: 256 * 1024, encoding: "utf8" }, (error, stdout) => {
      if (error) {
        reject(new Error("MINIPC_COMMAND_FAILED"));
        return;
      }
      resolve(stdout);
    });
  });
}

function runInstaller() {
  return new Promise((resolve, reject) => {
    const child = spawn(RELEASE_INSTALLER, [], { detached: true, stdio: "ignore" });
    const timer = setTimeout(() => {
      if (child.pid) {
        try { process.kill(-child.pid, "SIGTERM"); } catch { /* already exited */ }
      }
      reject(new Error("SOFTWARE_INSTALL_TIMED_OUT"));
    }, 30 * 60_000);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("SOFTWARE_INSTALL_FAILED"));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error("SOFTWARE_INSTALL_FAILED"));
    });
  });
}

function splitNmcliRow(line) {
  const fields = [];
  let current = "";
  let escaped = false;
  for (const character of line) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === ":") {
      fields.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  fields.push(current);
  return fields;
}

async function listNetworks() {
  const output = await run("nmcli", [
    "--terse", "--escape", "yes", "--fields", "SSID,SECURITY,SIGNAL",
    "device", "wifi", "list", "--rescan", "yes",
  ], 18_000);
  const seen = new Set();
  return output.split(/\r?\n/).map(splitNmcliRow).filter((row) => {
    const [ssid, security] = row;
    if (!ssid || !security || seen.has(ssid)) return false;
    seen.add(ssid);
    return true;
  }).slice(0, 50).map(([ssid, security, signal]) => ({
    ssid,
    security: security || "open",
    signal: Number.parseInt(signal || "0", 10) || 0,
  }));
}

function escapeKeyfileValue(value) {
  return value.replace(/\\/g, "\\\\").replace(/ /g, "\\s").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
}

function validateWifi(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("Invalid Wi-Fi settings."), { code: "INVALID_WIFI" });
  }
  const { ssid, password, hidden = false } = value;
  if (typeof ssid !== "string" || Buffer.byteLength(ssid, "utf8") < 1 ||
      Buffer.byteLength(ssid, "utf8") > 32 || /[\u0000-\u001f\u007f]/u.test(ssid)) {
    throw Object.assign(new Error("Invalid network name."), { code: "INVALID_SSID" });
  }
  if (typeof password !== "string" ||
      (!((Buffer.byteLength(password, "utf8") >= 8 && Buffer.byteLength(password, "utf8") <= 63) ||
        /^[a-f0-9]{64}$/i.test(password))) ||
      /[\u0000-\u001f\u007f]/u.test(password)) {
    throw Object.assign(new Error("Invalid Wi-Fi password."), { code: "INVALID_PASSWORD" });
  }
  if (typeof hidden !== "boolean") {
    throw Object.assign(new Error("Invalid network settings."), { code: "INVALID_WIFI" });
  }
  return { ssid, password, hidden };
}

function writeWifiProfile({ ssid, password, hidden }) {
  const dir = "/etc/NetworkManager/system-connections";
  const file = path.join(dir, "roveros-uplink.nmconnection");
  const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const uuid = /^uuid=([a-f0-9-]{36})$/m.exec(previous)?.[1] || crypto.randomUUID();
  const device = process.env.ROVEROS_WIFI_DEVICE;
  const contents = [
    "[connection]",
    "id=RoverOS-Uplink",
    `uuid=${uuid}`,
    "type=wifi",
    "autoconnect=true",
    ...(device && /^[A-Za-z0-9_.:-]{1,15}$/.test(device) ? [`interface-name=${device}`] : []),
    "",
    "[wifi]",
    "mode=infrastructure",
    `ssid=${escapeKeyfileValue(ssid)}`,
    `hidden=${hidden ? "true" : "false"}`,
    "",
    "[wifi-security]",
    "key-mgmt=wpa-psk",
    "proto=rsn;",
    "pairwise=ccmp;",
    "group=ccmp;",
    `psk=${escapeKeyfileValue(password)}`,
    "",
    "[ipv4]",
    "method=auto",
    "",
    "[ipv6]",
    "method=auto",
    "",
  ].join("\n");
  fs.mkdirSync(dir, { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, contents, { mode: 0o600 });
  fs.chmodSync(temporary, 0o600);
  fs.renameSync(temporary, file);
}

async function provisionWifi(value) {
  if (provisioning) return;
  provisioning = true;
  let wifiConnected = false;
  try {
    saveState({
      state: "wifi_connecting",
      stage: "wifi",
      progress: 10,
      message: "Connecting the MiniPC to the selected Wi-Fi network.",
    });
    writeWifiProfile(value);
    await run("nmcli", ["connection", "load", "/etc/NetworkManager/system-connections/roveros-uplink.nmconnection"]);
    await run("nmcli", ["connection", "up", "id", "RoverOS-Uplink"], 90_000);
    wifiConnected = true;
    await run("/usr/local/lib/roveros-provisioner/configure-firewall.sh", ["--setup"]);
    saveState({
      state: "installing",
      stage: "software",
      progress: 25,
      message: "Wi-Fi is connected. Installing RoverOS on the MiniPC.",
    });
    await runInstaller();
    saveState({
      state: "installing",
      stage: "starting",
      progress: 90,
      message: "Starting and checking the RoverOS service.",
    });
  } catch (error) {
    const code = /^[A-Z_]{1,40}$/.test(error?.code || "") ? error.code : "SETUP_FAILED";
    saveState({
      state: "failed",
      stage: "recovery",
      progress: 0,
      errorCode: code,
      message: "Setup could not finish. Reconnect to RoverOS-Server and retry.",
    });
    try {
      if (!wifiConnected && process.env.ROVEROS_SETUP_AP !== "0") {
        await run("nmcli", ["connection", "up", "id", "RoverOS-Hotspot"], 20_000);
      }
    } catch {
      // The user can still use Ethernet or owner SSH to recover the MiniPC.
    }
  } finally {
    provisioning = false;
  }
}

function createHandler(secure) {
  return async (req, res) => {
    if (req.headers.origin === "https://localhost") {
      res.setHeader("Access-Control-Allow-Origin", "https://localhost");
      res.setHeader("Vary", "Origin");
    }
    let url;
    try {
      url = new URL(req.url || "/", "http://roveros.invalid");
    } catch {
      return sendJson(res, 400, { error: "Invalid setup request." });
    }
    if (req.method === "GET" && url.pathname === "/api/provisioning/status") {
      return sendJson(res, 200, {
        service: "RoverOS",
        rover_name: "RoverOS-Server",
        ...publicState,
      });
    }

    if (!secure) return sendJson(res, 404, { error: "Not found." });
    if (!url.pathname.startsWith("/api/provisioning/")) {
      return sendJson(res, 404, { error: "Not found." });
    }
    if (!rateLimit(req)) return sendJson(res, 429, { error: "Too many setup requests." });

    try {
      if (!authorized(req)) return sendJson(res, 401, { error: "Pairing code was not accepted." });
      if (req.method === "POST" &&
          !/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) {
        return sendJson(res, 415, { error: "Setup requests must use JSON." });
      }

      if (req.method === "GET" && url.pathname === "/api/provisioning/networks") {
        return sendJson(res, 200, { networks: await listNetworks() });
      }

      if (req.method === "POST" && url.pathname === "/api/provisioning/wifi") {
        if (provisioning || !["setup_required", "failed"].includes(publicState.state)) {
          return sendJson(res, 409, { error: "Provisioning is not accepting Wi-Fi settings." });
        }
        const network = validateWifi(await readJson(req));
        void provisionWifi(network);
        return sendJson(res, 202, { accepted: true });
      }

      if (req.method === "POST" && url.pathname === "/api/provisioning/retry") {
        if (provisioning || !["setup_required", "failed"].includes(publicState.state)) {
          return sendJson(res, 409, { error: "Provisioning cannot be retried in its current state." });
        }
        const network = validateWifi(await readJson(req));
        void provisionWifi(network);
        return sendJson(res, 202, { accepted: true });
      }

      return sendJson(res, 404, { error: "Not found." });
    } catch (error) {
      const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
      const code = /^[A-Z_]{1,40}$/.test(error?.code || "") ? error.code : "SETUP_REQUEST_FAILED";
      return sendJson(res, status, {
        error: code,
        message: code.startsWith("INVALID_") ? error.message : "Setup request failed.",
      });
    }
  };
}

async function start() {
  if (fs.existsSync(path.join(STATE_DIR, "complete"))) {
    // No setup listener is opened on a provisioned device, including after reboot.
    await run("systemctl", ["start", "roveros.service"]);
    return;
  }
  const token = fs.readFileSync(TOKEN_FILE, "utf8").trim();
  if (!/^[a-f0-9]{32}$/i.test(token)) throw new Error("Invalid MiniPC pairing code file.");
  if (fs.existsSync(STATE_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      if (saved.state === "failed") Object.assign(publicState, saved);
      else if (["wifi_connecting", "installing", "ready"].includes(saved.state)) {
        Object.assign(publicState, {
          state: "failed", stage: "recovery", progress: 0, errorCode: "SETUP_INTERRUPTED",
          message: "Setup was interrupted. Reconnect to the MiniPC and retry.",
        });
      }
    } catch {
      Object.assign(publicState, {
        state: "failed", stage: "recovery", progress: 0, errorCode: "STATE_INVALID",
        message: "Setup status could not be restored. Use owner SSH to check the MiniPC.",
      });
    }
  }
  saveState(publicState);
  const httpServer = http.createServer(createHandler(false));
  const httpsServer = https.createServer({
    key: fs.readFileSync(TLS_KEY),
    cert: fs.readFileSync(TLS_CERT),
    minVersion: "TLSv1.2",
  }, (req, res) => void createHandler(true)(req, res));
  for (const server of [httpServer, httpsServer]) {
    server.requestTimeout = 20_000;
    server.headersTimeout = 10_000;
    server.maxConnections = 64;
  }
  httpServer.listen(5000, "0.0.0.0");
  httpsServer.listen(5443, "0.0.0.0");
  process.on("SIGTERM", () => {
    httpServer.close();
    httpsServer.close();
  });
}

module.exports = { escapeKeyfileValue, splitNmcliRow, validateWifi, createHandler, saveState };
if (require.main === module) {
  start().catch(() => {
    console.error("RoverOS bootstrap could not start. Check owner SSH configuration.");
    process.exitCode = 1;
  });
}
