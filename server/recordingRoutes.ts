import type { Express, Request, Response } from "express";
import type { AuthenticatedRoverClient } from "./clientAuth";
import { RecordingService } from "./recordings";

type Authorize = (req: Request, res: Response) => Promise<AuthenticatedRoverClient | null>;
export const recordingService = new RecordingService();

export function registerRecordingRoutes(
  app: Express, authorize: Authorize, service = recordingService,
) {
  const handler = (
    permission: "read" | "record" | "delete",
    action: (req: Request, res: Response, client: AuthenticatedRoverClient) => Promise<void>,
  ) => async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const client = await authorize(req, res);
      if (!client) return;
      if (client.role === "rover" ||
          (permission === "record" && !["owner", "operator"].includes(client.role)) ||
          (permission === "delete" && client.role !== "owner")) {
        res.status(403).json({ error: "This paired device is not allowed to perform that recording action." });
        return;
      }
      await action(req, res, client);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Never expose filesystem paths, camera addresses/credentials, or FFmpeg stderr.
      const safeMessages = [
        "Invalid recording ID.", "Invalid recording offset.", "Recording not found.",
        "Completed recording not found.", "Recording size or offset is invalid.",
        "Recording read was interrupted.", "Stop the recording before deleting it.",
        "A recording is already in progress.", "No recording is in progress.",
        "Server is shutting down.", "Configure the rover camera stream before recording.",
        "FFmpeg is missing. Install the MiniPC recording dependencies.",
        "At least 1 GiB of free MiniPC disk space is required.",
      ];
      const safe = safeMessages.includes(message);
      const status = message.includes("not found") ? 404 :
        message.startsWith("Invalid") || message.includes("offset is invalid") ? 400 :
        message.includes("in progress") || message.startsWith("Stop the recording") ? 409 : 503;
      res.status(status).json({ error: safe ? message : "MiniPC recording storage or camera configuration is unavailable." });
    }
  };

  app.get("/api/recordings", handler("read", async (_req, res, client) => {
    res.json({
      ...await service.status(),
      canRecord: client.role === "owner" || client.role === "operator",
      canDelete: client.role === "owner",
    });
  }));
  app.post("/api/recordings/start", handler("record", async (req, res, client) => {
    if (req.body && (typeof req.body !== "object" || Object.keys(req.body).length)) {
      res.status(400).json({ error: "Recording settings are configured on the MiniPC, not supplied by clients." });
      return;
    }
    res.status(202).json(await service.start(client.id));
  }));
  app.post("/api/recordings/stop", handler("record", async (_req, res) => {
    res.json(await service.stop());
  }));
  app.delete("/api/recordings/:id", handler("delete", async (req, res) => {
    await service.delete(String(req.params.id));
    res.status(204).end();
  }));
  app.get("/api/recordings/:id/chunks/:offset", handler("read", async (req, res) => {
    const rawOffset = String(req.params.offset);
    if (!/^(0|[1-9][0-9]{0,9})$/.test(rawOffset)) {
      res.status(400).json({ error: "Invalid recording offset." });
      return;
    }
    res.json(await service.chunk(String(req.params.id), Number(rawOffset)));
  }));
}
