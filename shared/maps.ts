import { z } from "zod";

export const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function isPublicTileUrl(value: string): boolean {
  try {
    if (!["{z}", "{x}", "{y}"].every((part) => value.includes(part))) return false;
    const url = new URL(value.replace(/\{[zxy]\}/g, "0"));
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.search && !url.hash && !url.port &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(url.hostname) &&
      !/\.(?:local|localhost|internal|lan|home|onion|test|invalid)$/i.test(url.hostname);
  } catch { return false; }
}

export const mapsSettingsSchema = z.object({
  tilesEnabled: z.boolean(),
  tileUrl: z.string().trim().max(500).refine(isPublicTileUrl, "Use a public HTTPS tile template containing {z}, {x} and {y}, without credentials or query parameters."),
  tileAttribution: z.string().trim().max(160),
  searchEnabled: z.boolean(),
}).strict();
export type MapsSettings = z.infer<typeof mapsSettingsSchema>;
export const defaultMapsSettings: MapsSettings = {
  tilesEnabled: true, tileUrl: DEFAULT_TILE_URL, tileAttribution: "", searchEnabled: true,
};
export const mapsConfigSchema = mapsSettingsSchema.extend({
  provider: z.literal("openstreetmap"), canManage: z.boolean(),
});
export const mapSearchResultSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  label: z.string().max(300),
});
export type MapSearchResult = z.infer<typeof mapSearchResultSchema>;

export function parseCoordinates(value: string): MapSearchResult | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const parsed = mapSearchResultSchema.safeParse({
    lat: Number(match[1]), lng: Number(match[2]), label: value.trim(),
  });
  return parsed.success ? parsed.data : null;
}
