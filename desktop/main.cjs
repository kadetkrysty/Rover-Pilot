const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { normalizeServerUrl } = require("./server-url.cjs");

const settingsPath = () => path.join(app.getPath("userData"), "settings.json");
const setupPagePath = path.join(__dirname, "setup.html");
const setupPageUrl = pathToFileURL(setupPagePath).href;
const preloadPath = path.join(__dirname, "preload.cjs");

let mainWindow;
let activeServerOrigin = null;
let setupError = "";
let setupServerUrl = "";

async function readServerUrl() {
  try {
    const settings = JSON.parse(await fs.readFile(settingsPath(), "utf8"));
    return normalizeServerUrl(settings.serverUrl);
  } catch {
    return "";
  }
}

async function saveServerUrl(serverUrl) {
  const normalized = normalizeServerUrl(serverUrl);
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(
    settingsPath(),
    `${JSON.stringify({ serverUrl: normalized }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return normalized;
}

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

async function showSetup(error = "", serverUrl = "") {
  if (!mainWindow) return;
  activeServerOrigin = null;
  setupError = error;
  setupServerUrl = serverUrl || (await readServerUrl());
  await mainWindow.loadFile(setupPagePath);
}

async function openRoverOS(serverUrl) {
  const normalized = normalizeServerUrl(serverUrl);
  activeServerOrigin = new URL(normalized).origin;
  setupServerUrl = normalized;

  try {
    await mainWindow.loadURL(normalized);
    setupError = "";
    return { ok: true };
  } catch {
    await showSetup(
      "Could not reach RoverOS. Check that the MiniPC is on and both devices are on the same network.",
      normalized,
    );
    return { ok: false, error: setupError };
  }
}

ipcMain.handle("desktop:get-setup-state", async (event) => {
  if (!isSetupPageRequest(event)) {
    return { serverUrl: "", error: "Open the MiniPC connection screen to change settings." };
  }
  return {
    serverUrl: setupServerUrl || (await readServerUrl()),
    error: setupError,
  };
});

ipcMain.handle("desktop:connect-to-server", async (event, serverUrl) => {
  if (!isSetupPageRequest(event)) {
    return { ok: false, error: "Open the MiniPC connection screen to change settings." };
  }

  let normalized;
  try {
    normalized = normalizeServerUrl(serverUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enter a valid MiniPC address.";
    setupError = message;
    return { ok: false, error: message };
  }

  try {
    await saveServerUrl(normalized);
    return await openRoverOS(normalized);
  } catch {
    const message = "Could not save the MiniPC address. Check Windows app permissions and try again.";
    setupError = message;
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
            label: "Change MiniPC address…",
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

  const savedUrl = await readServerUrl();
  if (savedUrl) {
    await openRoverOS(savedUrl);
  } else {
    await showSetup();
  }

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
