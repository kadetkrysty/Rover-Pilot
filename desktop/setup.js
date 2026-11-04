const form = document.querySelector("#connection-form");
const addressInput = document.querySelector("#server-address");
const status = document.querySelector("#connection-status");
const connectButton = document.querySelector("#connect-button");

function showStatus(message) {
  status.textContent = message;
}

window.roverosDesktop.getSetupState().then((state) => {
  if (state.serverUrl) {
    addressInput.value = state.serverUrl;
  }
  if (state.error) {
    showStatus(state.error);
  }
  addressInput.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("");

  if (!addressInput.value.trim()) {
    showStatus("Enter the MiniPC address to continue.");
    addressInput.focus();
    return;
  }

  connectButton.disabled = true;
  connectButton.textContent = "Connecting…";

  try {
    const result = await window.roverosDesktop.connectToServer(addressInput.value);
    if (!result.ok) {
      showStatus(result.error || "Could not connect. Check the address and try again.");
      addressInput.focus();
    }
  } catch {
    showStatus("Could not connect. Check the address and try again.");
    addressInput.focus();
  } finally {
    connectButton.disabled = false;
    connectButton.textContent = "Connect";
  }
});
