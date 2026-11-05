import { useLocation } from "@/hooks/useLocation";
import { useMapsConfig } from "@/lib/mapsConfig";
import { isDemoMode } from "@/lib/demoMode";
import OpenStreetMap from "@/components/OpenStreetMap";

interface RoverLocationMapProps {
  roverLat?: number;
  roverLng?: number;
  height?: string;
  showUserLocation?: boolean;
}

export default function RoverLocationMap({ roverLat, roverLng, height = "200px", showUserLocation = false }: RoverLocationMapProps) {
  const maps = useMapsConfig();
  const hasRover = roverLat !== undefined && roverLng !== undefined &&
    Number.isFinite(roverLat) && Number.isFinite(roverLng) && Math.abs(roverLat) <= 90 && Math.abs(roverLng) <= 180;
  const location = useLocation(!hasRover || showUserLocation);
  const lat = hasRover ? roverLat! : location.latitude;
  const lng = hasRover ? roverLng! : location.longitude;
  if (isDemoMode()) return <div style={{ height }} className="relative overflow-hidden bg-background border border-primary/20" data-testid="demo-offline-map">
    <svg viewBox="0 0 300 200" className="w-full h-full" role="img" aria-label="Offline sample rover route, not a live map">
      <defs><pattern id="demo-map-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#00ffff" strokeOpacity=".12" /></pattern></defs>
      <rect width="300" height="200" fill="url(#demo-map-grid)" />
      <path d="M40 150L90 130L115 75L190 95L245 45" fill="none" stroke="#00ffff" strokeWidth="2" strokeDasharray="6 5" />
      <circle cx="115" cy="75" r="8" fill="#00ffff" /><circle cx="115" cy="75" r="22" fill="none" stroke="#00ffff" strokeOpacity=".4" />
      <text x="12" y="185" fill="#9faec3" fontSize="10" fontFamily="monospace">OFFLINE SAMPLE MAP · 34.0522, -118.2437</text>
    </svg>
  </div>;
  const status = maps.isLoading ? "Loading MiniPC map settings…" : maps.error ? maps.error.message :
    !maps.data?.tilesEnabled ? "Live map tiles are disabled by the owner." :
    lat === null || lng === null ? (location.error || "Waiting for GPS location…") : null;
  if (status || !maps.data || lat === null || lng === null) return <div style={{ height }} className="flex flex-col items-center justify-center gap-2 border border-border bg-black/30 p-4 text-center text-xs text-muted-foreground" role="status">
    <span>{status}</span>
    {!hasRover && location.error && <button type="button" onClick={location.requestPermission} className="min-h-11 text-primary underline">Enable client location</button>}
    <a href="/settings/maps" className="text-primary underline">Map Settings</a>
  </div>;
  return <div style={{ height }} className="relative overflow-hidden border border-border" data-testid="rover-map-container">
    <OpenStreetMap tileUrl={maps.data.tileUrl} tileAttribution={maps.data.tileAttribution} rover={{ lat, lng, heading: location.heading ?? undefined }}
      accuracy={!hasRover ? location.accuracy ?? undefined : undefined} followRover
      user={showUserLocation && location.latitude !== null && location.longitude !== null ? { lat: location.latitude, lng: location.longitude } : undefined} />
  </div>;
}
