const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const roverServerUrl = "http://roveros-server.local:5000";
const roverHealthUrl = `${roverServerUrl}/api/system/info`;
const setupPagePath = path.join(__dirname, "setup.html");
const setupPageUrl = pathToFileURL(setupPagePath).href;
const preloadPath = path.join(__dirname, "preload.cjs");

let mainWindow;
let activeServerOrigin = null;
let setupError = "";

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

async function verifyRoverServer() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(roverHealthUrl, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`MiniPC returned HTTP ${response.status}.`);
    }

    const info = await response.json();
    if (
      !info ||
      typeof info.rover_name !== "string" ||
      !info.rover_name.toLowerCase().startsWith("roveros")
    ) {
      throw new Error("The discovered device did not identify itself as RoverOS.");
    }
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
  return { error: setupError };
});

ipcMain.handle("desktop:search-server", async (event) => {
  if (!isSetupPageRequest(event)) {
    return { ok: false, error: "Open the MiniPC search screen to continue." };
  }

  try {
    await verifyRoverServer();
    activeServerOrigin = new URL(roverServerUrl).origin;
    await mainWindow.loadURL(roverServerUrl);
    setupError = "";
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
