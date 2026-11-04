import { Capacitor, registerPlugin } from "@capacitor/core";

interface RoverProvisioningPlugin {
  request(options: {
    url: string;
    fingerprint: string;
    pairingCode: string;
    method: "GET" | "POST";
    body?: string;
  }): Promise<{ status: number; body: string }>;
}

interface ProvisioningResponse {
  networks?: Array<{ ssid: string; security: string; signal: number }>;
  accepted?: boolean;
  error?: string;
  message?: string;
}

const RoverProvisioning =
  registerPlugin<RoverProvisioningPlugin>("RoverProvisioning");
const ALLOWED_PATHS = new Set([
  "/api/provisioning/networks",
  "/api/provisioning/wifi",
  "/api/provisioning/retry",
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)
  ) return false;
  const [first, second] = parts.map(Number);
  return first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254);
}

export async function requestSecureProvisioning(
  serverUrl: string,
  fingerprint: string,
  pairingCode: string,
  path: string,
  method: "GET" | "POST",
  payload?: Record<string, unknown>,
): Promise<ProvisioningResponse> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Secure first-run setup is available in the installed RoverOS app.");
  }
  if (!ALLOWED_PATHS.has(path)) throw new Error("Invalid RoverOS setup request.");

  const server = new URL(serverUrl);
  if (server.protocol !== "http:" && server.protocol !== "https:") {
    throw new Error("Invalid MiniPC setup address.");
  }
  if (!isPrivateIpv4(server.hostname)) {
    throw new Error("Secure first-run setup requires the MiniPC's private network address. Search for RoverOS-Server again.");
  }
  const normalizedFingerprint = fingerprint.replace(/:/g, "").trim().toLowerCase();
  const normalizedPairingCode = pairingCode.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedFingerprint)) {
    throw new Error("Enter the 64-character SHA-256 certificate fingerprint from the MiniPC.");
  }
  if (!/^[a-f0-9]{32}$/.test(normalizedPairingCode)) {
    throw new Error("Enter the 32-character one-time pairing code from the MiniPC.");
  }

  server.protocol = "https:";
  server.port = "5443";
  server.pathname = path;
  server.search = "";
  server.hash = "";

  const result = await RoverProvisioning.request({
    url: server.toString(),
    fingerprint: normalizedFingerprint,
    pairingCode: normalizedPairingCode,
    method,
    body: payload ? JSON.stringify(payload) : "",
  });
  let body: ProvisioningResponse = {};
  try {
    body = JSON.parse(result.body) as ProvisioningResponse;
  } catch {
    throw new Error("MiniPC returned an invalid setup response.");
  }
  if (result.status < 200 || result.status >= 300) {
    throw new Error(body.message || body.error || `MiniPC returned HTTP ${result.status}.`);
  }
  if (path === "/api/provisioning/networks" && !Array.isArray(body.networks)) {
    throw new Error("MiniPC returned an invalid Wi-Fi network list.");
  }
  if (path === "/api/provisioning/networks" &&
    body.networks?.some((network) =>
      !network || typeof network.ssid !== "string" ||
      typeof network.security !== "string" ||
      typeof network.signal !== "number" || !Number.isFinite(network.signal)
    )) {
    throw new Error("MiniPC returned an invalid Wi-Fi network list.");
  }
  if (path !== "/api/provisioning/networks" && body.accepted !== true) {
    throw new Error(body.message || "MiniPC did not accept the setup request.");
  }
  return body;
}
