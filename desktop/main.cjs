const { app, BrowserWindow, ipcMain, Menu, shell, protocol, net } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { requestProvisioning } = require("./provisioning-request.cjs");
const { requestSecureApi, normalizeFingerprint } = require("./secure-api-request.cjs");

const roverServerUrl = "http://roveros-server.local:5000";
const roverHealthUrl = `${roverServerUrl}/api/system/info`;
const setupPagePath = path.join(__dirname, "setup.html");
const setupPageUrl = pathToFileURL(setupPagePath).href;
const preloadPath = path.join(__dirname, "preload.cjs");
const demoRoot = path.join(__dirname, "..", "dist", "public");
protocol.registerSchemesAsPrivileged([
  { scheme: "roveros-demo", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow;
let demoActive = false;
let viewGeneration = 0;
let activeServerOrigin = null;
let setupError = "";
let currentProvisioningStatus = null;
let activeServerFingerprint = "";

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isSetupPageRequest(event) {
  return (
    mainWindow &&
    event.sender === mainWindow.webContents &&
    event.senderFrame?.url === setupPageUrl
  );
}

function handleNavigation(event, target) {
  if (!activeServerOrigin) return;

  const url = safeHttpUrl(target);
  if (url && url.origin === activeServerOrigin) return;

  event.preventDefault();
  if (url) {
    void shell.openExternal(url.href);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 420,
    minHeight: 560,
    show: false,
    title: "RoverOS",
    icon: path.join(__dirname, "assets", "roveros.ico"),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (details, callback) => callback({
      cancel: demoActive && details.webContentsId === mainWindow?.webContents.id,
    }),
  );
  mainWindow.webContents.on("will-navigate", handleNavigation);
  mainWindow.webContents.on("will-redirect", handleNavigation);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const target = safeHttpUrl(url);
    if (target && target.origin !== activeServerOrigin) {
      void shell.openExternal(target.href);
    }
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    activeServerOrigin = null;
  });
}

app.on("certificate-error", (event, webContents, urlValue, _error, certificate, callback) => {
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    callback(false);
    return;
  }
  const actualFingerprint = normalizeFingerprint(certificate?.fingerprint || "");
  const expectedOrigin = activeServerOrigin ? new URL(activeServerOrigin) : null;
  if (
    mainWindow &&
    webContents === mainWindow.webContents &&
    expectedOrigin &&
    url.protocol === "wss:" &&
    url.port === "5443" &&
    url.hostname.toLowerCase() === expectedOrigin.hostname.toLowerCase() &&
    activeServerFingerprint &&
    actualFingerprint === activeServerFingerprint
  ) {
    event.preventDefault();
    callback(true);
    return;
  }
  callback(false);
});

function isMainAppRequest(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || !activeServerOrigin) return false;
  try {
    return new URL(event.senderFrame?.url || "").origin === activeServerOrigin;
  } catch {
    return false;
  }
}

