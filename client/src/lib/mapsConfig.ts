import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { roverFetch } from "./roverConnection";
import { isDemoMode } from "./demoMode";
import { mapsConfigSchema, mapsSettingsSchema, mapSearchResultSchema, type MapsSettings } from "@shared/maps";

export const mapsConfigQueryKey = ["maps-configuration"];
async function responseError(response: Response): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new Error(typeof body?.error === "string" ? body.error : "Could not access MiniPC map settings.");
}
export async function getMapsConfig() {
  if (isDemoMode()) throw new Error("Live map configuration is disabled in offline demo.");
  const response = await roverFetch("/api/maps/config");
  if (!response.ok) return responseError(response);
  return mapsConfigSchema.parse(await response.json());
}
export async function saveMapsConfig(settings: MapsSettings) {
  if (isDemoMode()) throw new Error("Settings cannot be changed in offline demo.");
  const response = await roverFetch("/api/maps/config", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapsSettingsSchema.parse(settings)),
  });
  if (!response.ok) return responseError(response);
}
export async function searchMapAddress(query: string) {
  if (isDemoMode()) throw new Error("Address search is disabled in offline demo.");
  const response = await roverFetch("/api/maps/search", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) return responseError(response);
  return z.object({ results: z.array(mapSearchResultSchema).max(5) }).parse(await response.json()).results;
}
export function useMapsConfig() {
  return useQuery({
    queryKey: mapsConfigQueryKey, queryFn: getMapsConfig,
    enabled: !isDemoMode(), retry: false, staleTime: 60000,
  });
}
