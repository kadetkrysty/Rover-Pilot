const allowedProtocols = new Set(["http:", "https:"]);

function normalizeServerUrl(value) {
  if (typeof value !== "string") {
    throw new Error("Enter the MiniPC address.");
  }

  const input = value.trim();
  if (!input || input.length > 2048) {
    throw new Error("Enter a valid MiniPC address.");
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Enter a complete address, such as http://192.168.1.40:5000.");
  }

  if (!allowedProtocols.has(parsed.protocol)) {
    throw new Error("The address must start with http:// or https://.");
  }

  if (
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new Error("Enter only the MiniPC address and optional port, without a path or sign-in details.");
  }

  return parsed.origin;
}

module.exports = { normalizeServerUrl };
