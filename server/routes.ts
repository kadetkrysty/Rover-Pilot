import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, db } from "./storage";
import { getProvisioningStatus } from "./provisioningState";
import { sql } from "drizzle-orm";
import { 
  insertRouteSchema, 
  insertWaypointSchema,
  insertTelemetryLogSchema,
  insertRoverConfigSchema
} from "@shared/schema";
import { z } from "zod";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createConnection } from "node:net";
import { compareVersions, selectRelease } from "../scripts/minipc/release-metadata.cjs";
import {
  CLIENT_AUTH_CONFIG_KEY,
  createClientToken,
  findClientByToken,
  hashClientToken,
  isClientAuthRole,
  parseClientAuthState,
  type AuthenticatedRoverClient,
  type ClientAuthState,
  type RoverClientRole,
} from "./clientAuth";

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

type ClientRole = RoverClientRole;

interface AuthenticatedClient {
  ws: WebSocket;
  role: ClientRole;
  authenticated: boolean;
  sessionId: string;
  clientAuth: AuthenticatedRoverClient | null;
  token: string | null;
}

const connectedClients = new Map<WebSocket, AuthenticatedClient>();
let latestTelemetry: TelemetryData | null = null;
const execFileAsync = promisify(execFile);

async function updateUnitActiveState(): Promise<string> {
  const systemctl = process.env.ROVEROS_UPDATE_SYSTEMCTL_PATH || "/usr/bin/systemctl";
  const { stdout } = await execFileAsync(systemctl, [
    "show", "--property=ActiveState", "--value", "roveros-update.service",
  ]);
  return stdout.trim();
}

async function readMiniPcUpdateStatus(): Promise<Record<string, unknown>> {
  const statusPath = process.env.ROVEROS_UPDATE_STATUS_FILE ||
    "/var/lib/roveros-provisioner/update-status.json";
  let status: Record<string, unknown>;
  try {
    status = JSON.parse(readFileSync(statusPath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: "idle", progress: 0 };
    throw error;
  }
  if (status.state === "running") {
    try {
      const activeState = await updateUnitActiveState();
      if (activeState === "active" || activeState === "activating") return status;
    } catch {
      // An unavailable service manager means the saved running state cannot be confirmed.
    }
    return {
      ...status,
      state: "interrupted",
      message: "The update stopped before finishing. Retry it or use owner SSH for recovery.",
    };
  }
  return status;
}

function requestMiniPcUpdateStart(): Promise<void> {
  const socketPath = process.env.ROVEROS_UPDATE_SOCKET_PATH || "/run/roveros-update.sock";
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let response = "";
    socket.setTimeout(5000, () => socket.destroy(new Error("Update service did not respond.")));
    socket.on("connect", () => socket.end("START\n"));
    socket.on("data", (chunk: Buffer) => {
      response += chunk.toString("utf8");
      if (response.length > 64) socket.destroy(new Error("Update service returned an invalid response."));
    });
    socket.on("error", reject);
    socket.on("end", () => {
      if (response.trim() === "STARTED") resolve();
      else reject(new Error("Update service did not accept the request."));
    });
  });
}

let ownerEnrollmentInProgress = false;
let clientAuthMutationQueue: Promise<void> = Promise.resolve();

function withClientAuthMutation<T>(operation: () => Promise<T>): Promise<T> {
  const next = clientAuthMutationQueue.then(operation, operation);
  clientAuthMutationQueue = next.then(() => undefined, () => undefined);
  return next;
}

function bearerToken(authorization: string | undefined): string | undefined {
  return /^Bearer ([a-f0-9]{64})$/i.exec(authorization || "")?.[1];
}

function isSecureRequest(req: Request): boolean {
  return Boolean((req.socket as typeof req.socket & { encrypted?: boolean }).encrypted);
}

async function readClientAuthState(): Promise<ClientAuthState> {
  const config = await storage.getConfig(CLIENT_AUTH_CONFIG_KEY);
  return parseClientAuthState(config?.value);
}

