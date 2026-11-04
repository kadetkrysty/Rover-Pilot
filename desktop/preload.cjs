const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("roverosDesktop", {
  getSetupState: () => ipcRenderer.invoke("desktop:get-setup-state"),
  searchForServer: () => ipcRenderer.invoke("desktop:search-server"),
});
