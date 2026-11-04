const status = document.querySelector("#connection-status");
const searchButton = document.querySelector("#search-button");

function showStatus(message, state = "searching") {
  status.textContent = message;
  status.dataset.state = state;
}

async function searchForServer() {
  searchButton.disabled = true;
  searchButton.textContent = "Searching…";
  showStatus("Searching for RoverOS-Server…");

  try {
    const result = await window.roverosDesktop.searchForServer();
    if (!result.ok) {
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

searchButton.addEventListener("click", searchForServer);

window.roverosDesktop.getSetupState().then((state) => {
  if (state.error) showStatus(state.error, "error");
  void searchForServer();
});
