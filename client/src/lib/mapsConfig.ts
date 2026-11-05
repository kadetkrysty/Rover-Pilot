import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { roverFetch } from "./roverConnection";
import { isDemoMode } from "./demoMode";

export const mapsConfigQueryKey = ["maps-configuration"];
const schema = z.object({
  browserKey: z.string().max(180),
  configured: z.boolean(),
  canManage: z.boolean(),
});
async function responseError(response: Response): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new Error(typeof body?.error === "string" ? body.error : "Could not access MiniPC map settings.");
}
export async function getMapsConfig() {
  if (isDemoMode()) throw new Error("Live map configuration is disabled in offline demo.");
  const response = await roverFetch("/api/maps/config");
  if (!response.ok) return responseError(response);
  return schema.parse(await response.json());
}
export async function saveMapsConfig(browserKey: string) {
  if (isDemoMode()) throw new Error("Settings cannot be changed in offline demo.");
  const response = await roverFetch("/api/maps/config", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ browserKey, publicBrowserKey: true }),
  });
  if (!response.ok) return responseError(response);
}
export function useMapsConfig() {
  return useQuery({
    queryKey: mapsConfigQueryKey, queryFn: getMapsConfig,
    enabled: !isDemoMode(), retry: false, staleTime: 60000,
  });
}
