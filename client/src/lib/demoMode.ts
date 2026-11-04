import type { TelemetryData } from "./useWebSocket";

const DEMO_KEY = "roveros_offline_demo";
let demoActive = false;

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const search = window.location?.search || "";
  try {
    demoActive ||= window.location?.protocol === "roveros-demo:" ||
      new URLSearchParams(search).get("demo") === "1" ||
      window.sessionStorage.getItem(DEMO_KEY) === "1";
    if (demoActive) window.sessionStorage.setItem(DEMO_KEY, "1");
  } catch {
    // The URL flag still enables demo when WebView session storage is restricted.
    demoActive ||= new URLSearchParams(search).get("demo") === "1";
  }
  return demoActive;
}

export async function enterDemoMode(): Promise<void> {
  if (window.roverosDesktop?.startDemoMode) {
    await window.roverosDesktop.startDemoMode();
    return;
  }
  try { window.sessionStorage.setItem(DEMO_KEY, "1"); } catch { /* URL fallback */ }
  window.location.assign("/?demo=1");
}

export function exitDemoMode(): void {
  try { window.sessionStorage.removeItem(DEMO_KEY); } catch { /* URL fallback */ }
  if (window.roverosDesktop?.exitDemoMode) {
    void window.roverosDesktop.exitDemoMode();
  } else {
    window.location.assign("/setup");
  }
}

export function demoTelemetry(now = Date.now()): TelemetryData {
  const phase = now / 6000;
  return {
    timestamp: now,
    gps: { lat: 34.0522, lng: -118.2437, accuracy: 2, speed: 0.8 },
    imu: { heading: (phase * 6) % 360, pitch: Math.sin(phase) * 2, roll: Math.cos(phase) * 2, accelX: 0, accelY: 0, accelZ: 9.81 },
    lidar: Array.from({ length: 72 }, (_, i) => ({
      angle: i * 5, distance: 250 + Math.sin(i * 0.4 + phase) * 100,
    })),
    ultrasonic: [120, 150, 85, 200, 180],
    battery: 85,
    motorLeft: 0,
    motorRight: 0,
  };
}

export function demoResponse(path: string, init: RequestInit = {}): Response {
  const method = (init.method || "GET").toUpperCase();
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { "content-type": "application/json", "x-roveros-demo": "1" },
  });
  // Never acknowledge a real setting change or forward a control command.
  if (method !== "GET" && method !== "HEAD") {
    return json({ error: "Rover controls and settings are disabled in offline demo. No command was sent.", demo: true }, 403);
  }
  const pathname = new URL(path, "https://demo.invalid").pathname;
  if (pathname === "/api/telemetry/current" || pathname === "/api/telemetry/latest") return json(demoTelemetry());
  if (pathname === "/api/telemetry") return json([demoTelemetry()]);
  if (pathname === "/api/camera/config") return json({ streamUrl: "", snapshotUrl: "", enabled: false });
  if (pathname === "/api/system/info") return json({ rover_name: "RoverOS Offline Demo", demo: true });
  if (pathname === "/api/routes" || pathname === "/api/clients" || pathname === "/api/config") return json([]);
  if (pathname.startsWith("/api/config/")) return json({ key: pathname.slice(12), value: "", type: "string" });
  return json({ error: "This feature is unavailable in offline demo.", demo: true }, 503);
}

export function installDemoTransport(): void {
  if (!isDemoMode()) return;
  if (typeof document !== "undefined") {
    const policy = document.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "connect-src 'none'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; frame-src 'none'";
    document.head.append(policy);
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.pathname.startsWith("/api/")) {
      return demoResponse(url.pathname, { ...init, method: init.method || (input instanceof Request ? input.method : "GET") });
    }
    // Local static resources still load from the installed app; all other fetches fail closed.
    if (url.origin === window.location.origin && /^(\/assets\/|\/src\/|\/@|\/node_modules\/)/.test(url.pathname)) {
      return originalFetch(input, init);
    }
    return new Response("Unavailable in offline demo.", { status: 503 });
  };
}
