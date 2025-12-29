import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, MapPin, Trash2, Play, Pause, RotateCcw } from 'lucide-react';
import { useRoverData } from '@/lib/mockData';

interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  description?: string;
}

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
      name: newWaypointName || `Waypoint ${waypoints.length}`,
      description: ''
    };
    setWaypoints([...waypoints, newWaypoint]);
    setNewWaypointName('');
  };

  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter(wp => wp.id !== id));
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
        <div className="col-span-8 hud-panel p-4 h-[600px] relative">
          <h2 className="text-sm font-display text-primary mb-3">MISSION MAP</h2>
          <div ref={mapRef} className="w-full h-[calc(100%-3rem)] bg-black/50 border border-primary/20 rounded flex items-center justify-center relative">
            {/* Map Placeholder - Leaflet would render here */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4">
              <div className="text-center">
                <div className="text-4xl font-display text-primary/30 mb-2">🗺️</div>
                <p className="text-sm text-muted-foreground font-mono">
                  Leaflet Map Integration Ready
                </p>
                <p className="text-xs text-muted-foreground/50 mt-2">
                  Current Position: {data.gps.lat.toFixed(4)}°, {data.gps.lng.toFixed(4)}°
                </p>
              </div>

              {/* Simple waypoint visualization */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                {waypoints.map((wp, idx) => (
                  <div key={wp.id} className="text-xs p-2 bg-primary/10 border border-primary/30 rounded">
                    <div className="text-primary font-bold">{idx + 1}</div>
                    <div className="text-muted-foreground">{wp.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute top-8 right-4 flex gap-2 z-10">
            <Button size="sm" className="text-xs">+</Button>
            <Button size="sm" className="text-xs">−</Button>
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
            <h3 className="font-display text-sm text-primary mb-3">WAYPOINTS ({waypoints.length})</h3>
            <div className="space-y-2">
              {waypoints.map((wp, idx) => (
                <div
                  key={wp.id}
                  className={`p-3 border rounded text-xs font-mono cursor-pointer transition-all ${
                    idx === currentWaypoint
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card/50 text-muted-foreground hover:border-primary/50'
                  }`}
                  onClick={() => setCurrentWaypoint(idx)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-foreground">{idx + 1}. {wp.name}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-1">
                        {wp.lat.toFixed(4)}° {wp.lng.toFixed(4)}°
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 w-6 p-0"
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
