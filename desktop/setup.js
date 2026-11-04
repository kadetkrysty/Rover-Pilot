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
const connectButton = document.querySelector("#connect-button");

const ACTIVE_STATES = new Set(["wifi_connecting", "installing"]);
const VALID_STATES = new Set(["setup_required", "wifi_connecting", "installing", "failed", "ready"]);
let searching = false;
let scanning = false;
let submitting = false;
let polling = false;
let pollAgain = false;
let setupStarted = false;
let currentProvisioningState = "";
let reconnecting = false;

function showStatus(message, state = "searching") {
  status.textContent = message;
  status.dataset.state = state;
}

function showProgress(message, state = "working") {
  setupProgress.textContent = message;
  setupProgress.dataset.state = state;
}

function messageFrom(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isStatus(value) {
  return Boolean(value && typeof value === "object" &&
    VALID_STATES.has(value.state) &&
    typeof value.message === "string" &&
    typeof value.progress === "number");
}

function updateProgress(value) {
  if (!isStatus(value)) {
    showProgress("MiniPC returned an invalid setup status. Search again to reconnect.", "error");
    return;
  }
  currentProvisioningState = value.state;
  connectButton.textContent = value.state === "failed"
    ? "Retry Wi-Fi setup"
    : value.state === "ready"
      ? "RoverOS is ready"
      : ACTIVE_STATES.has(value.state)
        ? "Setup in progress"
        : "Connect and install RoverOS";
  setFormDisabled(ACTIVE_STATES.has(value.state) || value.state === "ready");
  if (value.state === "failed") {
    showProgress(`${value.message || "Setup could not finish."} Check the Wi-Fi details and retry.`, "error");
    setFormDisabled(false);
    return;
  }
  if (value.state === "ready") {
    showProgress("Installation is complete. Waiting for the normal RoverOS service to return…");
    return;
  }
  const stage = value.stage ? `${value.stage}: ` : "";
  showProgress(value.message || `${stage}RoverOS is setting up…`);
}

function setFormDisabled(disabled) {
  for (const control of [fingerprint, pairingCode, scanButton, networkSelect, ssid, wifiPassword, hiddenNetwork, connectButton]) {
    control.disabled = disabled;
  }
  scanButton.disabled = disabled || scanning;
  connectButton.disabled = disabled || submitting || currentProvisioningState === "ready";
}

function canUseCredentials() {
  return /^[\da-f]{64}$/i.test(fingerprint.value.trim().replace(/:/g, "")) &&
    /^[\da-f]{32}$/i.test(pairingCode.value.trim());
}

async function searchForServer() {
  if (searching) return null;
  searching = true;
  searchButton.disabled = true;
  searchButton.textContent = "Searching…";
  showStatus("Searching for RoverOS-Server on this network…");

  try {
    const result = await window.roverosDesktop.searchForServer();
    if (result?.setupRequired) {
      provisioningPanel.hidden = false;
      showStatus("MiniPC found. Complete or resume its first-time setup below.");
      const current = result.status;
      if (isStatus(current)) {
        updateProgress(current);
        if (ACTIVE_STATES.has(current.state)) void pollProvisioning();
        if (current.state === "ready" && !reconnecting) void reconnectNormalService();
      } else if (result.status && result.status.error) {
        showProgress(result.status.error, "error");
      }
      return result;
    }
    if (result?.ok) {
      if (setupStarted || !provisioningPanel.hidden) {
        provisioningPanel.hidden = false;
        showProgress("RoverOS is connected and ready. This setup panel will remain available if you need to reconnect.", "success");
      } else {
        showStatus("RoverOS-Server is connected.", "success");
      }
      return result;
    }
    showStatus(result?.error || "RoverOS-Server was not found. Join its Wi-Fi or the same local network, then search again.", "error");
    return result;
  } catch (error) {
    showStatus(messageFrom(error, "RoverOS-Server was not found. Join its Wi-Fi or the same local network, then search again."), "error");
    return null;
  } finally {
    searching = false;
    searchButton.disabled = false;
    searchButton.textContent = "Search again";
  }
}

scanButton.addEventListener("click", async () => {
  if (scanning || submitting || !canUseCredentials()) return;
  scanning = true;
  scanButton.disabled = true;
  scanButton.textContent = "Scanning…";
  showProgress("");
  try {
    const result = await window.roverosDesktop.scanWifiNetworks({
      fingerprint: fingerprint.value.trim(),
      pairingCode: pairingCode.value.trim(),
    });
    if (result?.error) throw new Error(result.error);
    const found = Array.isArray(result?.networks) ? result.networks : [];
    networkSelect.replaceChildren(new Option("Choose a network", ""));
    for (const network of found) {
      if (!network || typeof network.ssid !== "string") continue;
      networkSelect.add(new Option(`${network.ssid} · ${network.security || "Wi-Fi"}`, network.ssid));
    }
    showProgress(found.length ? `${found.length} Wi-Fi network(s) found.` : "No networks found. Enter the SSID manually.", found.length ? "success" : "notice");
  } catch (error) {
    showProgress(messageFrom(error, "Could not scan for networks. Check the MiniPC connection and credentials."), "error");
  } finally {
    scanning = false;
    scanButton.disabled = false;
    scanButton.textContent = "Scan Wi-Fi";
  }
});

networkSelect.addEventListener("change", () => {
  if (networkSelect.value) ssid.value = networkSelect.value;
});

wifiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting || polling || ACTIVE_STATES.has(currentProvisioningState)) return;
  submitting = true;
  setupStarted = true;
  setFormDisabled(true);
  showProgress("Sending Wi-Fi settings securely…");
  try {
    const result = await window.roverosDesktop.submitWifiSettings({
      fingerprint: fingerprint.value.trim(),
      pairingCode: pairingCode.value.trim(),
      ssid: ssid.value,
      password: wifiPassword.value,
      hidden: hiddenNetwork.checked,
    });
    if (result?.error) throw new Error(result.error);
    if (!result || result.accepted !== true) throw new Error("MiniPC did not accept the setup request.");
    currentProvisioningState = "wifi_connecting";
    showProgress("MiniPC is joining Wi-Fi and installing RoverOS. If this PC loses the setup network, connect to the selected Wi-Fi and search again.");
    void pollProvisioning();
  } catch (error) {
    showProgress(messageFrom(error, "Could not send Wi-Fi settings. Check the MiniPC connection and try again."), "error");
  } finally {
    // Clear the password after every request attempt, including a rejected request.
    wifiPassword.value = "";
    submitting = false;
    setFormDisabled(polling || ACTIVE_STATES.has(currentProvisioningState));
  }
});

