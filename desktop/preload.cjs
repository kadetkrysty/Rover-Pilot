const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("roverosDesktop", {
  getSetupState: () => ipcRenderer.invoke("desktop:get-setup-state"),
  connectToServer: (serverUrl) =>
    ipcRenderer.invoke("desktop:connect-to-server", serverUrl),
});
