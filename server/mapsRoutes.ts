import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import type { RoverClientRole } from "./clientAuth";

const KEY = "google_maps_api_key";
// Only a restricted PUBLIC Maps JavaScript browser key belongs here.
// Server/service-account credentials must never be returned to renderers.
const browserKey = z.string().trim().max(180).refine(
  (value) => value === "" || /^AIza[A-Za-z0-9_-]{20,160}$/.test(value),
  "Enter a Google Maps JavaScript browser key, not server credentials.",
);
const settings = z.object({ browserKey, publicBrowserKey: z.literal(true) }).strict();
type Authorize = (req: Request, res: Response) => Promise<{ role: RoverClientRole } | null>;
type Store = Pick<typeof storage, "getConfig" | "setConfig">;

export function registerMapsRoutes(app: Express, authorize: Authorize, store: Store = storage) {
  app.get("/api/maps/config", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const client = await authorize(req, res);
      if (!client) return;
      if (client.role === "rover") return res.status(403).json({ error: "A paired viewing client is required." });
      const config = await store.getConfig(KEY);
      const parsed = browserKey.safeParse(config?.value || "");
      const value = parsed.success ? parsed.data : "";
      res.json({ browserKey: value, configured: Boolean(value), canManage: client.role === "owner" });
    } catch {
      res.status(503).json({ error: "MiniPC map settings are temporarily unavailable." });
    }
  });
  app.post("/api/maps/config", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const client = await authorize(req, res);
      if (!client) return;
      if (client.role !== "owner") return res.status(403).json({ error: "Only the owner can change MiniPC map settings." });
      const parsed = settings.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Supply only a valid Maps JavaScript browser key, or an empty string to remove it." });
      await store.setConfig({ key: KEY, value: parsed.data.browserKey });
      // Do not echo keys in write responses or error logs.
      res.json({ configured: Boolean(parsed.data.browserKey) });
    } catch {
      res.status(503).json({ error: "MiniPC map settings could not be saved." });
    }
  });
}
