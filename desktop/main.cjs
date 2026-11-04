const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { requestProvisioning } = require("./provisioning-request.cjs");

const roverServerUrl = "http://roveros-server.local:5000";
const roverHealthUrl = `${roverServerUrl}/api/system/info`;
const setupPagePath = path.join(__dirname, "setup.html");
const setupPageUrl = pathToFileURL(setupPagePath).href;
const preloadPath = path.join(__dirname, "preload.cjs");

let mainWindow;
let activeServerOrigin = null;
let setupError = "";
let currentProvisioningStatus = null;

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

async function showSetup(error = "") {
  if (!mainWindow) return;
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

  try {
    const result = await verifyRoverServer();
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
    const message =
      "RoverOS-Server was not found. Join its Wi-Fi or the same local network, then search again.";
    setupError = message;
    if (mainWindow.webContents.getURL() !== setupPageUrl) {
      await showSetup(message);
    }
    return { ok: false, error: message };
  }
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
