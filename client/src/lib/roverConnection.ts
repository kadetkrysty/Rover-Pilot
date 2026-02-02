const ROVER_URL_KEY = 'rover_api_url';
const DEFAULT_URL = '';

export function getRoverUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_URL;
  return localStorage.getItem(ROVER_URL_KEY) || DEFAULT_URL;
}

export function setRoverUrl(url: string): void {
  if (url) {
    localStorage.setItem(ROVER_URL_KEY, url.replace(/\/$/, ''));
  } else {
    localStorage.removeItem(ROVER_URL_KEY);
  }
}

export function getRoverApiUrl(path: string): string {
  const base = getRoverUrl();
  if (!base) return path;
  return `${base}${path}`;
}

export function getRoverWsUrl(): string {
  const base = getRoverUrl();
  if (!base) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/telemetry`;
  }
  const wsProtocol = base.startsWith('https') ? 'wss:' : 'ws:';
  // Extract host without port, then use port 5001 for WebSocket
  const hostMatch = base.match(/^https?:\/\/([^:\/]+)/);
  const host = hostMatch ? hostMatch[1] : 'localhost';
  return `${wsProtocol}//${host}:5001`;
}

export function isRoverConfigured(): boolean {
  return !!getRoverUrl();
}
