import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoMode } from "@/lib/demoMode";
import { mapsConfigQueryKey, saveMapsConfig, useMapsConfig } from "@/lib/mapsConfig";
import { toast } from "sonner";

export default function MapSettings() {
  const demo = isDemoMode();
  const config = useMapsConfig();
  const queryClient = useQueryClient();
  const [replacement, setReplacement] = useState("");
  const [confirmedPublic, setConfirmedPublic] = useState(false);
  const save = useMutation({
    mutationFn: saveMapsConfig,
    onSuccess: () => {
      setReplacement("");
      setConfirmedPublic(false);
      void queryClient.invalidateQueries({ queryKey: mapsConfigQueryKey });
      toast.success("Map settings saved on the MiniPC. Reload connected clients to apply changes.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6" data-testid="page-map-settings">
    <div><h1 className="font-display text-2xl text-primary">MAP SETTINGS</h1>
      <p className="mt-2 text-sm text-muted-foreground">Configure Google Maps once on RoverOS-Server for connected clients.</p></div>
    {demo ? <section className="hud-panel space-y-3 p-5">
      <h2 className="font-display text-primary">OFFLINE DEMO</h2>
      <p className="text-sm text-muted-foreground">Demo Mode uses a bundled sample map. It does not load Google Maps, accept API keys or change MiniPC settings.</p>
      <p className="text-sm text-muted-foreground">Exit Demo Mode, connect to the MiniPC and use an owner-paired client to configure live maps here.</p>
    </section> : <section className="hud-panel space-y-4 p-5">
      <h2 className="font-display text-primary">MINIPC CONFIGURATION</h2>
      {config.isLoading && <p role="status">Loading MiniPC settings…</p>}
      {config.error && <div role="alert" className="space-y-3 text-sm">
        <p>{config.error.message}</p><p className="text-muted-foreground">Connect using a paired RoverOS client. Only the owner can change map settings.</p>
        <Button variant="outline" onClick={() => void config.refetch()}>Retry</Button>
      </div>}
      {config.data && <>
        <p className="text-sm">Status: <strong>{config.data.configured ? "Configured on MiniPC" : "Not configured"}</strong></p>
        {config.data.canManage ? <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (replacement.trim() && confirmedPublic) save.mutate(replacement.trim());
        }}>
          <Label htmlFor="maps-browser-key">{config.data.configured ? "Replacement Maps JavaScript browser key" : "Maps JavaScript browser key"}</Label>
          <Input id="maps-browser-key" type="password" value={replacement} maxLength={180} autoComplete="off"
            spellCheck={false} onChange={(event) => setReplacement(event.target.value)}
            aria-describedby="maps-key-help" placeholder="Restricted Google Maps browser key" />
          <p id="maps-key-help" className="text-xs leading-relaxed text-muted-foreground">
            Use a restricted public browser key only. Never enter a service-account private key, server key or other secret.
            The existing value is not prefilled. No key is stored in this client’s local storage.
          </p>
          <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor="maps-public-confirmation">
            <input id="maps-public-confirmation" type="checkbox" checked={confirmedPublic}
              onChange={(event) => setConfirmedPublic(event.target.checked)} className="h-5 w-5 accent-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
            This is a restricted public browser key intended for client use.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!replacement.trim() || !confirmedPublic || save.isPending}>{save.isPending ? "Saving…" : "Save on MiniPC"}</Button>
            {config.data.configured && <Button type="button" variant="destructive" disabled={save.isPending}
              onClick={() => { if (window.confirm("Remove Google Maps configuration for all connected clients?")) save.mutate(""); }}>Remove configuration</Button>}
          </div>
        </form> : <p className="text-sm text-muted-foreground">Read-only access. Use the owner-paired client to update this MiniPC configuration.</p>}
      </>}
    </section>}
    <section className="hud-panel space-y-3 p-5 text-sm">
      <h2 className="font-display text-primary">GOOGLE CLOUD REQUIREMENTS</h2>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>Enable billing and Maps JavaScript API. Enable Geocoding API for address search.</li>
        <li>Restrict the browser key to those APIs and the exact authorized HTTP/HTTPS app origins. Configure usage quotas and billing alerts.</li>
        <li>A JavaScript browser key is visible to clients by design, even when stored centrally. It is not a server secret.</li>
        <li>Local/custom-scheme WebViews may omit the referrer Google needs. Do not remove restrictions to work around this; use a controlled HTTPS-hosted map or an appropriate native Maps SDK for production.</li>
        <li>Live maps require internet access and send map requests, viewport coordinates and network information to Google. Offline Demo makes no Google requests.</li>
      </ul>
      <p className="break-all text-xs text-muted-foreground">This renderer’s origin: {window.location.origin}</p>
      <p className="text-xs text-muted-foreground">After replacing or removing the key, reload all connected clients.</p>
      <a className="inline-block text-primary underline underline-offset-4" href="https://developers.google.com/maps/api-security-best-practices"
        target="_blank" rel="noreferrer">Google Maps security guidance</a>
    </section>
    <Button variant="outline" asChild><Link href={demo ? "/navigation?demo=1" : "/navigation"}>Back to Navigation</Link></Button>
  </div>;
}
