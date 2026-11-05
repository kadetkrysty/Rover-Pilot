import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Trash2, Play, Pause, RotateCcw, Search, Save, Download, Upload, Navigation2, Flag, LocateFixed } from 'lucide-react';
import { useRoverData } from '@/lib/mockData';
import type { Map as LeafletMap } from 'leaflet';
import OpenStreetMap, { type MapPoint } from '@/components/OpenStreetMap';
import { parseCoordinates } from '@shared/maps';
import { Link } from 'wouter';
import { isDemoMode } from '@/lib/demoMode';
import { useMapsConfig, searchMapAddress } from '@/lib/mapsConfig';
import RoverLocationMap from '@/components/RoverLocationMap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRoutes, createRoute, createWaypoints, getWaypoints, deleteRoute, startNavigation as apiStartNavigation } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  description?: string;
}

export default function Navigation() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [newWaypointName, setNewWaypointName] = useState('');
  const [navigationMode, setNavigationMode] = useState<'MANUAL' | 'WAYPOINT' | 'AUTONOMOUS'>('MANUAL');
  const [currentWaypoint, setCurrentWaypoint] = useState(0);
  const [distance, setDistance] = useState(0);
  const [eta, setEta] = useState('--:--');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [useCurrentLocationAsStart, setUseCurrentLocationAsStart] = useState(true);
  const [selectedEndWaypointId, setSelectedEndWaypointId] = useState<string | null>(null);
  
  // Route Save/Load State
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [currentRouteId, setCurrentRouteId] = useState<number | null>(null);
  
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [gpsCentered, setGpsCentered] = useState(false);
  
  const data = useRoverData();
  const queryClient = useQueryClient();

  const demo = isDemoMode();
  const mapsConfig = useMapsConfig();

  // Fetch saved routes
  const { data: savedRoutes = [] } = useQuery({
    queryKey: ['routes'],
    queryFn: getRoutes,
  });

  // Save route mutation
  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      if (waypoints.length === 0) {
        throw new Error('No waypoints to save');
      }

      const totalDistance = parseFloat(calculateTotalDistance());
      const route = await createRoute({
        name: routeName,
        description: routeDescription || undefined,
        totalDistance,
      });

      const waypointsToSave = waypoints.map((wp, idx) => ({
        routeId: route.id,
        name: wp.name,
        description: wp.description,
        latitude: wp.lat,
        longitude: wp.lng,
        order: idx,
      }));

      await createWaypoints(waypointsToSave);
      return route;
    },
    onSuccess: (route) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      setCurrentRouteId(route.id);
      setSaveDialogOpen(false);
      setRouteName('');
      setRouteDescription('');
      toast.success(`Route "${route.name}" saved successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to save route: ${error.message}`);
    },
  });

  // Load route mutation
  const loadRouteMutation = useMutation({
    mutationFn: async (routeId: number) => {
      const loadedWaypoints = await getWaypoints(routeId);
      return { routeId, waypoints: loadedWaypoints };
    },
    onSuccess: ({ routeId, waypoints: loadedWaypoints }) => {
      const convertedWaypoints: Waypoint[] = loadedWaypoints.map((wp) => ({
        id: wp.id.toString(),
        lat: wp.latitude,
        lng: wp.longitude,
        name: wp.name,
        description: wp.description || undefined,
      }));
      setWaypoints(convertedWaypoints);
      setCurrentRouteId(routeId);
      setCurrentWaypoint(0);
      setLoadDialogOpen(false);
      const route = savedRoutes.find(r => r.id === routeId);
      toast.success(`Route "${route?.name}" loaded successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to load route: ${error.message}`);
    },
  });

  // Delete route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: deleteRoute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success('Route deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete route: ${error.message}`);
    },
  });

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
    if (selectedEndWaypointId === id) {
      setSelectedEndWaypointId(null);
    }
  };

  const updateWaypointPosition = (id: string, lat: number, lng: number) => {
    setWaypoints(waypoints.map(wp => 
      wp.id === id ? { ...wp, lat, lng } : wp
    ));
    setCurrentRouteId(null);
  };

  const handleMarkerDragEnd = (id: string, point: MapPoint) => {
    updateWaypointPosition(id, point.lat, point.lng);
    toast.success('Waypoint position updated');
  };

  const setAsStartFromCurrentLocation = () => {
    const startWaypoint: Waypoint = {
      id: Date.now().toString(),
      lat: data.gps.lat,
      lng: data.gps.lng,
      name: 'Start (Current Location)',
      description: 'Starting point from rover current position'
    };
    setWaypoints([startWaypoint, ...waypoints]);
    setCurrentRouteId(null);
    toast.success('Added current location as start point');
  };

  const setAsEndpoint = (id: string) => {
    const waypointIndex = waypoints.findIndex(wp => wp.id === id);
    if (waypointIndex >= 0 && waypointIndex < waypoints.length - 1) {
      const waypointsToRemove = waypoints.length - waypointIndex - 1;
      const confirmed = confirm(
        `Setting this as the endpoint will remove ${waypointsToRemove} waypoint(s) after it. Continue?`
      );
      
      if (confirmed) {
        setSelectedEndWaypointId(id);
        const trimmedWaypoints = waypoints.slice(0, waypointIndex + 1);
        setWaypoints(trimmedWaypoints);
        setCurrentRouteId(null);
        toast.success('Route endpoint set');
      }
    }
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

  const startNavigation = async () => {
    if (waypoints.length === 0) {
      toast.error('No waypoints defined');
      return;
    }

    if (!currentRouteId) {
      toast.error('Please save the route first');
      setSaveDialogOpen(true);
      return;
    }

    try {
      await apiStartNavigation(currentRouteId);
      setNavigationMode('WAYPOINT');
      setCurrentWaypoint(0);
      toast.success('Navigation started');
    } catch (error) {
      toast.error('Failed to start navigation');
    }
  };

  const calculateTotalDistance = () => {
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      total += calculateDistance(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
    }
    return (total / 1000).toFixed(2); // Convert to km
  };

  const onMapLoad = useCallback((instance: LeafletMap | null) => setMap(instance), []);
  useEffect(() => {
    const { lat, lng } = data.gps;
    if (map && !gpsCentered && Number.isFinite(lat) && Number.isFinite(lng) &&
        Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
      map.setView([lat, lng], map.getZoom());
      setGpsCentered(true);
    }
  }, [map, gpsCentered, data.gps.lat, data.gps.lng]);
  const onMapClick = (point: MapPoint) => addWaypoint(point.lat, point.lng);

  // Manual search only: coordinates are local; addresses use the paired MiniPC.
  const handleManualSearch = async () => {
    if (demo || searching || !searchQuery.trim() || !map) return;
    setSearching(true);
    try {
      const coordinates = parseCoordinates(searchQuery);
      if (!coordinates && !mapsConfig.data?.searchEnabled) throw new Error("Address search is disabled. Enter latitude, longitude instead.");
      const result = coordinates ?? (await searchMapAddress(searchQuery))[0];
      if (!result) throw new Error("Location not found.");
      map.setView([result.lat, result.lng], 16);
      setNewWaypointName(result.label || searchQuery);
      toast.success('Location found — click the map to add a waypoint.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Search failed');
    } finally { setSearching(false); }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualSearch();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-6" data-testid="page-navigation">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary">WAYPOINT NAVIGATION</h1>
        <p className="text-muted-foreground font-mono mt-1">Route planning with GPS-based autonomous navigation</p>
      </div>

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
        <div className="col-span-12 lg:col-span-8 hud-panel p-4 h-[500px] sm:h-[600px] relative flex flex-col min-w-0">
          <div className="flex justify-between items-center mb-3">
             <h2 className="text-sm font-display text-primary">MISSION MAP</h2>
             <Button variant="ghost" size="sm" asChild><Link href={demo ? "/settings/maps?demo=1" : "/settings/maps"}>Map Settings</Link></Button>
          </div>
          
          <div className="flex-1 bg-black/50 border border-primary/20 rounded overflow-hidden relative">
            {demo ? (
              <div className="h-full relative" data-testid="demo-navigation-map">
                <RoverLocationMap height="100%" showUserLocation={false} />
                <p className="absolute left-2 right-2 top-2 rounded border border-primary/30 bg-background/95 p-3 text-xs leading-relaxed text-primary">
                  OFFLINE SAMPLE MAP · Live tiles and address search are disabled in Demo Mode. No API key is needed.
                </p>
              </div>
            ) : !mapsConfig.data?.tilesEnabled ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-background/90 z-20">
                    <MapPin className="w-12 h-12 text-primary mb-4" />
                    <h3 className="text-xl font-display text-foreground mb-2">{mapsConfig.isLoading ? "LOADING MAP SETTINGS" : mapsConfig.error ? "MAP SETTINGS UNAVAILABLE" : "LIVE MAPS DISABLED"}</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md">
                        {mapsConfig.error ? mapsConfig.error.message : "The owner manages OpenStreetMap settings once on the MiniPC. No Google key is required."}
                    </p>
                    <Button asChild><Link href="/settings/maps">Open Map Settings</Link></Button>
                </div>
            ) : (
                <div className="h-full flex flex-col">
                        <div className="shrink-0 border-b border-border p-2">
                            <div className="relative flex gap-1">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        aria-label="Search address or latitude, longitude"
                                        maxLength={160}
                                        placeholder={mapsConfig.data?.searchEnabled ? "Address or latitude, longitude…" : "Latitude, longitude…"}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={handleSearchKeyPress}
                                        className="w-full h-10 pl-9 pr-4 rounded-md border border-input bg-background/95 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono shadow-md"
                                        data-testid="input-search-location"
                                    />
                                </div>
                                <Button 
                                    size="sm" 
                                    onClick={handleManualSearch}
                                    aria-label="Search location"
                                    className="h-10 px-3 shadow-md"
                                    disabled={!searchQuery.trim() || searching || !map}
                                    data-testid="button-search-location"
                                >
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <p className="shrink-0 px-2 py-1 text-[10px] text-muted-foreground">Address searches are sent to Photon via the MiniPC. Click the map to add waypoints; drag markers to move them.</p>
                        <div className="flex-1 min-h-0">
                          <OpenStreetMap tileUrl={mapsConfig.data!.tileUrl} tileAttribution={mapsConfig.data!.tileAttribution}
                            rover={{ lat: data.gps.lat, lng: data.gps.lng, heading: data.heading }}
                            waypoints={waypoints} zoom={18} onReady={onMapLoad}
                            onMapClick={onMapClick} onWaypointMove={handleMarkerDragEnd} />
                        </div>
                </div>
            )}
          </div>
        </div>

        {/* Navigation Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-4 min-w-0">
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
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button
                variant="outline"
                className="font-mono text-xs h-8"
                onClick={() => setSaveDialogOpen(true)}
                disabled={waypoints.length === 0}
                data-testid="button-save-route"
              >
                <Save className="w-3 h-3 mr-1" /> SAVE ROUTE
              </Button>
              <Button
                variant="outline"
                className="font-mono text-xs h-8"
                onClick={() => setLoadDialogOpen(true)}
                data-testid="button-load-route"
              >
                <Download className="w-3 h-3 mr-1" /> LOAD ROUTE
              </Button>
            </div>
            <Button
              className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-mono font-bold h-10"
              onClick={startNavigation}
              disabled={waypoints.length === 0}
              data-testid="button-start-navigation"
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

          {/* Route Settings */}
          <div className="hud-panel p-4 space-y-3">
            <h3 className="font-display text-sm text-primary">ROUTE SETTINGS</h3>
            <Button
              variant="outline"
              className="w-full font-mono text-xs h-8 justify-start"
              onClick={setAsStartFromCurrentLocation}
              data-testid="button-set-start-current"
            >
              <LocateFixed className="w-3 h-3 mr-2 text-green-500" /> SET CURRENT LOCATION AS START
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Drag map pins to adjust waypoint positions. First waypoint (green) is start, last waypoint (red) is end.
            </p>
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
                        <div className="font-bold text-foreground flex items-center gap-2">
                          {idx === 0 && <span className="text-green-500 text-[10px]">START</span>}
                          {idx === waypoints.length - 1 && waypoints.length > 1 && <span className="text-red-500 text-[10px]">END</span>}
                          {idx + 1}. {wp.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground/70 mt-1">
                          {wp.lat.toFixed(4)}° {wp.lng.toFixed(4)}°
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {idx < waypoints.length - 1 && waypoints.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAsEndpoint(wp.id);
                          }}
                          title="Set as route endpoint"
                          data-testid={`button-set-endpoint-${wp.id}`}
                        >
                          <Flag className="w-3 h-3 text-red-500" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeWaypoint(wp.id);
                        }}
                        data-testid={`button-delete-waypoint-${wp.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
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

      {/* Save Route Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Save Route</DialogTitle>
            <DialogDescription>
              Save this route with {waypoints.length} waypoints for later use
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="route-name" className="text-sm font-mono">Route Name</Label>
              <Input
                id="route-name"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g., Campus Tour Route"
                className="mt-1"
                data-testid="input-route-name"
              />
            </div>
            <div>
              <Label htmlFor="route-description" className="text-sm font-mono">Description (optional)</Label>
              <Input
                id="route-description"
                value={routeDescription}
                onChange={(e) => setRouteDescription(e.target.value)}
                placeholder="Add notes about this route"
                className="mt-1"
                data-testid="input-route-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} data-testid="button-cancel-save">
              Cancel
            </Button>
            <Button
              onClick={() => saveRouteMutation.mutate()}
              disabled={!routeName.trim() || saveRouteMutation.isPending}
              data-testid="button-confirm-save"
            >
              {saveRouteMutation.isPending ? 'Saving...' : 'Save Route'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Route Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Load Route</DialogTitle>
            <DialogDescription>
              Select a saved route to load waypoints
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {savedRoutes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No saved routes yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {savedRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center justify-between p-3 border rounded hover:bg-accent cursor-pointer"
                    data-testid={`route-item-${route.id}`}
                  >
                    <div className="flex-1" onClick={() => loadRouteMutation.mutate(route.id)}>
                      <div className="font-mono font-bold text-sm">{route.name}</div>
                      {route.description && (
                        <div className="text-xs text-muted-foreground mt-1">{route.description}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {route.totalDistance.toFixed(2)} km • {new Date(route.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete route "${route.name}"?`)) {
                          deleteRouteMutation.mutate(route.id);
                        }
                      }}
                      data-testid={`button-delete-route-${route.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadDialogOpen(false)} data-testid="button-close-load">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
