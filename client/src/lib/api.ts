import type { Route, Waypoint, InsertRoute, InsertWaypoint, TelemetryLog, InsertTelemetryLog, RoverConfig, InsertRoverConfig } from "@shared/schema";

// Routes API
export async function getRoutes(): Promise<Route[]> {
  const res = await fetch('/api/routes');
  if (!res.ok) throw new Error('Failed to fetch routes');
  return res.json();
}

export async function getRoute(id: number): Promise<Route> {
  const res = await fetch(`/api/routes/${id}`);
  if (!res.ok) throw new Error('Failed to fetch route');
  return res.json();
}

export async function createRoute(route: InsertRoute): Promise<Route> {
  const res = await fetch('/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(route),
  });
  if (!res.ok) throw new Error('Failed to create route');
  return res.json();
}

export async function updateRoute(id: number, route: Partial<InsertRoute>): Promise<Route> {
  const res = await fetch(`/api/routes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(route),
  });
  if (!res.ok) throw new Error('Failed to update route');
  return res.json();
}

export async function deleteRoute(id: number): Promise<void> {
  const res = await fetch(`/api/routes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete route');
}

// Waypoints API
export async function getWaypoints(routeId: number): Promise<Waypoint[]> {
  const res = await fetch(`/api/routes/${routeId}/waypoints`);
  if (!res.ok) throw new Error('Failed to fetch waypoints');
  return res.json();
}

export async function createWaypoint(waypoint: InsertWaypoint): Promise<Waypoint> {
  const res = await fetch(`/api/routes/${waypoint.routeId}/waypoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(waypoint),
  });
  if (!res.ok) throw new Error('Failed to create waypoint');
  return res.json();
}

export async function createWaypoints(waypoints: InsertWaypoint[]): Promise<Waypoint[]> {
  if (waypoints.length === 0) return [];
  const res = await fetch(`/api/routes/${waypoints[0].routeId}/waypoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(waypoints),
  });
  if (!res.ok) throw new Error('Failed to create waypoints');
  return res.json();
}

export async function updateWaypoint(id: number, waypoint: Partial<InsertWaypoint>): Promise<Waypoint> {
  const res = await fetch(`/api/waypoints/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(waypoint),
  });
  if (!res.ok) throw new Error('Failed to update waypoint');
  return res.json();
}

export async function deleteWaypoint(id: number): Promise<void> {
  const res = await fetch(`/api/waypoints/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete waypoint');
}

// Telemetry API
export async function createTelemetryLog(log: InsertTelemetryLog): Promise<TelemetryLog> {
  const res = await fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log),
  });
  if (!res.ok) throw new Error('Failed to create telemetry log');
  return res.json();
}

export async function getTelemetryLogs(limit?: number): Promise<TelemetryLog[]> {
  const url = limit ? `/api/telemetry?limit=${limit}` : '/api/telemetry';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch telemetry logs');
  return res.json();
}

export async function getLatestTelemetry(): Promise<TelemetryLog> {
  const res = await fetch('/api/telemetry/latest');
  if (!res.ok) throw new Error('Failed to fetch latest telemetry');
  return res.json();
}

// Config API
export async function getConfig(key: string): Promise<RoverConfig> {
  const res = await fetch(`/api/config/${key}`);
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function setConfig(config: InsertRoverConfig): Promise<RoverConfig> {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to set config');
  return res.json();
}

export async function getAllConfig(): Promise<RoverConfig[]> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to fetch all config');
  return res.json();
}

// Rover Control API
export async function setRoverMode(mode: 'manual' | 'autonomous' | 'emergency_stop'): Promise<{ mode: string; status: string }> {
  const res = await fetch('/api/rover/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error('Failed to set rover mode');
  return res.json();
}

export async function moveRover(direction: 'forward' | 'backward' | 'left' | 'right' | 'stop', speed?: number): Promise<{ direction: string; speed: number; status: string }> {
  const res = await fetch('/api/rover/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction, speed }),
  });
  if (!res.ok) throw new Error('Failed to move rover');
  return res.json();
}

export async function startNavigation(routeId: number): Promise<{ routeId: number; waypoints: number; status: string }> {
  const res = await fetch('/api/rover/navigate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routeId }),
  });
  if (!res.ok) throw new Error('Failed to start navigation');
  return res.json();
}
