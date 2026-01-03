import { GoogleMap, LoadScript, Marker, Circle } from '@react-google-maps/api';
import { useQuery } from '@tanstack/react-query';
import { getConfig } from '@/lib/api';
import { useLocation } from '@/hooks/useLocation';
import { MapPin, Loader2, AlertCircle, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoverLocationMapProps {
  roverLat?: number;
  roverLng?: number;
  height?: string;
  showUserLocation?: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a9eff' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2d2d44' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a1a2e' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0d1b2a' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a2e' }],
  },
];

export default function RoverLocationMap({
  roverLat,
  roverLng,
  height = '200px',
  showUserLocation = false,
}: RoverLocationMapProps) {
  const { data: apiKeyConfig, isLoading: apiKeyLoading } = useQuery({
    queryKey: ['config', 'google_maps_api_key'],
    queryFn: async () => {
      try {
        return await getConfig('google_maps_api_key');
      } catch {
        return null;
      }
    },
  });

  const location = useLocation(true);
  const mapApiKey = apiKeyConfig?.value || '';

  const lat = roverLat ?? location.latitude ?? 34.0522;
  const lng = roverLng ?? location.longitude ?? -118.2437;
  const hasValidLocation = (roverLat !== undefined && roverLng !== undefined) || 
                           (location.latitude !== null && location.longitude !== null);

  if (apiKeyLoading || location.loading) {
    return (
      <div 
        className="bg-black/50 border border-border rounded flex items-center justify-center"
        style={{ height }}
        data-testid="rover-map-loading"
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs font-mono">ACQUIRING GPS...</span>
        </div>
      </div>
    );
  }

  if (!mapApiKey) {
    return (
      <div 
        className="bg-black/50 border border-border rounded flex items-center justify-center"
        style={{ height }}
        data-testid="rover-map-no-key"
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
          <MapPin className="w-6 h-6 text-yellow-500" />
          <span className="text-xs font-mono text-center">
            GPS: {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            Map requires API key
          </span>
        </div>
      </div>
    );
  }

  if (location.error && !hasValidLocation) {
    return (
      <div 
        className="bg-black/50 border border-border rounded flex items-center justify-center"
        style={{ height }}
        data-testid="rover-map-error"
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <span className="text-xs font-mono text-center">{location.error}</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={location.requestPermission}
            className="text-xs"
            data-testid="btn-request-location"
          >
            <LocateFixed className="w-3 h-3 mr-1" />
            Enable Location
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="rounded overflow-hidden border border-border relative"
      style={{ height }}
      data-testid="rover-map-container"
    >
      <LoadScript googleMapsApiKey={mapApiKey}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={{ lat, lng }}
          zoom={17}
          options={{
            styles: darkMapStyle,
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          <Marker
            position={{ lat, lng }}
            icon={{
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              fillColor: '#00ff88',
              fillOpacity: 1,
              strokeColor: '#004422',
              strokeWeight: 2,
              scale: 6,
              rotation: location.heading || 0,
            }}
          />
          
          {location.accuracy && (
            <Circle
              center={{ lat, lng }}
              radius={location.accuracy}
              options={{
                fillColor: '#00ff88',
                fillOpacity: 0.1,
                strokeColor: '#00ff88',
                strokeOpacity: 0.3,
                strokeWeight: 1,
              }}
            />
          )}

          {showUserLocation && location.latitude && location.longitude && 
           (location.latitude !== lat || location.longitude !== lng) && (
            <Marker
              position={{ lat: location.latitude, lng: location.longitude }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#4a9eff',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 6,
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>

      <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-green-400">
        {lat.toFixed(6)}, {lng.toFixed(6)}
      </div>

      {location.accuracy && (
        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-[10px] font-mono text-cyan-400">
          ±{location.accuracy.toFixed(0)}m
        </div>
      )}
    </div>
  );
}
