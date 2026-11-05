import type { Express, Request, Response } from "express";
import { createConnection } from "node:net";
import { z } from "zod";
import { driveActionSchema, driveStatusSchema, unavailableDriveStatus } from "../shared/drive";
import type { AuthenticatedRoverClient } from "./clientAuth";

const SOCKET = "/run/roveros-control/control.sock";
type Authorize = (req: Request, res: Response) => Promise<AuthenticatedRoverClient | null>;
export class DriveBridgeError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export async function requestDriveController(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(SOCKET);
    let text = "";
    let finished = false;
    const finish = (error?: Error, data?: Record<string, unknown>) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      if (error) reject(error); else resolve(data!);
    };
    socket.setTimeout(700, () => finish(new DriveBridgeError("MiniPC motor-control service timed out; re-arm is required.")));
    socket.on("connect", () => socket.write(JSON.stringify(body) + "\n"));
    socket.on("error", () => finish(new DriveBridgeError("MiniPC motor-control service is unavailable.")));
    socket.on("end", () => { if (!finished) finish(new DriveBridgeError("Incomplete controller response.")); });
    socket.on("data", (chunk) => {
      text += chunk.toString("utf8");
      if (Buffer.byteLength(text) > 32768) return finish(new DriveBridgeError("Invalid controller response."));
      if (!text.includes("\n")) return;
      try {
        const message = z.object({ ok: z.boolean(), data: z.record(z.string(), z.unknown()).optional(),
          status: z.number().int().min(400).max(599).optional(), error: z.string().max(300).optional() }).parse(JSON.parse(text.split("\n")[0]));
        if (!message.ok) return finish(new DriveBridgeError(message.error || "Control request rejected.", message.status || 503));
        if (!message.data) throw new Error();
        finish(undefined, message.data);
      } catch { finish(new DriveBridgeError("Invalid controller response.")); }
    });
  });
}

export function registerDriveRoutes(app: Express, authorize: Authorize, bridge = requestDriveController) {
  const frameTimes = new Map<string, number>();
  const decorate = (data: Record<string, unknown>, client: AuthenticatedRoverClient) =>
    driveStatusSchema.parse({ ...data, canDrive: ["owner", "operator"].includes(client.role), canReset: client.role === "owner" });
  app.get("/api/drive/status", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const client = await authorize(req, res);
    if (!client) return;
    if (client.role === "rover") return res.status(403).json({ error: "A viewing client is required." });
    try { res.json(decorate(await bridge({ action: "status", owner: client.id }), client)); }
    catch { res.json(unavailableDriveStatus()); }
  });
  app.post("/api/drive/action", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const client = await authorize(req, res);
    if (!client) return;
    if (!["owner", "operator"].includes(client.role)) return res.status(403).json({ error: "Only paired owners/operators can control the rover." });
    const parsed = driveActionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid drive action." });
    if (parsed.data.action === "reset" && client.role !== "owner")
      return res.status(403).json({ error: "Only the owner may reset the latched E-STOP." });
    if (parsed.data.action === "frame") {
      const now = performance.now();
      if (now - (frameTimes.get(client.id) ?? -Infinity) < 40)
        return res.status(429).json({ error: "Drive input exceeds the 25 Hz rate limit." });
      if (frameTimes.size >= 512 && !frameTimes.has(client.id)) frameTimes.delete(frameTimes.keys().next().value!);
      frameTimes.set(client.id, now);
    }
    try { res.json(decorate(await bridge({ ...parsed.data, owner: client.id }), client)); }
    catch (error) {
      res.status(error instanceof DriveBridgeError ? error.status : 503)
        .json({ error: error instanceof DriveBridgeError ? error.message : "Motor controller returned an invalid response." });
    }
  });
}
