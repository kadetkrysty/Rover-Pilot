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
  server.protocol = "https:";
  server.port = "5443";
  server.pathname = path;
  server.search = "";
  server.hash = "";

  const result = await RoverProvisioning.request({
    url: server.toString(),
    fingerprint,
    pairingCode,
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
  return body;
}
