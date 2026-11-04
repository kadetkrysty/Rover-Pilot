const status = document.querySelector("#connection-status");
const searchButton = document.querySelector("#search-button");
const provisioningPanel = document.querySelector("#provisioning-panel");
const fingerprint = document.querySelector("#fingerprint");
const pairingCode = document.querySelector("#pairing-code");
const scanButton = document.querySelector("#scan-button");
const networkSelect = document.querySelector("#network-select");
const ssid = document.querySelector("#ssid");
const wifiPassword = document.querySelector("#wifi-password");
const hiddenNetwork = document.querySelector("#hidden-network");
const wifiForm = document.querySelector("#wifi-form");
const setupProgress = document.querySelector("#setup-progress");
let polling = false;

function showStatus(message, state = "searching") {
  status.textContent = message;
  status.dataset.state = state;
}

async function searchForServer() {
  searchButton.disabled = true;
  searchButton.textContent = "Searching…";
  provisioningPanel.hidden = true;
  showStatus("Searching for RoverOS-Server…");

  try {
    const result = await window.roverosDesktop.searchForServer();
    if (result.setupRequired) {
      provisioningPanel.hidden = false;
      showStatus("MiniPC found. Complete its first-time setup below.");
    } else if (!result.ok) {
      showStatus(result.error || "RoverOS-Server was not found.", "error");
    }
  } catch {
    showStatus(
      "RoverOS-Server was not found. Join its Wi-Fi or the same local network, then search again.",
      "error",
    );
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "Search again";
  }
}

scanButton.addEventListener("click", async () => {
  scanButton.disabled = true;
  scanButton.textContent = "Scanning…";
  setupProgress.textContent = "";
  try {
    const result = await window.roverosDesktop.scanWifiNetworks({
      fingerprint: fingerprint.value.trim(),
      pairingCode: pairingCode.value.trim(),
    });
    if (result.error) throw new Error(result.error);
    networkSelect.replaceChildren(new Option("Choose a network", ""));
    for (const network of result.networks || []) {
      const option = new Option(`${network.ssid} · ${network.security}`, network.ssid);
      networkSelect.add(option);
    }
    setupProgress.textContent = `${result.networks?.length || 0} network(s) found.`;
  } catch (error) {
    setupProgress.textContent = error.message || "Could not scan for networks.";
  } finally {
    scanButton.disabled = false;
    scanButton.textContent = "Scan Wi-Fi";
  }
});

networkSelect.addEventListener("change", () => {
  if (networkSelect.value) ssid.value = networkSelect.value;
});

wifiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const connectButton = document.querySelector("#connect-button");
  connectButton.disabled = true;
  setupProgress.textContent = "Sending Wi-Fi settings securely…";
  try {
    const result = await window.roverosDesktop.submitWifiSettings({
      fingerprint: fingerprint.value.trim(),
      pairingCode: pairingCode.value.trim(),
      ssid: ssid.value,
      password: wifiPassword.value,
      hidden: hiddenNetwork.checked,
    });
    if (result.error) throw new Error(result.error);
    wifiPassword.value = "";
    setupProgress.textContent =
      "MiniPC is connecting to Wi-Fi and installing RoverOS. If this PC loses the setup network, join the selected Wi-Fi and reopen RoverOS.";
    void pollProvisioning();
  } catch (error) {
    setupProgress.textContent = error.message || "Could not send Wi-Fi settings.";
  } finally {
    connectButton.disabled = false;
  }
});

async function pollProvisioning() {
  if (polling) return;
  polling = true;
  try {
    for (let attempt = 0; attempt < 720; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const result = await window.roverosDesktop.getProvisioningStatus();
      if (result.state === "ready") {
        setupProgress.textContent = "RoverOS setup is complete. Connecting…";
        await new Promise((resolve) => setTimeout(resolve, 4000));
        await searchForServer();
        return;
      }
      if (result.state === "failed") {
        setupProgress.textContent =
          `${result.message || "Setup could not finish."} Check the MiniPC connection and retry.`;
        return;
      }
      setupProgress.textContent = result.message || "Setting up RoverOS…";
    }
  } finally {
    polling = false;
  }
}

searchButton.addEventListener("click", searchForServer);

window.roverosDesktop.getSetupState().then((state) => {
  if (state.error) showStatus(state.error, "error");
  void searchForServer();
});