async function pollProvisioning() {
  if (polling) {
    pollAgain = true;
    return;
  }
  polling = true;
  pollAgain = false;
  setFormDisabled(true);
  try {
    // Finite, sequential polling: status requests never overlap and each run is bounded.
    for (let attempt = 0; attempt < 480; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      let result;
      try {
        result = await window.roverosDesktop.getProvisioningStatus();
      } catch (error) {
        showProgress(`${messageFrom(error, "Setup status is temporarily unavailable.")} Retrying…`, "notice");
        continue;
      }
      if (!isStatus(result)) {
        showProgress("Setup status could not be verified. Search again to reconnect or resume.", "error");
        break;
      }
      updateProgress(result);
      if (result.state === "ready") {
        await reconnectNormalService();
        return;
      }
      if (result.state === "failed" || result.state === "setup_required") {
        setFormDisabled(false);
        return;
      }
    }
    showProgress("Setup is taking longer than expected. Search again to reconnect; the installation can continue in the background.", "notice");
    setFormDisabled(false);
  } finally {
    polling = false;
    if (pollAgain) void pollProvisioning();
  }
}

async function reconnectNormalService() {
  if (reconnecting) return false;
  reconnecting = true;
  showProgress("Installation is complete. Reconnecting to the normal RoverOS service…");
  // The setup access point may disappear while .local discovery settles.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2500));
    const result = await searchForServer();
    if (result?.ok && !result.setupRequired) {
      provisioningPanel.hidden = false;
      showProgress("RoverOS is ready and connected. This panel remains open for recovery.", "success");
      setFormDisabled(false);
      reconnecting = false;
      return true;
    }
    if (result?.setupRequired && isStatus(result.status) && result.status.state !== "ready") {
      updateProgress(result.status);
      if (ACTIVE_STATES.has(result.status.state)) void pollProvisioning();
      reconnecting = false;
      return false;
    }
    showProgress("Waiting for RoverOS to reconnect. Search continues automatically; you can also press Search again.", "notice");
  }
  showProgress("RoverOS is installed but not reachable yet. Join the selected Wi-Fi network, then press Search again.", "error");
  setFormDisabled(false);
  reconnecting = false;
  return false;
}

searchButton.addEventListener("click", () => {
  void searchForServer();
});

window.roverosDesktop.getSetupState().then((state) => {
  if (state?.error) showStatus(state.error, "error");
  void searchForServer();
}).catch(() => {
  void searchForServer();
});