async function writeClientAuthState(state: ClientAuthState): Promise<void> {
  await storage.setConfig({ key: CLIENT_AUTH_CONFIG_KEY, value: JSON.stringify(state) });
}

function secureTransportOnly(req: Request, res: Response): boolean {
  res.setHeader("Cache-Control", "no-store");
  if (isSecureRequest(req)) return true;
  res.status(426).json({ error: "Use the certificate-pinned HTTPS API on port 5443." });
  return false;
}

async function authenticateClient(
  req: Request,
): Promise<AuthenticatedRoverClient | null> {
  const state = await readClientAuthState();
  return findClientByToken(state, bearerToken(req.get("authorization")));
}

async function authenticateToken(token: string | undefined): Promise<AuthenticatedRoverClient | null> {
  const state = await readClientAuthState();
  return findClientByToken(state, token);
}

function isPrivateConfigKey(key: string): boolean {
  return key === CLIENT_AUTH_CONFIG_KEY || /(?:auth|token|secret|password|credential|api[_-]?key)/i.test(key);
}

function validOwnerCode(supplied: string, expected: string): boolean {
  if (!/^[a-f0-9]{32}$/i.test(supplied) || !/^[a-f0-9]{32}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
}

function safeClientName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 64 || /[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  secureServer?: Server,
): Promise<Server> {
  app.get("/api/system/health", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await db.execute(sql`select 1 from rover_config limit 1`);
      res.json({ service: "RoverOS", status: "ready", database: "ready" });
    } catch {
      res.status(503).json({ service: "RoverOS", status: "unavailable", database: "unavailable" });
    }
  });

  app.get("/api/provisioning/status", async (_req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json(await getProvisioningStatus());
    } catch {
      res.status(503).json({
        service: "RoverOS",
        rover_name: "RoverOS-Server",
        state: "failed",
        stage: "status",
        progress: 0,
        errorCode: "STATUS_UNAVAILABLE",
        message: "Provisioning status is temporarily unavailable.",
      });
    }
  });

  // This identity-only endpoint is intentionally public so clients can verify
  // discovery before pairing. It contains no settings, telemetry, or secrets.
  app.get("/api/system/info", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      rover_name: "RoverOS v3.0",
      firmware_version: "3.0.0",
      controller: "Arduino Mega 2560",
      host: "Mini PC",
      host_os: "Ubuntu",
    });
  });

  const requireOwner = async (req: Request, res: Response) => {
    if (!secureTransportOnly(req, res)) return null;
    let client: AuthenticatedRoverClient | null;
    try {
      client = await authenticateClient(req);
    } catch {
      res.status(503).json({ error: "Client authorization is temporarily unavailable." });
      return null;
    }
    if (!client) {
      res.status(401).json({ error: "Pair this client with the rover before continuing." });
      return null;
    }
    if (client.role !== "owner") {
      res.status(403).json({ error: "Only the rover owner can manage paired clients." });
      return null;
    }
    return client;
  };

  app.get("/api/system/update", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const owner = await requireOwner(req, res);
    if (!owner) return;
    try {
      const manifestPath = process.env.ROVEROS_CURRENT_RELEASE_MANIFEST ||
        "/opt/roveros/current/release-manifest.json";
      const current = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string };
      if (typeof current.version !== "string") throw new Error("Installed release version is missing.");
      compareVersions(current.version, current.version);

      const repository = process.env.ROVEROS_GITHUB_REPOSITORY || "";
      const releaseResponse = await fetch(
        `https://api.github.com/repos/${repository}/releases?per_page=100`,
        {
          headers: { accept: "application/vnd.github+json", "user-agent": "RoverOS-MiniPC" },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!releaseResponse.ok) throw new Error("Release service did not return a release list.");
      const releases = await releaseResponse.json() as unknown;
      const available = selectRelease(releases, repository);
      res.json({
        currentVersion: current.version,
        availableVersion: available.version,
        updateAvailable: compareVersions(available.version, current.version) > 0,
        updateStatus: await readMiniPcUpdateStatus(),
      });
    } catch (error) {
      console.error("MiniPC update check failed:", error);
      res.status(503).json({ error: "Could not check for updates. No changes were made." });
    }
  });

  app.get("/api/system/update/status", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const owner = await requireOwner(req, res);
    if (!owner) return;
    try {
      res.json(await readMiniPcUpdateStatus());
    } catch {
      res.status(503).json({ error: "Update status is unavailable. Use owner SSH to check the MiniPC." });
    }
  });

  app.post("/api/system/update", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const owner = await requireOwner(req, res);
    if (!owner) return;
    try {
      const activeState = await updateUnitActiveState();
      if (activeState === "active" || activeState === "activating") {
        return res.status(409).json({ error: "A MiniPC update is already running." });
      }
    } catch {
      // An inactive or not-yet-installed unit is handled by the restricted launcher below.
    }
    try {
      await requestMiniPcUpdateStart();
      res.status(202).json({ state: "started" });
    } catch (error) {
      console.error("Could not start MiniPC update:", error);
      res.status(503).json({
        error: "The update service is unavailable. Use owner SSH to check the installation.",
      });
    }
  });

  app.post("/api/clients/pair-owner", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!secureTransportOnly(req, res)) return;
    if (ownerEnrollmentInProgress) {
      return res.status(409).json({ error: "Owner enrollment is already in progress." });
    }
    const name = safeClientName(req.body?.name);
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!name || !/^[a-f0-9]{32}$/i.test(code)) {
      return res.status(400).json({ error: "Enter the owner enrollment code and a client name." });
    }

    ownerEnrollmentInProgress = true;
    try {
      await withClientAuthMutation(async () => {
        const state = await readClientAuthState();
        if (state.clients.some((client) => client.role === "owner" && !client.revokedAt)) {
          return res.status(409).json({ error: "An owner is already paired. Ask the owner to invite this client." });
        }

        const codeFile = process.env.ROVEROS_OWNER_PAIRING_CODE_FILE ||
          "/etc/roveros-provisioner/owner-pairing-code";
        let expectedCode = "";
        try {
          expectedCode = readFileSync(codeFile, "utf8").trim();
        } catch {
          return res.status(503).json({ error: "Owner enrollment is unavailable. Use the MiniPC console to restore access." });
        }
        if (!validOwnerCode(code, expectedCode)) {
          return res.status(401).json({ error: "Owner enrollment code was not accepted." });
        }

        const token = createClientToken();
        const clientId = randomUUID();
        state.clients.push({
          id: clientId,
          name,
          role: "owner",
          tokenHash: hashClientToken(token),
          createdAt: new Date().toISOString(),
        });
        await writeClientAuthState(state);
        try {
          unlinkSync(codeFile);
        } catch {
          // A second attempt is still rejected because the owner record now exists.
        }
        res.status(201).json({ clientId, name, role: "owner", token });
      });
    } catch (error) {
      console.error("Owner enrollment failed:", error);
      res.status(500).json({ error: "Owner enrollment could not be completed." });
    } finally {
      ownerEnrollmentInProgress = false;
    }
  });

  app.post("/api/clients/claim", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!secureTransportOnly(req, res)) return;
    const code = typeof req.body?.invitationCode === "string" ? req.body.invitationCode.trim() : "";
    if (!/^[a-f0-9]{64}$/i.test(code)) {
      return res.status(400).json({ error: "Enter a valid owner invitation code." });
    }
    try {
      await withClientAuthMutation(async () => {
        const state = await readClientAuthState();
        const now = Date.now();
        const index = state.invitations.findIndex(
          (invitation) => invitation.tokenHash === hashClientToken(code) &&
            Date.parse(invitation.expiresAt) > now,
        );
        if (index < 0) return res.status(401).json({ error: "Invitation is invalid or expired." });

        const [invitation] = state.invitations.splice(index, 1);
        const token = createClientToken();
        const clientId = randomUUID();
        const name = invitation.name;
        state.clients.push({
          id: clientId,
          name,
          role: invitation.role,
          tokenHash: hashClientToken(token),
          createdAt: new Date().toISOString(),
        });
        await writeClientAuthState(state);
        res.status(201).json({ clientId, name, role: invitation.role, token });
      });
    } catch (error) {
      console.error("Client enrollment failed:", error);
      res.status(500).json({ error: "Client enrollment could not be completed." });
    }
  });

  app.get("/api/clients/me", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!secureTransportOnly(req, res)) return;
    try {
      const client = await authenticateClient(req);
      if (!client) return res.status(401).json({ error: "Pair this client with the rover before continuing." });
      res.json({ id: client.id, name: client.name, role: client.role });
    } catch {
      res.status(503).json({ error: "Client authorization is temporarily unavailable." });
    }
  });

  app.get("/api/clients", async (req, res) => {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    try {
      const state = await readClientAuthState();
      res.json(state.clients.map(({ id, name, role, createdAt, revokedAt }) => ({
        id, name, role, createdAt, revokedAt: revokedAt || null,
      })));
    } catch {
      res.status(500).json({ error: "Could not read paired clients." });
    }
  });

  app.post("/api/clients/invitations", async (req, res) => {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    const name = safeClientName(req.body?.name);
    const role = req.body?.role;
    if (!name || !isClientAuthRole(role) || role === "owner") {
      return res.status(400).json({ error: "Enter a client name and a permitted non-owner role." });
    }
    try {
      await withClientAuthMutation(async () => {
        const state = await readClientAuthState();
        const code = createClientToken();
        const now = Date.now();
        const invitationId = randomUUID();
        const expiresAt = new Date(now + 10 * 60_000).toISOString();
        state.invitations = state.invitations.filter(
          (invitation) => Date.parse(invitation.expiresAt) > now,
        );
        state.invitations.push({
          id: invitationId,
          name,
          role,
          tokenHash: hashClientToken(code),
          createdAt: new Date(now).toISOString(),
          expiresAt,
        });
        await writeClientAuthState(state);
        res.status(201).json({ invitationId, name, role, code, expiresAt });
      });
    } catch (error) {
      console.error("Client invitation failed:", error);
      res.status(500).json({ error: "Could not create a client invitation." });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    const owner = await requireOwner(req, res);
    if (!owner) return;
    try {
      await withClientAuthMutation(async () => {
        const state = await readClientAuthState();
        const target = state.clients.find((client) => client.id === req.params.id);
        if (!target) return res.status(404).json({ error: "Paired client not found." });
        if (target.id === owner.id) {
          return res.status(400).json({ error: "The current owner client cannot revoke itself." });
        }
        target.revokedAt = new Date().toISOString();
        await writeClientAuthState(state);
        connectedClients.forEach((client) => {
          if (client.clientAuth?.id === target.id) client.ws.close(4001, "Client authorization revoked");
        });
        res.status(204).send();
      });
    } catch (error) {
      console.error("Client revocation failed:", error);
      res.status(500).json({ error: "Could not revoke the paired client." });
    }
  });

  // All remaining application APIs require a client token over pinned HTTPS.
  app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
    if (!secureTransportOnly(req, res)) return;
    try {
      const client = await authenticateClient(req);
      if (!client) {
        return res.status(401).json({ error: "Pair this client with the rover before continuing." });
      }
      const isRead = req.method === "GET" || req.method === "HEAD";
      const isRoverTelemetry =
        client.role === "rover" &&
        req.method === "POST" &&
        (req.path === "/telemetry" || req.path === "/telemetry/push");
      if (!isRead && !["owner", "operator"].includes(client.role) && !isRoverTelemetry) {
        return res.status(403).json({ error: "This paired client does not have permission to change rover settings." });
      }
      if (
        isRead &&
        ["viewer", "rover"].includes(client.role) &&
        (req.path === "/config" || req.path.startsWith("/config/") || req.path === "/export/all")
      ) {
        return res.status(403).json({ error: "Only owner and operator clients can read sensitive settings." });
      }
      next();
    } catch (error) {
      console.error("Client authorization check failed:", error);
      res.status(503).json({ error: "Client authorization is temporarily unavailable." });
    }
  });
  
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
        return res.status(400).json({ error: "Invalid route data", details: error.issues });
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
        return res.status(400).json({ error: "Invalid route data", details: error.issues });
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
        return res.status(400).json({ error: "Invalid waypoint data", details: error.issues });
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
        return res.status(400).json({ error: "Invalid waypoint data", details: error.issues });
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
        return res.status(400).json({ error: "Invalid telemetry data", details: error.issues });
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
      const configs = (await storage.getAllConfig()).filter((config) => !isPrivateConfigKey(config.key));
      res.json(configs);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ error: "Failed to fetch config" });
    }
  });

  app.get("/api/config/:key", async (req, res) => {
    try {
      if (isPrivateConfigKey(req.params.key)) {
        return res.status(404).json({ error: "Config not found" });
      }
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
      if (isPrivateConfigKey(validatedData.key)) {
        return res.status(400).json({ error: "This configuration key is managed internally." });
      }
      const config = await storage.setConfig(validatedData);
      res.status(201).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid config data", details: error.issues });
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

  app.get("/api/camera/config", async (_req, res) => {
    try {
      const streamUrl = process.env.IMOU_CAMERA_STREAM_URL || '';
      const snapshotUrl = process.env.IMOU_CAMERA_SNAPSHOT_URL || '';
      const roverHost = process.env.ROVER_HOST || '';
      
      res.json({
        camera: 'Imou CELL GO',
        objectDetection: 'HuskyLens AI',
        panTilt: 'SlushEngine (Raspberry Pi 3 B+)',
        streamUrl: streamUrl || (roverHost ? `http://${roverHost}:8081/camera/stream` : ''),
        snapshotUrl: snapshotUrl || (roverHost ? `http://${roverHost}:8081/camera/snapshot` : ''),
        capabilities: {
          resolution: '1080p',
          wireless: true,
          battery: true,
          nightVision: true,
          rtsp: true
        }
      });
    } catch (error) {
      console.error("Error fetching camera config:", error);
      res.status(500).json({ error: "Failed to fetch camera config" });
    }
  });

  // WebSocket server for real-time telemetry streaming
  const wss = new WebSocketServer({
    server: secureServer || httpServer,
    path: "/ws/telemetry",
    verifyClient: (info, done) => {
      const socket = info.req.socket as typeof info.req.socket & { encrypted?: boolean };
      done(Boolean(socket.encrypted));
    },
  });

  wss.on("connection", (ws: WebSocket) => {
    const sessionId = generateSessionId();
    const client: AuthenticatedClient = {
      ws,
      role: 'viewer',
      authenticated: false,
      sessionId,
      clientAuth: null,
      token: null,
    };
    connectedClients.set(ws, client);
    console.log(`WebSocket client connected: ${sessionId} (unauthenticated viewer)`);

    ws.send(JSON.stringify({ 
      type: "auth_required", 
      sessionId,
      message: "Send auth message with a paired client token"
    }));

    ws.on("message", async (message: Buffer) => {
      try {
        const parsed = JSON.parse(message.toString());
        const clientInfo = connectedClients.get(ws);
        if (!clientInfo) return;
        
        if (parsed.type === "auth") {
          clientInfo.authenticated = false;
          clientInfo.clientAuth = null;
          clientInfo.token = null;
          const socket = (ws as WebSocket & { _socket?: { encrypted?: boolean } })._socket;
          if (!socket?.encrypted) {
            ws.close(4003, "Secure transport required");
            return;
          }
          const clientAuth = await authenticateToken(
            typeof parsed.token === "string" ? parsed.token : undefined,
          );
          if (!clientAuth) {
            ws.send(JSON.stringify({ type: "auth_failed", message: "Client is not paired or has been revoked." }));
            return;
          }
          clientInfo.clientAuth = clientAuth;
          clientInfo.role = clientAuth.role === "owner" ? "operator" : clientAuth.role;
          clientInfo.authenticated = true;
          clientInfo.token = parsed.token;
          console.log(`Client ${sessionId} authenticated as ${clientAuth.role}`);
          ws.send(JSON.stringify({ type: "auth_success", role: clientAuth.role }));
          if (latestTelemetry) {
            ws.send(JSON.stringify({ type: "telemetry", data: latestTelemetry }));
          }
          return;
        }

        if (clientInfo.authenticated && clientInfo.token) {
          const current = await authenticateToken(clientInfo.token);
          if (!current) {
            clientInfo.authenticated = false;
            clientInfo.clientAuth = null;
            ws.close(4001, "Client authorization revoked");
            return;
          }
          clientInfo.clientAuth = current;
          clientInfo.role = current.role === "owner" ? "operator" : current.role;
        }

        if (parsed.type === "telemetry") {
          if (clientInfo.role !== 'rover' || !clientInfo.authenticated) {
            ws.send(JSON.stringify({ type: "error", message: "Only authenticated rover can send telemetry" }));
            return;
          }
          latestTelemetry = parsed.data as TelemetryData;
          broadcastTelemetry(latestTelemetry);
        } else if (parsed.type === "command") {
          if (!['operator', 'owner'].includes(clientInfo.clientAuth?.role || '') || !clientInfo.authenticated) {
            ws.send(JSON.stringify({ type: "error", message: "Only authenticated operator can send commands" }));
            return;
          }
          console.log(`Command from operator ${sessionId}:`, parsed.command);
          connectedClients.forEach((c) => {
            if (c.role === 'rover' && c.authenticated && c.ws.readyState === WebSocket.OPEN) {
              c.ws.send(JSON.stringify({ type: "command", command: parsed.command }));
            }
          });
        } else if (parsed.type === "ping") {
          // Respond to ping with pong for latency measurement
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
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

  // Export API - Backup all data to JSON
  app.get("/api/export/all", async (_req, res) => {
    try {
      const routes = await storage.getRoutes();
      const configs = (await storage.getAllConfig()).filter((config) => !isPrivateConfigKey(config.key));
      
      // Get waypoints for each route
      const routesWithWaypoints = await Promise.all(
        routes.map(async (route) => ({
          ...route,
          waypoints: await storage.getWaypoints(route.id)
        }))
      );

      const exportData = {
        version: '3.0.0',
        exportDate: new Date().toISOString(),
        data: {
          routes: routesWithWaypoints,
          config: configs
        }
      };

      res.json(exportData);
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Import API - Restore data from JSON backup
  app.post("/api/import", async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }

      let importedRoutes = 0;
      let importedWaypoints = 0;
      let importedConfigs = 0;

      // Import routes and waypoints
      if (data.routes && Array.isArray(data.routes)) {
        for (const routeData of data.routes) {
          const { waypoints, id, createdAt, updatedAt, ...routeFields } = routeData;
          const newRoute = await storage.createRoute(routeFields);
          importedRoutes++;
          
          if (waypoints && Array.isArray(waypoints)) {
            const waypointsToCreate = waypoints.map((wp: any) => ({
              routeId: newRoute.id,
              name: wp.name,
              description: wp.description,
              latitude: wp.latitude,
              longitude: wp.longitude,
              order: wp.order
            }));
            await storage.createWaypoints(waypointsToCreate);
            importedWaypoints += waypoints.length;
          }
        }
      }

      // Import config
      if (data.config && Array.isArray(data.config)) {
        for (const configItem of data.config) {
          if (typeof configItem?.key !== "string" || isPrivateConfigKey(configItem.key)) continue;
          await storage.setConfig({ key: configItem.key, value: configItem.value });
          importedConfigs++;
        }
      }

      res.json({ 
        status: "success",
        imported: {
          routes: importedRoutes,
          waypoints: importedWaypoints,
          config: importedConfigs
        }
      });
    } catch (error) {
      console.error("Error importing data:", error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  console.log(`Secure WebSocket server initialized on /ws/telemetry${secureServer ? "" : " (TLS unavailable)"}`);

  return httpServer;
}
