const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("roverosDesktop", {
  getSetupState: () => ipcRenderer.invoke("desktop:get-setup-state"),
  searchForServer: () => ipcRenderer.invoke("desktop:search-server"),
  getProvisioningStatus: () => ipcRenderer.invoke("desktop:get-provisioning-status"),
  scanWifiNetworks: (credentials) =>
    ipcRenderer.invoke("desktop:scan-wifi-networks", credentials),
  submitWifiSettings: (settings) =>
    ipcRenderer.invoke("desktop:submit-wifi-settings", settings),
});
