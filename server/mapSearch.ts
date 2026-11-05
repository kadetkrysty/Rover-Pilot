import { z } from "zod";
import { mapSearchResultSchema, type MapSearchResult } from "../shared/maps";

export class MapSearchError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// One server-side gateway for all paired clients: no autocomplete, credentials,
// arbitrary upstream URLs, parallel upstream calls or unbounded query cache.
export function createPhotonSearch(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expires: number; results: MapSearchResult[] }>();
  let nextRequest = 0;
  let busy = false;
  const featureSchema = z.object({
    geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(), z.number()]) }),
    properties: z.object({
      name: z.string().optional(), street: z.string().optional(),
      city: z.string().optional(), country: z.string().optional(),
    }),
  });
  return async (query: string): Promise<MapSearchResult[]> => {
    const key = query.trim().replace(/\s+/g, " ").toLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.results;
    if (busy || now() < nextRequest) throw new MapSearchError("Please wait a moment before searching again.", 429);
    busy = true;
    nextRequest = now() + 1100;
    try {
      const url = new URL("https://photon.komoot.io/api/");
      url.search = new URLSearchParams({ q: query, limit: "5" }).toString();
      const response = await fetcher(url, {
        headers: { Accept: "application/json", "User-Agent": "RoverOS/1.0 (MiniPC map search; https://github.com/kadetkrysty/Rover-Pilot)" },
        redirect: "error", signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new MapSearchError("Address search is unavailable. Try coordinates or search later.", 503);
      // Bound upstream response size, including streamed responses without a length.
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Empty search response");
      let text = "";
      let bytes = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 100_000) throw new Error("Oversized search response");
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const body = z.object({ features: z.array(z.unknown()).max(20) }).parse(JSON.parse(text));
      const results: MapSearchResult[] = [];
      for (const raw of body.features.slice(0, 5)) {
        const feature = featureSchema.safeParse(raw);
        if (!feature.success) continue;
        const { geometry, properties } = feature.data;
        const result = mapSearchResultSchema.safeParse({
          lat: geometry.coordinates[1], lng: geometry.coordinates[0],
          label: [properties.name, properties.street, properties.city, properties.country].filter(Boolean).join(", ").slice(0, 300),
        });
        if (result.success) results.push(result.data);
      }
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: now() + 600_000, results });
      return results;
    } catch (error) {
      if (error instanceof MapSearchError) throw error;
      throw new MapSearchError("Address search could not connect. Try coordinates or search later.", 503);
    } finally { busy = false; }
  };
}
