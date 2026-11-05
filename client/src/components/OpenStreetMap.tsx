import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./OpenStreetMap.css";
import { isDemoMode } from "@/lib/demoMode";

export interface MapPoint { lat: number; lng: number }
export interface MapWaypoint extends MapPoint { id: string; name: string }
interface Props {
  tileUrl: string;
  tileAttribution?: string;
  rover: MapPoint & { heading?: number };
  waypoints?: MapWaypoint[];
  accuracy?: number;
  user?: MapPoint;
  followRover?: boolean;
  zoom?: number;
  onReady?: (map: L.Map | null) => void;
  onMapClick?: (point: MapPoint) => void;
  onWaypointMove?: (id: string, point: MapPoint) => void;
}
const valid = (point: MapPoint) => Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
  Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;

/** Bundled Leaflet renderer. Only tiles leave the client, never MiniPC auth headers. */
export default function OpenStreetMap(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const waypointLayer = useRef<L.LayerGroup | null>(null);
  const positionLayer = useRef<L.LayerGroup | null>(null);
  const pathLayer = useRef<L.Polyline | null>(null);
  const current = useRef(props);
  current.current = props;
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!root.current || isDemoMode()) return;
    const initial = current.current;
    const instance = L.map(root.current, { scrollWheelZoom: false, minZoom: 2, maxZoom: 19 })
      .setView(valid(initial.rover) ? initial.rover : { lat: 0, lng: 0 }, initial.zoom ?? 17);
    map.current = instance;
    waypointLayer.current = L.layerGroup().addTo(instance);
    positionLayer.current = L.layerGroup().addTo(instance);
    pathLayer.current = L.polyline([], { color: "#00cddd", weight: 4 }).addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) => current.current.onMapClick?.(event.latlng));
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(root.current);
    current.current.onReady?.(instance);
    return () => {
      observer.disconnect();
      current.current.onReady?.(null);
      instance.remove();
      map.current = null;
      tiles.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || isDemoMode()) return;
    setError(false);
    setLoading(true);
    // Leaflet attribution takes HTML. Encode all owner-provided provider credits.
    const extraCredits = document.createElement("span");
    extraCredits.textContent = props.tileAttribution || "";
    const layer = L.tileLayer(props.tileUrl, {
      maxZoom: 19, updateWhenIdle: true, keepBuffer: 1,
      crossOrigin: "anonymous", referrerPolicy: "strict-origin-when-cross-origin",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' + (props.tileAttribution ? ` · ${extraCredits.outerHTML}` : ""),
    });
    layer.on("tileerror", () => { setError(true); setLoading(false); });
    layer.on("load", () => setLoading(false));
    const timeout = window.setTimeout(() => { if (layer.isLoading()) { setError(true); setLoading(false); } }, 15000);
    tiles.current = layer;
    layer.addTo(map.current);
    return () => { clearTimeout(timeout); layer.remove(); };
  }, [props.tileUrl, props.tileAttribution]);

  useEffect(() => {
    const layer = waypointLayer.current;
    if (!layer || isDemoMode()) return;
    layer.clearLayers();
    (props.waypoints ?? []).filter(valid).forEach((point, index, points) => {
      const label = document.createElement("span");
      label.textContent = point.name;
      const marker = L.marker(point, {
        draggable: Boolean(current.current.onWaypointMove),
        title: point.name, alt: `Waypoint ${index + 1}: ${point.name}`,
        icon: L.divIcon({
          className: `rover-waypoint ${index === 0 ? "rover-waypoint-start" : index === points.length - 1 ? "rover-waypoint-end" : ""}`,
          html: `<span>${index + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 14],
        }),
      }).bindTooltip(label).addTo(layer);
      marker.on("dragend", () => current.current.onWaypointMove?.(point.id, marker.getLatLng()));
    });
  }, [props.waypoints]);

  useEffect(() => {
    const layer = positionLayer.current;
    if (!layer || isDemoMode()) return;
    layer.clearLayers();
    if (!valid(props.rover)) return;
    const heading = Number.isFinite(props.rover.heading) ? props.rover.heading : 0;
    L.marker(props.rover, {
      title: "Rover position", alt: "Rover position",
      icon: L.divIcon({ className: "rover-map-position", html: `<span style="transform:rotate(${heading}deg)">▲</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
    }).addTo(layer);
    if (props.accuracy && Number.isFinite(props.accuracy) && props.accuracy > 0)
      L.circle(props.rover, { radius: props.accuracy, color: "#00dede", fillOpacity: 0.1, weight: 1 }).addTo(layer);
    if (props.user && valid(props.user))
      L.circleMarker(props.user, { radius: 6, color: "#fff", fillColor: "#329cff", fillOpacity: 1 }).bindTooltip("Client location").addTo(layer);
    if (props.followRover) map.current?.panTo(props.rover, { animate: false });
  }, [props.rover.lat, props.rover.lng, props.rover.heading, props.accuracy, props.user?.lat, props.user?.lng, props.followRover]);

  useEffect(() => {
    pathLayer.current?.setLatLngs([props.rover, ...(props.waypoints ?? [])].filter(valid));
  }, [props.rover.lat, props.rover.lng, props.waypoints]);

  return <div className="rover-osm relative isolate h-full w-full min-h-0">
    <div ref={root} className="absolute inset-0" aria-label="OpenStreetMap rover navigation map" />
    {loading && <div className="rover-map-notice" role="status">Loading map tiles…</div>}
    {error && <div className="rover-map-notice" role="alert">
      Some map tiles could not load. Check internet access and the tile provider in Map Settings.
      <button type="button" className="ml-2 underline" onClick={() => { setError(false); tiles.current?.redraw(); }}>Retry tiles</button>
    </div>}
  </div>;
}
