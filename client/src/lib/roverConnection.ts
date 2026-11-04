const ROVER_URL_KEY = "rover_api_url";

function normalizeApiPath(path: string): string {
  if (!path.startsWith("/api/") || path.startsWith("//")) {
    throw new Error("RoverOS API paths must begin with /api/.");
  }

  const url = new URL(path, "http://roveros.invalid");
  if (
    url.origin !== "http://roveros.invalid" ||
    !url.pathname.startsWith("/api/") ||
    url.hash
  ) {
    throw new Error("RoverOS API requests must stay under /api/.");
  }
  return `${url.pathname}${url.search}`;
}

export function normalizeRoverUrl(value: string): string {
  const input = value.trim();
  if (!input || input.length > 2048) {
    throw new Error("Enter the MiniPC address.");
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Enter a complete address, such as http://192.168.1.40:5000.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
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

  if (!parsed.port) parsed.port = "5000";
  return parsed.origin;
}

export function getRoverUrl(): string {
  if (typeof window === "undefined") return "";

  try {
    const saved = window.localStorage.getItem(ROVER_URL_KEY);
    if (!saved) return "";
    return normalizeRoverUrl(saved);
  } catch {
    try {
      window.localStorage.removeItem(ROVER_URL_KEY);
    } catch {
      // Storage can be unavailable in restricted WebViews; treat it as unconfigured.
    }
    return "";
  }
}

export function setRoverUrl(url: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeRoverUrl(url);
  window.localStorage.setItem(ROVER_URL_KEY, normalized);
}

export function getRoverApiUrl(path: string, serverUrl = getRoverUrl()): string {
  const apiPath = normalizeApiPath(path);

  if (!serverUrl) return apiPath;

  const base = normalizeRoverUrl(serverUrl);
  const url = new URL(apiPath, `${base}/`);
  if (url.origin !== base) {
    throw new Error("RoverOS API request must stay on the configured MiniPC.");
  }
  return url.toString();
}

export function roverFetch(
  path: string,
  init: RequestInit = {},
  serverUrl = getRoverUrl(),
): Promise<Response> {
  return fetch(getRoverApiUrl(path, serverUrl), {
    credentials: "include",
    ...init,
  });
}

export function getRoverServiceUrl(path: string, port: number): string {
  const apiPath = normalizeApiPath(path);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid RoverOS service port.");
  }

  const configuredUrl = getRoverUrl();
  if (!configuredUrl) return `http://localhost:${port}${path}`;

  const serviceUrl = new URL(configuredUrl);
  serviceUrl.protocol = "http:";
  serviceUrl.port = String(port);
  const parsedPath = new URL(apiPath, "http://roveros.invalid");
  serviceUrl.pathname = parsedPath.pathname;
  serviceUrl.search = parsedPath.search;
  serviceUrl.hash = "";
  return serviceUrl.toString();
}

export function getRoverWsUrl(): string {
  const configuredUrl = getRoverUrl();
  if (configuredUrl) {
    const server = new URL(configuredUrl);
    const protocol = server.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${server.host}/ws/telemetry`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/telemetry`;
}

export function isRoverConfigured(): boolean {
  return !!getRoverUrl();
}

export async function testRoverConnection(serverUrl: string): Promise<void> {
  const normalized = normalizeRoverUrl(serverUrl);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await roverFetch(
      "/api/system/info",
      { signal: controller.signal, cache: "no-store" },
      normalized,
    );
    if (!response.ok) {
      throw new Error(`MiniPC returned HTTP ${response.status}.`);
    }
  } finally {
    window.clearTimeout(timeout);
  }
}
