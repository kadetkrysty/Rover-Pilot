import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MapPin, Trash2, Play, Pause, RotateCcw, Search, Key, Save } from 'lucide-react';
import { useRoverData } from '@/lib/mockData';
import { GoogleMap, LoadScript, Marker, Polyline, Autocomplete } from '@react-google-maps/api';

interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  description?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 34.0522,
  lng: -118.2437
};

const libraries: ("places")[] = ["places"];

export default function Navigation() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: '1', lat: 34.0522, lng: -118.2437, name: 'Start', description: 'Rover starting position' },
    { id: '2', lat: 34.0525, lng: -118.2435, name: 'Checkpoint 1', description: 'Rock formation' },
    { id: '3', lat: 34.0528, lng: -118.2440, name: 'End Point', description: 'Final destination' }
  ]);
  const [newWaypointName, setNewWaypointName] = useState('');
  const [navigationMode, setNavigationMode] = useState<'MANUAL' | 'WAYPOINT' | 'AUTONOMOUS'>('MANUAL');
  const [currentWaypoint, setCurrentWaypoint] = useState(0);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState('--:--');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  // Google Maps State
  const [mapApiKey, setMapApiKey] = useState(() => localStorage.getItem('google_maps_api_key') || '');
  const [tempApiKey, setTempApiKey] = useState('');
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  
  const data = useRoverData();
  const mapRef = useRef<HTMLDivElement>(null);

  // Calculate distance between two GPS points (Haversine)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Convert to meters
  };

  // Update distance and ETA
  useEffect(() => {
    if (waypoints.length > currentWaypoint) {
      const wp = waypoints[currentWaypoint];
      const dist = calculateDistance(data.gps.lat, data.gps.lng, wp.lat, wp.lng);
      setDistance(dist);

      // Calculate ETA based on current speed
      if (data.speed > 0) {
        const timeMinutes = (dist / 1000) / (data.speed / 3.6); // Convert speed km/h to m/s
        const minutes = Math.floor(timeMinutes);
        const seconds = Math.floor((timeMinutes - minutes) * 60);
        setEta(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }
  }, [data.gps, waypoints, currentWaypoint]);

  const addWaypoint = (lat: number, lng: number) => {
    const newWaypoint: Waypoint = {
      id: Date.now().toString(),
      lat,
      lng,
      name: newWaypointName || `Waypoint ${waypoints.length + 1}`,
      description: ''
    };
    setWaypoints([...waypoints, newWaypoint]);
    setNewWaypointName('');
  };

  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter(wp => wp.id !== id));
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault(); // Critical for onDrop to fire
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const draggedIndex = waypoints.findIndex(wp => wp.id === draggedId);
    const targetIndex = waypoints.findIndex(wp => wp.id === targetId);

    const newWaypoints = [...waypoints];
    const [draggedItem] = newWaypoints.splice(draggedIndex, 1);
    newWaypoints.splice(targetIndex, 0, draggedItem);

    setWaypoints(newWaypoints);
    setDraggedId(null);
    setDragOverId(null);
  };

  const startNavigation = () => {
    if (waypoints.length > 0) {
      setNavigationMode('WAYPOINT');
      setCurrentWaypoint(0);
    }
  };

  const calculateTotalDistance = () => {
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      total += calculateDistance(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
    }
    return (total / 1000).toFixed(2); // Convert to km
  };

  // Google Maps Handlers
  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      // Small delay to prevent conflict if clicking a marker
      setTimeout(() => {
        addWaypoint(e.latLng!.lat(), e.latLng!.lng());
      }, 100);
    }
  };

  const onAutocompleteLoad = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        map?.panTo({ lat, lng });
        map?.setZoom(16);
        
        setNewWaypointName(place.name || '');
        // Don't auto-add, let user verify location or click map
        // addWaypoint(lat, lng); 
      }
    }
  };

  const saveApiKey = () => {
    if (tempApiKey.trim()) {
      localStorage.setItem('google_maps_api_key', tempApiKey.trim());
      setMapApiKey(tempApiKey.trim());
    }
  };

  const clearApiKey = () => {
    localStorage.removeItem('google_maps_api_key');
    setMapApiKey('');
    setTempApiKey('');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6">
      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">WAYPOINT NAVIGATION</h1>
          <p className="text-muted-foreground font-mono mt-1">Route planning with GPS-based autonomous navigation</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="font-mono">
            <ArrowLeft className="w-4 h-4 mr-2" /> RETURN TO HUD
          </Button>
        </Link>
      </header>

      {/* Summary Panels */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="hud-panel p-4 text-center">
          <div className="text-xs font-display text-primary/50 mb-2">TOTAL DISTANCE</div>
          <div className="text-3xl font-mono font-bold text-primary">{calculateTotalDistance()}</div>
          <div className="text-xs text-muted-foreground">km</div>
        </div>
        <div className="hud-panel p-4 text-center">
          <div className="text-xs font-display text-primary/50 mb-2">WAYPOINTS</div>
          <div className="text-3xl font-mono font-bold text-secondary">{waypoints.length}</div>
          <div className="text-xs text-muted-foreground">ACTIVE</div>
        </div>
        <div className="hud-panel p-4 text-center">
          <div className="text-xs font-display text-primary/50 mb-2">AVG SPEED</div>
          <div className="text-3xl font-mono font-bold text-accent">{data.speed.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">km/h</div>
        </div>
        <div className="hud-panel p-4 text-center">
          <div className="text-xs font-display text-primary/50 mb-2">CURRENT BEARING</div>
          <div className="text-3xl font-mono font-bold text-cyan-400">{Math.floor(data.heading)}°</div>
          <div className="text-xs text-muted-foreground">HEADING</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Map Area */}
        <div className="col-span-8 hud-panel p-4 h-[600px] relative flex flex-col">
          <div className="flex justify-between items-center mb-3">
             <h2 className="text-sm font-display text-primary">MISSION MAP</h2>
             {mapApiKey && (
                 <Button variant="ghost" size="sm" onClick={clearApiKey} className="h-6 text-[10px] text-muted-foreground hover:text-destructive">
                     CHANGE API KEY
                 </Button>
             )}
          </div>
          
          <div className="flex-1 bg-black/50 border border-primary/20 rounded overflow-hidden relative">
            {!mapApiKey ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-background/90 z-20">
                    <Key className="w-12 h-12 text-primary mb-4" />
                    <h3 className="text-xl font-display text-foreground mb-2">GOOGLE MAPS API KEY REQUIRED</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md">
                        To enable satellite navigation and POI search, please enter your Google Maps API Key. 
                        This key is stored locally in your browser.
                    </p>
                    <div className="flex gap-2 w-full max-w-sm">
                        <Input 
                            type="password" 
                            placeholder="Enter API Key (AIza...)" 
                            value={tempApiKey}
                            onChange={(e) => setTempApiKey(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <Button onClick={saveApiKey} disabled={!tempApiKey}>
                            <Save className="w-4 h-4 mr-2" /> SAVE
                        </Button>
                    </div>
                </div>
            ) : (
                <LoadScript googleMapsApiKey={mapApiKey} libraries={libraries}>
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={defaultCenter}
                        zoom={18}
                        onLoad={onMapLoad}
                        onUnmount={onUnmount}
                        onClick={onMapClick}
                        options={{
                            mapTypeId: 'hybrid',
                            disableDefaultUI: false,
                            streetViewControl: false,
                            mapTypeControl: false,
                            styles: [
                                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                                { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                                { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                                { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
                                { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
                                { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                                { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
                                { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
                                { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
                                { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
                                { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
                                { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
                                { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                                { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                                { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
                                { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
                            ]
                        }}
                    >
                        {/* Search Box */}
                        <div className="absolute top-2 left-2 right-14 z-10">
                            <Autocomplete
                                onLoad={onAutocompleteLoad}
                                onPlaceChanged={onPlaceChanged}
                            >
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search for a location or POI..."
                                        className="w-full h-10 pl-9 pr-4 rounded-md border border-input bg-background/90 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono shadow-md"
                                    />
                                </div>
                            </Autocomplete>
                        </div>

                        {/* Rover Position Marker */}
                        {map && (
                        <Marker
                            position={{ lat: data.gps.lat, lng: data.gps.lng }}
                            icon={{
                                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                scale: 6,
                                fillColor: "#00ff00",
                                fillOpacity: 1,
                                strokeWeight: 2,
                                rotation: data.heading
                            }}
                        />
                        )}

                        {/* Waypoints */}
                        {waypoints.map((wp, idx) => (
                            <Marker
                                key={wp.id}
                                position={{ lat: wp.lat, lng: wp.lng }}
                                label={{
                                    text: (idx + 1).toString(),
                                    color: "white",
                                    fontWeight: "bold"
                                }}
                            />
                        ))}

                        {/* Path Polyline */}
                        <Polyline
                            path={[
                                { lat: data.gps.lat, lng: data.gps.lng },
                                ...waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng }))
                            ]}
                            options={{
                                strokeColor: "#0ea5e9", // Cyan color
                                strokeOpacity: 0.8,
                                strokeWeight: 4,
                                geodesic: true,
                            }}
                        />
                    </GoogleMap>
                </LoadScript>
            )}
          </div>
        </div>

        {/* Navigation Panel */}
        <div className="col-span-4 space-y-4">
          {/* Status */}
          <div className="hud-panel p-4">
            <h3 className="font-display text-sm text-primary mb-4">NAVIGATION STATUS</h3>
            <div className="space-y-3 font-mono text-sm">
              <div>
                <div className="text-xs text-muted-foreground">MODE</div>
                <div className="text-lg text-foreground font-bold">{navigationMode}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">CURRENT WAYPOINT</div>
                <div className="text-lg text-foreground font-bold">
                  {currentWaypoint + 1} / {waypoints.length}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">DISTANCE TO TARGET</div>
                <div className="text-lg text-foreground font-bold">{distance.toFixed(0)} m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">ETA</div>
                <div className="text-lg text-secondary font-bold">{eta}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">TOTAL ROUTE</div>
                <div className="text-lg text-foreground font-bold">{calculateTotalDistance()} km</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="hud-panel p-4 space-y-3">
            <h3 className="font-display text-sm text-primary">MISSION CONTROL</h3>
            <Button
              className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-mono font-bold h-10"
              onClick={startNavigation}
              disabled={waypoints.length === 0}
            >
              <Play className="w-4 h-4 mr-2" /> START NAVIGATION
            </Button>
            <Button variant="outline" className="w-full font-mono text-xs">
              <Pause className="w-3 h-3 mr-2" /> PAUSE
            </Button>
            <Button variant="destructive" className="w-full font-mono text-xs">
              <RotateCcw className="w-3 h-3 mr-2" /> ABORT MISSION
            </Button>
          </div>

          {/* Waypoints List */}
          <div className="hud-panel p-4 max-h-64 overflow-auto">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-display text-sm text-primary">WAYPOINTS ({waypoints.length})</h3>
                <span className="text-[10px] text-muted-foreground uppercase">Drag to reorder</span>
            </div>
            <div className="space-y-2">
              {waypoints.map((wp, idx) => (
                <div
                  key={wp.id}
                  draggable
                  onDragStart={() => handleDragStart(wp.id)}
                  onDragOver={(e) => handleDragOver(e, wp.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, wp.id)}
                  className={`p-3 border rounded text-xs font-mono cursor-move transition-all ${
                    draggedId === wp.id
                      ? 'opacity-50 border-primary/50'
                      : dragOverId === wp.id
                      ? 'border-primary bg-primary/20'
                      : idx === currentWaypoint
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card/50 text-muted-foreground hover:border-primary/50'
                  }`}
                  onClick={() => setCurrentWaypoint(idx)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <div className="text-primary/50 mt-0.5 cursor-grab active:cursor-grabbing">⋮⋮</div>
                      <div>
                        <div className="font-bold text-foreground">{idx + 1}. {wp.name}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-1">
                          {wp.lat.toFixed(4)}° {wp.lng.toFixed(4)}°
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWaypoint(wp.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Waypoint */}
          <div className="hud-panel p-4 space-y-3">
            <h3 className="font-display text-sm text-primary">ADD WAYPOINT</h3>
            <p className="text-[10px] text-muted-foreground">Click map or use search to add points</p>
            <div>
              <Label className="text-xs font-mono uppercase text-primary/70">Name</Label>
              <Input
                value={newWaypointName}
                onChange={(e) => setNewWaypointName(e.target.value)}
                placeholder="e.g., Rock Formation"
                className="bg-background/50 border-primary/30 text-sm mt-1"
              />
            </div>
            <Button
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-mono text-xs h-9"
              onClick={() => addWaypoint(data.gps.lat + 0.0005, data.gps.lng + 0.0005)}
            >
              <MapPin className="w-3 h-3 mr-2" /> ADD CURRENT POSITION
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
