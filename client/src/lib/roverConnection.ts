import { Capacitor, registerPlugin } from "@capacitor/core";
import { demoResponse, isDemoMode } from "./demoMode";

const ROVER_URL_KEY = "rover_api_url";
const ROVER_TOKEN_KEY = "rover_client_token";
const ROVER_FINGERPRINT_KEY = "rover_certificate_fingerprint";

interface NativeSecureApiPlugin {
  requestApi(options: {
    url: string;
    fingerprint: string;
    token?: string;
    method: string;
    body?: string;
  }): Promise<{ status: number; body: string }>;
  setServerFingerprint(options: { fingerprint: string }): Promise<void>;
}

const NativeSecureApi = registerPlugin<NativeSecureApiPlugin>("RoverProvisioning");

declare global {
  interface Window {
    roverosDesktop?: {
      startDemoMode?: () => Promise<unknown>;
      exitDemoMode?: () => Promise<unknown>;
      secureApiRequest: (options: {
        url: string;
        fingerprint: string;
        token?: string;
        method: string;
        body?: string;
      }) => Promise<{ status: number; body: string }>;
      setServerFingerprint?: (fingerprint: string) => Promise<unknown>;
    };
  }
}

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
    throw new Error("The RoverOS server URL is missing or too long.");
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("The RoverOS server URL is invalid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("The RoverOS server URL must use HTTP or HTTPS.");
  }

  if (
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  ) {
    throw new Error("The RoverOS server URL cannot contain credentials, paths, or query parameters.");
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

export interface RoverCredentials {
  fingerprint: string;
  token: string;
}

export function getRoverCredentials(): RoverCredentials | null {
  if (typeof window === "undefined") return null;
  const fingerprint = window.localStorage.getItem(ROVER_FINGERPRINT_KEY)?.replace(/:/g, "").trim().toLowerCase();
  const token = window.localStorage.getItem(ROVER_TOKEN_KEY)?.trim();
  if (!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint) || !token || !/^[a-f0-9]{64}$/i.test(token)) {
    return null;
  }
  return { fingerprint, token };
}

export async function saveRoverCredentials(credentials: RoverCredentials): Promise<void> {
  const fingerprint = credentials.fingerprint.replace(/:/g, "").trim().toLowerCase();
  const token = credentials.token.trim();
  if (!/^[a-f0-9]{64}$/.test(fingerprint) || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error("The MiniPC returned invalid paired-client credentials.");
  }
  window.localStorage.setItem(ROVER_FINGERPRINT_KEY, fingerprint);
  window.localStorage.setItem(ROVER_TOKEN_KEY, token);
  if (Capacitor.isNativePlatform()) {
    await NativeSecureApi.setServerFingerprint({ fingerprint });
  } else if (window.roverosDesktop?.setServerFingerprint) {
    await window.roverosDesktop.setServerFingerprint(fingerprint);
  }
}

export function clearRoverCredentials(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ROVER_TOKEN_KEY);
  window.localStorage.removeItem(ROVER_FINGERPRINT_KEY);
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

export function getRoverSecureApiUrl(path: string, serverUrl = getRoverUrl()): string {
  const apiPath = normalizeApiPath(path);
  const server = new URL(normalizeRoverUrl(serverUrl || window.location.origin));
  server.protocol = "https:";
  server.port = "5443";
  const parsedPath = new URL(apiPath, "http://roveros.invalid");
  server.pathname = parsedPath.pathname;
  server.search = parsedPath.search;
  server.hash = "";
  return server.toString();
}

export function roverFetch(
  path: string,
  init: RequestInit = {},
  serverUrl = getRoverUrl(),
): Promise<Response> {
  return roverSecureFetch(path, init, serverUrl);
}

export async function roverSecureFetch(
  path: string,
  init: RequestInit = {},
  serverUrl = getRoverUrl(),
  credentialsOverride?: Partial<RoverCredentials>,
): Promise<Response> {
  const apiPath = normalizeApiPath(path);
  if (isDemoMode()) return demoResponse(apiPath, init);
  const secureUrl = getRoverSecureApiUrl(apiPath, serverUrl);

  const saved = getRoverCredentials();
  const fingerprint = credentialsOverride?.fingerprint || saved?.fingerprint;
  const token = credentialsOverride?.token ?? saved?.token;
  if (!fingerprint) {
    throw new Error("Pair this client with the MiniPC before using rover controls or settings.");
  }

  const method = (init.method || "GET").toUpperCase();
  const body = typeof init.body === "string" ? init.body : undefined;
  const request = {
    url: secureUrl,
    fingerprint: fingerprint.replace(/:/g, "").toLowerCase(),
    ...(token ? { token } : {}),
    method,
    ...(body !== undefined ? { body } : {}),
  };

  let result: { status: number; body: string };
  if (Capacitor.isNativePlatform()) {
    result = await NativeSecureApi.requestApi(request);
  } else if (window.roverosDesktop) {
    result = await window.roverosDesktop.secureApiRequest(request);
  } else {
    return new Response(JSON.stringify({
      error: "Use the installed Android or Windows app for certificate-pinned secure API access.",
    }), {
      status: 426,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    [204, 205, 304].includes(result.status) ? null : result.body,
    { status: result.status, headers: { "content-type": "application/json" } },
  );
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

export function getRoverWsUrl(configuredUrl = getRoverUrl()): string {
  const server = new URL(normalizeRoverUrl(configuredUrl || window.location.origin));
  server.protocol = "wss:";
  server.port = "5443";
  server.pathname = "/ws/telemetry";
  server.search = "";
  server.hash = "";
  return server.toString();
}

export function isRoverConfigured(): boolean {
  return !!getRoverUrl();
}

export async function testRoverConnection(serverUrl: string): Promise<void> {
  const normalized = normalizeRoverUrl(serverUrl);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${normalized}/api/system/info`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(`MiniPC returned HTTP ${response.status}.`);
    }

    const identity: unknown = await response.json();
    if (
      !identity ||
      typeof identity !== "object" ||
      !("rover_name" in identity) ||
      typeof identity.rover_name !== "string" ||
      !identity.rover_name.toLowerCase().startsWith("roveros")
    ) {
      throw new Error("The discovered device did not identify itself as RoverOS.");
    }
  } finally {
    window.clearTimeout(timeout);
  }
}
