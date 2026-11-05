import { useEffect, useState, type ReactNode } from "react";
import { useLoadScript } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";

let loadedBrowserKey = "";
let authHandlerInstalled = false;
let authenticationFailed = false;

/** One script identity/options for the dashboard and navigation maps. */
export function useRoverMapsScript(browserKey: string) {
  const [initialKey] = useState(() => {
    loadedBrowserKey ||= browserKey;
    return loadedBrowserKey;
  });
  const [authError, setAuthError] = useState(authenticationFailed);
  useEffect(() => {
    const failed = () => setAuthError(true);
    window.addEventListener("roveros:maps-auth-failure", failed);
    if (!authHandlerInstalled) {
      const target = window as Window & { gm_authFailure?: () => void };
      const previous = target.gm_authFailure;
      target.gm_authFailure = () => {
        authenticationFailed = true;
        window.dispatchEvent(new Event("roveros:maps-auth-failure"));
        previous?.();
      };
      authHandlerInstalled = true;
    }
    return () => window.removeEventListener("roveros:maps-auth-failure", failed);
  }, []);
  const result = useLoadScript({ googleMapsApiKey: initialKey, id: "rover-google-map" });
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (result.isLoaded || result.loadError) return;
    const timer = window.setTimeout(() => setTimedOut(true), 20000);
    return () => window.clearTimeout(timer);
  }, [result.isLoaded, result.loadError]);
  return { ...result, authError, timedOut, requiresReload: initialKey !== browserKey };
}

export function MapLoadError({ changed = false }: { changed?: boolean }) {
  return <div className="flex h-full min-h-32 flex-col items-center justify-center gap-3 p-4 text-center" role="alert">
    <p className="text-sm text-foreground">{changed ? "Map settings changed. Reload this client." : "Google Maps could not load."}</p>
    {!changed && <p className="max-w-md text-xs text-muted-foreground">
      Check internet access, Google billing, enabled Maps JavaScript/Geocoding APIs and website restrictions in Map Settings.
    </p>}
    <div className="flex flex-wrap justify-center gap-2">
      <Button variant="outline" onClick={() => window.location.reload()}>Reload client</Button>
      <Button variant="outline" asChild><a href="/settings/maps">Map Settings</a></Button>
    </div>
  </div>;
}

export default function MapsScript({ browserKey, children }: { browserKey: string; children: ReactNode }) {
  const script = useRoverMapsScript(browserKey);
  if (script.requiresReload || script.authError || script.timedOut || script.loadError) return <MapLoadError changed={script.requiresReload} />;
  if (!script.isLoaded) return <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground" role="status">Loading Google Maps…</div>;
  return <>{children}</>;
}
