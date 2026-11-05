import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import type { RoverClientRole } from "./clientAuth";

import { defaultMapsSettings, mapsSettingsSchema } from "../shared/maps";
import { createPhotonSearch, MapSearchError } from "./mapSearch";
const KEY = "maps_settings";
// Only public map preferences belong here, never provider or rover credentials.
type Authorize = (req: Request, res: Response) => Promise<{ role: RoverClientRole } | null>;
type Store = Pick<typeof storage, "getConfig" | "setConfig">;

export function registerMapsRoutes(app: Express, authorize: Authorize, store: Store = storage) {
  const search = createPhotonSearch();
  async function readSettings() {
    const config = await store.getConfig(KEY);
    if (!config?.value) return defaultMapsSettings;
    return mapsSettingsSchema.parse(JSON.parse(config.value));
  }
  app.get("/api/maps/config", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const client = await authorize(req, res);
      if (!client) return;
      if (client.role === "rover") return res.status(403).json({ error: "A paired viewing client is required." });
      res.json({ ...await readSettings(), provider: "openstreetmap", canManage: client.role === "owner" });
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
      const parsed = mapsSettingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Supply valid map toggles and a public HTTPS tile template without credentials." });
      await store.setConfig({ key: KEY, value: JSON.stringify(parsed.data) });
      res.json({ saved: true });
    } catch {
      res.status(503).json({ error: "MiniPC map settings could not be saved." });
    }
  });
  app.post("/api/maps/search", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const client = await authorize(req, res);
      if (!client) return;
      if (client.role === "rover") return res.status(403).json({ error: "A paired viewing client is required." });
      const parsed = z.object({ query: z.string().trim().min(3).max(160).regex(/^[^\u0000-\u001f\u007f]+$/) }).strict().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Enter an address between 3 and 160 characters." });
      if (!(await readSettings()).searchEnabled) return res.status(403).json({ error: "The owner has disabled address search. Latitude, longitude lookup remains available." });
      res.json({ results: await search(parsed.data.query) });
    } catch (error) {
      if (error instanceof MapSearchError) {
        if (error.status === 429) res.setHeader("Retry-After", "2");
        return res.status(error.status).json({ error: error.message });
      }
      res.status(503).json({ error: "MiniPC address search is temporarily unavailable." });
    }
  });
}
