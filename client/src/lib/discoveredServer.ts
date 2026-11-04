export interface RoverServerCandidate {
  serviceName: unknown;
  serviceType: unknown;
  host: unknown;
  port: unknown;
  marker: unknown;
}

function isLocalIpv4(value: string): boolean {
  const parts = value.split(".");
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)
  ) {
    return false;
  }

  const [first, second] = parts.map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

export function getDiscoveredRoverUrl(candidate: unknown): string | null {
  if (!candidate || typeof candidate !== "object") return null;

  const service = candidate as RoverServerCandidate;
  if (
    typeof service.serviceName !== "string" ||
    service.serviceName.toLowerCase() !== "roveros-server" ||
    typeof service.serviceType !== "string" ||
    !service.serviceType.toLowerCase().startsWith("_http._tcp") ||
    service.port !== 5000 ||
    service.marker !== "1" ||
    typeof service.host !== "string" ||
    !isLocalIpv4(service.host)
  ) {
    return null;
  }

  return `http://${service.host}:5000`;
}
