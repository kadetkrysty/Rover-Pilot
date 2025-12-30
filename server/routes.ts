import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertRouteSchema, 
  insertWaypointSchema,
  insertTelemetryLogSchema,
  insertRoverConfigSchema
} from "@shared/schema";
import { z } from "zod";

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

  // Rover Control API - These will proxy to Raspberry Pi eventually
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

  return httpServer;
}