ipcMain.handle("desktop:set-server-fingerprint", async (event, fingerprint) => {
  if (!isMainAppRequest(event)) throw new Error("Open the paired RoverOS app to set its server certificate.");
  const normalized = normalizeFingerprint(fingerprint);
  if (!normalized) throw new Error("Invalid MiniPC certificate fingerprint.");
  const fingerprintPath = path.join(app.getPath("userData"), "server-certificate-fingerprint");
  fs.mkdirSync(path.dirname(fingerprintPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(fingerprintPath, `${normalized}\n`, { mode: 0o600 });
  fs.chmodSync(fingerprintPath, 0o600);
  activeServerFingerprint = normalized;
  return { ok: true };
});

ipcMain.handle("desktop:secure-api-request", async (event, options) => {
  if (!isMainAppRequest(event)) throw new Error("Open the paired RoverOS app to send secure API requests.");
  const fingerprint = normalizeFingerprint(options?.fingerprint);
  if (!fingerprint || fingerprint !== activeServerFingerprint) {
    throw new Error("The MiniPC certificate pin has not been confirmed on this device.");
  }
  return requestSecureApi({
    ...options,
    fingerprint,
    serverOrigin: activeServerOrigin,
  });
});

async function showSetup(error = "") {
  if (!mainWindow) return;
  viewGeneration += 1;
  demoActive = false;
  activeServerOrigin = null;
  setupError = error;
  await mainWindow.loadFile(setupPagePath);
}

async function getProvisioningStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${roverServerUrl}/api/provisioning/status`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.ok) {
      const status = await response.json();
      if (status && typeof status.state === "string") return status;
    }
  } catch {
    // Older RoverOS servers may not expose the first-run status endpoint.
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

async function verifyRoverServer() {
  const status = await getProvisioningStatus();
  if (status && status.state !== "ready") return { status, setupRequired: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(roverHealthUrl, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`MiniPC returned HTTP ${response.status}.`);
    const info = await response.json();
    if (
      !info ||
      typeof info.rover_name !== "string" ||
      !info.rover_name.toLowerCase().startsWith("roveros")
    ) {
      throw new Error("The discovered device did not identify itself as RoverOS.");
    }
    return { status: status || { state: "ready", message: "RoverOS is ready." }, setupRequired: false };
  } catch {
    throw new Error(
      "RoverOS-Server was not found. Join its Wi-Fi or the same local network, then search again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle("desktop:get-setup-state", async (event) => {
  if (!isSetupPageRequest(event)) {
    return { error: "Open the MiniPC search screen to change settings." };
  }
  return { error: setupError, provisioning: currentProvisioningStatus };
});

ipcMain.handle("desktop:search-server", async (event) => {
  if (!isSetupPageRequest(event)) {
    return { ok: false, error: "Open the MiniPC search screen to continue." };
  }

  const generation = viewGeneration;
  try {
    const result = await verifyRoverServer();
    if (generation !== viewGeneration) return { ok: false, error: "Search cancelled." };
    if (result.setupRequired) {
      currentProvisioningStatus = result.status;
      setupError = "";
      return { ok: false, setupRequired: true, status: result.status };
    }
    activeServerOrigin = new URL(roverServerUrl).origin;
    await mainWindow.loadURL(roverServerUrl);
    setupError = "";
    currentProvisioningStatus = null;
    return { ok: true };
  } catch {
    if (generation !== viewGeneration) return { ok: false, error: "Search cancelled." };
    const message =
      "RoverOS-Server was not found. Join its Wi-Fi or the same local network, then search again.";
    setupError = message;
    if (mainWindow.webContents.getURL() !== setupPageUrl) {
      await showSetup(message);
    }
    return { ok: false, error: message };
  }
});

ipcMain.handle("desktop:start-demo", async (event) => {
  if (!isSetupPageRequest(event) && !isMainAppRequest(event)) throw new Error("Open RoverOS to start demo mode.");
  if (!fs.existsSync(path.join(demoRoot, "index.html"))) {
    throw new Error("Offline demo files are missing. Rebuild the Windows installer with web assets.");
  }
  viewGeneration += 1; // Discard any discovery response still in flight.
  demoActive = true;
  activeServerOrigin = null; // Demo pages must never access the secure API bridge.
  await mainWindow.loadURL("roveros-demo://app/?demo=1");
  return { ok: true };
});

ipcMain.handle("desktop:exit-demo", async (event) => {
  const url = new URL(event.senderFrame?.url || "about:blank");
  if (!demoActive || event.sender !== mainWindow?.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame ||
      url.protocol !== "roveros-demo:" || url.host !== "app") {
    throw new Error("Only the local offline demo can exit demo mode.");
  }
  await showSetup();
  return { ok: true };
});

ipcMain.handle("desktop:get-provisioning-status", async (event) => {
  if (!isSetupPageRequest(event)) return { error: "Open the MiniPC setup screen to continue." };
  const status = await getProvisioningStatus();
  if (status) currentProvisioningStatus = status;
  return status || currentProvisioningStatus || {
    state: "offline",
    stage: "search",
    progress: 0,
    message: "RoverOS-Server could not be reached.",
  };
});

function validatePairingInput(credentials) {
  if (!credentials || typeof credentials !== "object") throw new Error("Invalid setup credentials.");
  const fingerprint = String(credentials.fingerprint || "");
  const pairingCode = String(credentials.pairingCode || "");
  if (!/^(?:[a-f0-9]{2}:?){32}$/i.test(fingerprint) ||
      !/^[a-f0-9]{32}$/i.test(pairingCode)) {
    throw new Error("Enter the fingerprint and pairing code displayed by the MiniPC.");
  }
  return { fingerprint, pairingCode };
}

ipcMain.handle("desktop:scan-wifi-networks", async (event, credentials) => {
  if (!isSetupPageRequest(event)) return { error: "Open the MiniPC setup screen to continue." };
  try {
    const auth = validatePairingInput(credentials);
    return await requestProvisioning({
      ...auth,
      path: "/api/provisioning/networks",
      method: "GET",
    });
  } catch (error) {
    return { error: error.message || "Could not scan for Wi-Fi networks." };
  }
});

ipcMain.handle("desktop:submit-wifi-settings", async (event, settings) => {
  if (!isSetupPageRequest(event)) return { error: "Open the MiniPC setup screen to continue." };
  try {
    const auth = validatePairingInput(settings);
    const ssid = settings?.ssid;
    const password = settings?.password;
    const hidden = settings?.hidden === true;
    if (typeof ssid !== "string" || Buffer.byteLength(ssid, "utf8") < 1 ||
        Buffer.byteLength(ssid, "utf8") > 32 || /[\u0000-\u001f\u007f]/u.test(ssid) ||
        typeof password !== "string" ||
        !((Buffer.byteLength(password, "utf8") >= 8 && Buffer.byteLength(password, "utf8") <= 63) ||
          /^[a-f0-9]{64}$/i.test(password))) {
      throw new Error("Enter a valid Wi-Fi name and WPA2 password.");
    }
    const status = currentProvisioningStatus || await getProvisioningStatus();
    return await requestProvisioning({
      ...auth,
      path: status?.state === "failed" ? "/api/provisioning/retry" : "/api/provisioning/wifi",
      method: "POST",
      body: { ssid, password, hidden },
    });
  } catch (error) {
    return { error: error.message || "Could not send Wi-Fi settings." };
  }
});

function installAppMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "RoverOS",
        submenu: [
          {
            label: "Find MiniPC on the network…",
            click: () => void showSetup(),
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
    ]),
  );
}

app.whenReady().then(async () => {
  protocol.handle("roveros-demo", async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== "app" || !["GET", "HEAD"].includes(request.method)) {
        return new Response("Not allowed", { status: 403 });
      }
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.includes("\0") || decoded.includes("\\")) return new Response("Invalid path", { status: 400 });
      let target = path.resolve(demoRoot, `.${decoded}`);
      const relative = path.relative(demoRoot, target);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return new Response("Not allowed", { status: 403 });
      }
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        if (path.extname(decoded)) return new Response("Not found", { status: 404 });
        target = path.join(demoRoot, "index.html");
      }
      const response = await net.fetch(pathToFileURL(target).href);
      if (target.endsWith("index.html")) {
        return new Response(await response.text(), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; media-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
          },
        });
      }
      return response;
    } catch {
      return new Response("Offline demo resource unavailable", { status: 404 });
    }
  });
  try {
    const savedFingerprint = fs.readFileSync(
      path.join(app.getPath("userData"), "server-certificate-fingerprint"),
      "utf8",
    ).trim();
    activeServerFingerprint = normalizeFingerprint(savedFingerprint) || "";
  } catch {
    activeServerFingerprint = "";
  }
  app.setAppUserModelId("com.roverostech.rover.desktop");
  installAppMenu();
  createWindow();
  await showSetup();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      void showSetup();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
