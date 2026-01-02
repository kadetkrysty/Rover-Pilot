import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertRouteSchema, 
  insertWaypointSchema,
  insertTelemetryLogSchema,
  insertRoverConfigSchema
} from "@shared/schema";
import { z } from "zod";

interface TelemetryData {
  timestamp: number;
  gps: { lat: number; lng: number; accuracy: number; speed: number };
  imu: { heading: number; pitch: number; roll: number; accelX: number; accelY: number; accelZ: number };
  lidar: Array<{ angle: number; distance: number }>;
  ultrasonic: number[];
  battery: number;
  motorLeft: number;
  motorRight: number;
}

type ClientRole = 'viewer' | 'operator' | 'rover';

interface AuthenticatedClient {
  ws: WebSocket;
  role: ClientRole;
  authenticated: boolean;
  sessionId: string;
}

const connectedClients = new Map<WebSocket, AuthenticatedClient>();
let latestTelemetry: TelemetryData | null = null;

let cachedRoverToken: string | null = null;
let cachedOperatorToken: string | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_TTL = 60000;

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Routes API
  app.get("/api/routes", async (req, res) => {
    try {
      const routes = await storage.getRoutes();
      res.json(routes);
    } catch (error) {
      console.error("Error fetching routes:", error);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  app.get("/api/routes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid route ID" });
      }
      
      const route = await storage.getRoute(id);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      res.json(route);
    } catch (error) {
      console.error("Error fetching route:", error);
      res.status(500).json({ error: "Failed to fetch route" });
    }
  });

  app.post("/api/routes", async (req, res) => {
    try {
      const validatedData = insertRouteSchema.parse(req.body);
      const route = await storage.createRoute(validatedData);
      res.status(201).json(route);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid route data", details: error.errors });
      }
      console.error("Error creating route:", error);
      res.status(500).json({ error: "Failed to create route" });
    }
  });

  app.patch("/api/routes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid route ID" });
      }
      
      const validatedData = insertRouteSchema.partial().parse(req.body);
      const route = await storage.updateRoute(id, validatedData);
      
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      res.json(route);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid route data", details: error.errors });
      }
      console.error("Error updating route:", error);
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  app.delete("/api/routes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid route ID" });
      }
      
      const deleted = await storage.deleteRoute(id);
      if (!deleted) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting route:", error);
      res.status(500).json({ error: "Failed to delete route" });
    }
  });

  // Waypoints API
  app.get("/api/routes/:routeId/waypoints", async (req, res) => {
    try {
      const routeId = parseInt(req.params.routeId);
      if (isNaN(routeId)) {
        return res.status(400).json({ error: "Invalid route ID" });
      }
      
      const waypoints = await storage.getWaypoints(routeId);
      res.json(waypoints);
    } catch (error) {
      console.error("Error fetching waypoints:", error);
      res.status(500).json({ error: "Failed to fetch waypoints" });
    }
  });

  app.post("/api/routes/:routeId/waypoints", async (req, res) => {
    try {
      const routeId = parseInt(req.params.routeId);
      if (isNaN(routeId)) {
        return res.status(400).json({ error: "Invalid route ID" });
      }

      const route = await storage.getRoute(routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }

      if (Array.isArray(req.body)) {
        const validatedData = z.array(insertWaypointSchema).parse(req.body);
        const waypoints = await storage.createWaypoints(validatedData);
        res.status(201).json(waypoints);
      } else {
        const validatedData = insertWaypointSchema.parse(req.body);
        const waypoint = await storage.createWaypoint(validatedData);
        res.status(201).json(waypoint);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid waypoint data", details: error.errors });
      }
      console.error("Error creating waypoint:", error);
      res.status(500).json({ error: "Failed to create waypoint" });
    }
  });

  app.patch("/api/waypoints/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid waypoint ID" });
      }

      const existingWaypoint = await storage.getWaypoint(id);
      if (!existingWaypoint) {
        return res.status(404).json({ error: "Waypoint not found" });
      }

      const validatedData = insertWaypointSchema.partial().parse(req.body);
      
      if (validatedData.routeId && validatedData.routeId !== existingWaypoint.routeId) {
        return res.status(400).json({ error: "Cannot change waypoint's route. Delete and recreate instead." });
      }
      
      const { routeId, ...updateData } = validatedData;
      const waypoint = await storage.updateWaypoint(id, updateData);
      
      res.json(waypoint);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid waypoint data", details: error.errors });
      }
      console.error("Error updating waypoint:", error);
      res.status(500).json({ error: "Failed to update waypoint" });
    }
  });

  app.delete("/api/waypoints/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid waypoint ID" });
      }
      
      const deleted = await storage.deleteWaypoint(id);
      if (!deleted) {
        return res.status(404).json({ error: "Waypoint not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting waypoint:", error);
      res.status(500).json({ error: "Failed to delete waypoint" });
    }
  });

  // Telemetry API
  app.post("/api/telemetry", async (req, res) => {
    try {
      const validatedData = insertTelemetryLogSchema.parse(req.body);
      const log = await storage.createTelemetryLog(validatedData);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid telemetry data", details: error.errors });
      }
      console.error("Error creating telemetry log:", error);
      res.status(500).json({ error: "Failed to create telemetry log" });
    }
  });

  app.get("/api/telemetry", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getTelemetryLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching telemetry logs:", error);
      res.status(500).json({ error: "Failed to fetch telemetry logs" });
    }
  });

  app.get("/api/telemetry/latest", async (req, res) => {
    try {
      const latest = await storage.getLatestTelemetry();
      if (!latest) {
        return res.status(404).json({ error: "No telemetry data found" });
      }
      res.json(latest);
    } catch (error) {
      console.error("Error fetching latest telemetry:", error);
      res.status(500).json({ error: "Failed to fetch latest telemetry" });
    }
  });

  // Configuration API
  app.get("/api/config", async (req, res) => {
    try {
      const configs = await storage.getAllConfig();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.get("/api/config/:key", async (req, res) => {
    try {
      const config = await storage.getConfig(req.params.key);
      if (!config) {
        return res.status(404).json({ error: "Config not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.post("/api/config", async (req, res) => {
    try {
      const validatedData = insertRoverConfigSchema.parse(req.body);
      const config = await storage.setConfig(validatedData);
      res.status(201).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid config data", details: error.errors });
      }
      console.error("Error setting config:", error);
      res.status(500).json({ error: "Failed to set config" });
    }
  });

  // iBUS RC Data API - Returns FlySky FS-IA10B channel data from Arduino via Mini PC
  // In production, this data comes from the Python rover_controller.py via Arduino
  // Here we provide mock data for the web dashboard development
  app.get("/api/ibus", async (req, res) => {
    try {
      // Mock iBUS data - in production this would come from rover_controller.py
      // which reads iBUS data from Arduino Serial1 at ~143Hz
      const mockIbusData = {
        connected: true,
        channels: [1500, 1500, 1000, 1500, 1000, 1000, 1500, 1000, 1500, 1500], // 10 channels
        frameRate: 143,
        signalStrength: 100,  // 0-100 based on iBUS frame rate
        failsafe: false,      // True if transmitter signal lost
        control: {
          throttle: 0,
          steering: 0
        }
      };
      
      res.json(mockIbusData);
    } catch (error) {
      console.error("Error fetching iBUS data:", error);
      res.status(500).json({ error: "Failed to fetch iBUS data" });
    }
  });

  // System Info API
  app.get("/api/system/info", async (req, res) => {
    try {
      res.json({
        rover_name: 'RoverOS v3.0',
        firmware_version: '3.0.0',
        controller: 'Arduino Mega 2560',
        host: 'Mini PC (Intel Celeron)',
        host_os: 'Ubuntu',
        rc_receiver: 'FlySky FS-IA10B (iBUS)',
        rc_transmitter: 'FlySky FS-I6x',
        sensors: {
          lidar: 'TF Mini Pro',
          camera: 'HuskyLens AI',
          imu: 'MPU6050',
          gps: 'Neo-6M',
          ultrasonic: 5
        }
      });
    } catch (error) {
      console.error("Error fetching system info:", error);
      res.status(500).json({ error: "Failed to fetch system info" });
    }
  });

  // Rover Control API - These will proxy to Mini PC rover_controller.py
  app.post("/api/rover/mode", async (req, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['manual', 'autonomous', 'emergency_stop'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be manual, autonomous, or emergency_stop" });
      }
      
      console.log(`Rover mode changed to: ${mode}`);
      res.json({ mode, status: "success" });
    } catch (error) {
      console.error("Error changing rover mode:", error);
      res.status(500).json({ error: "Failed to change rover mode" });
    }
  });

  app.post("/api/rover/move", async (req, res) => {
    try {
      const { direction, speed } = req.body;
      
      if (!direction || !['forward', 'backward', 'left', 'right', 'stop'].includes(direction)) {
        return res.status(400).json({ error: "Invalid direction" });
      }
      
      if (speed !== undefined && (speed < 0 || speed > 100)) {
        return res.status(400).json({ error: "Speed must be between 0 and 100" });
      }
      
      console.log(`Rover move: ${direction} at speed ${speed || 50}`);
      res.json({ direction, speed: speed || 50, status: "success" });
    } catch (error) {
      console.error("Error sending move command:", error);
      res.status(500).json({ error: "Failed to send move command" });
    }
  });

  app.post("/api/rover/navigate", async (req, res) => {
    try {
      const { routeId } = req.body;
      
      if (!routeId) {
        return res.status(400).json({ error: "Route ID is required" });
      }
      
      const route = await storage.getRoute(routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      const waypoints = await storage.getWaypoints(routeId);
      if (waypoints.length === 0) {
        return res.status(400).json({ error: "Route has no waypoints" });
      }
      
      console.log(`Starting autonomous navigation on route ${routeId} with ${waypoints.length} waypoints`);
      res.json({ routeId, waypoints: waypoints.length, status: "started" });
    } catch (error) {
      console.error("Error starting navigation:", error);
      res.status(500).json({ error: "Failed to start navigation" });
    }
  });

  // WebSocket server for real-time telemetry streaming
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/telemetry" });

  async function refreshTokenCache(): Promise<void> {
    const now = Date.now();
    if (now - tokenCacheTime < TOKEN_CACHE_TTL) return;
    
    const [roverConfig, operatorConfig] = await Promise.all([
      storage.getConfig("rover_auth_token"),
      storage.getConfig("operator_auth_token")
    ]);
    
    cachedRoverToken = roverConfig?.value || null;
    cachedOperatorToken = operatorConfig?.value || null;
    tokenCacheTime = now;
  }

  async function getRoverToken(): Promise<string | null> {
    await refreshTokenCache();
    return cachedRoverToken;
  }

  async function getOperatorToken(): Promise<string | null> {
    await refreshTokenCache();
    return cachedOperatorToken;
  }

  wss.on("connection", (ws: WebSocket) => {
    const sessionId = generateSessionId();
    const client: AuthenticatedClient = {
      ws,
      role: 'viewer',
      authenticated: false,
      sessionId
    };
    connectedClients.set(ws, client);
    console.log(`WebSocket client connected: ${sessionId} (unauthenticated viewer)`);

    ws.send(JSON.stringify({ 
      type: "auth_required", 
      sessionId,
      message: "Send auth message with role and token to unlock commands"
    }));

    ws.on("message", async (message: Buffer) => {
      try {
        const parsed = JSON.parse(message.toString());
        const clientInfo = connectedClients.get(ws);
        if (!clientInfo) return;
        
        if (parsed.type === "auth") {
          const { role, token } = parsed;
          
          if (role === "rover") {
            const roverToken = await getRoverToken();
            if (roverToken && token === roverToken) {
              clientInfo.role = 'rover';
              clientInfo.authenticated = true;
              console.log(`Client ${sessionId} authenticated as ROVER`);
              ws.send(JSON.stringify({ type: "auth_success", role: "rover" }));
              if (latestTelemetry) {
                ws.send(JSON.stringify({ type: "telemetry", data: latestTelemetry }));
              }
            } else {
              ws.send(JSON.stringify({ type: "auth_failed", message: "Invalid rover token" }));
            }
          } else if (role === "operator") {
            const operatorToken = await getOperatorToken();
            if (operatorToken && token === operatorToken) {
              clientInfo.role = 'operator';
              clientInfo.authenticated = true;
              console.log(`Client ${sessionId} authenticated as OPERATOR`);
              ws.send(JSON.stringify({ type: "auth_success", role: "operator" }));
              if (latestTelemetry) {
                ws.send(JSON.stringify({ type: "telemetry", data: latestTelemetry }));
              }
            } else {
              ws.send(JSON.stringify({ type: "auth_failed", message: "Invalid operator token" }));
            }
          }
          return;
        }

        if (parsed.type === "telemetry") {
          if (clientInfo.role !== 'rover' || !clientInfo.authenticated) {
            ws.send(JSON.stringify({ type: "error", message: "Only authenticated rover can send telemetry" }));
            return;
          }
          latestTelemetry = parsed.data as TelemetryData;
          broadcastTelemetry(latestTelemetry);
        } else if (parsed.type === "command") {
          if (clientInfo.role !== 'operator' || !clientInfo.authenticated) {
            ws.send(JSON.stringify({ type: "error", message: "Only authenticated operator can send commands" }));
            return;
          }
          console.log(`Command from operator ${sessionId}:`, parsed.command);
          connectedClients.forEach((c) => {
            if (c.role === 'rover' && c.authenticated && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(JSON.stringify({ type: "command", command: parsed.command }));
            }
          });
        } else if (parsed.type === "lidar_scan") {
          if (clientInfo.role !== 'rover' || !clientInfo.authenticated) return;
          broadcastToAuthenticatedClients({ type: "lidar_scan", data: parsed.data });
        } else if (parsed.type === "slam_update") {
          if (clientInfo.role !== 'rover' || !clientInfo.authenticated) return;
          broadcastToAuthenticatedClients({ type: "slam_update", data: parsed.data });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      const clientInfo = connectedClients.get(ws);
      console.log(`WebSocket client disconnected: ${clientInfo?.sessionId || 'unknown'}`);
      connectedClients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      connectedClients.delete(ws);
    });
  });

  function broadcastTelemetry(telemetry: TelemetryData) {
    const message = JSON.stringify({ type: "telemetry", data: telemetry });
    connectedClients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && client.authenticated) {
        client.ws.send(message);
      }
    });
  }

  function broadcastToAuthenticatedClients(payload: object, excludeRoles?: ClientRole[]) {
    const message = JSON.stringify(payload);
    connectedClients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN && 
          client.authenticated && 
          (!excludeRoles || !excludeRoles.includes(client.role))) {
        client.ws.send(message);
      }
    });
  }

  // REST endpoint to get current telemetry (fallback for non-WebSocket clients)
  app.get("/api/telemetry/current", async (_req, res) => {
    if (latestTelemetry) {
      res.json(latestTelemetry);
    } else {
      res.status(404).json({ error: "No telemetry data available" });
    }
  });

  // REST endpoint to receive telemetry from Raspberry Pi (MQTT bridge alternative)
  app.post("/api/telemetry/push", async (req, res) => {
    try {
      latestTelemetry = req.body as TelemetryData;
      broadcastTelemetry(latestTelemetry);
      res.json({ status: "received" });
    } catch (error) {
      console.error("Error receiving telemetry:", error);
      res.status(500).json({ error: "Failed to process telemetry" });
    }
  });

  console.log("WebSocket server initialized on /ws/telemetry");

  return httpServer;
}
