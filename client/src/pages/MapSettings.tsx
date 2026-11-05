import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoMode } from "@/lib/demoMode";
import { mapsConfigQueryKey, saveMapsConfig, useMapsConfig } from "@/lib/mapsConfig";
import { toast } from "sonner";
import { DEFAULT_TILE_URL, isPublicTileUrl } from "@shared/maps";

function SettingsToggle({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border/70 bg-background/40 p-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-sm font-semibold">{title}</Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export default function MapSettings() {
  const demo = isDemoMode();
  const config = useMapsConfig();
  const queryClient = useQueryClient();
  const [tilesEnabled, setTilesEnabled] = useState(true);
  const [tileUrl, setTileUrl] = useState(DEFAULT_TILE_URL);
  const [tileAttribution, setTileAttribution] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(true);

  useEffect(() => {
    if (!config.data) return;
    setTilesEnabled(config.data.tilesEnabled);
    setTileUrl(config.data.tileUrl);
    setTileAttribution(config.data.tileAttribution);
    setSearchEnabled(config.data.searchEnabled);
  }, [config.data]);

  const tileUrlValid = useMemo(() => isPublicTileUrl(tileUrl.trim()), [tileUrl]);
  const dirty = !!config.data && (
    tilesEnabled !== config.data.tilesEnabled
    || tileUrl.trim() !== config.data.tileUrl
    || tileAttribution !== config.data.tileAttribution
    || searchEnabled !== config.data.searchEnabled
  );
  const save = useMutation({
    mutationFn: saveMapsConfig,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mapsConfigQueryKey });
      toast.success("Map settings saved on the MiniPC. Reload connected clients to apply changes.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto min-h-[100dvh] max-w-3xl space-y-5 p-4 pb-10 sm:p-6" data-testid="page-map-settings">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">RoverOS · Central configuration</p>
        <h1 className="font-display text-2xl text-primary sm:text-3xl">MAP SETTINGS</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Choose how paired rover clients load map tiles and look up an address. Settings are stored on the MiniPC.
        </p>
      </header>

      {demo ? (
        <section className="hud-panel space-y-3 p-5" aria-labelledby="demo-heading">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Bundled sample · no live services</p>
          <h2 id="demo-heading" className="font-display text-lg text-primary">OFFLINE DEMO</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Demo Mode displays a bundled local sample map. It has no map configuration inputs and makes no configuration or map-service requests.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            To configure central live-map settings, exit Demo Mode and connect from a paired RoverOS client. Only the owner can save changes.
          </p>
        </section>
      ) : (
        <>
          <section className="hud-panel space-y-4 p-4 sm:p-5" aria-labelledby="config-heading">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">OpenStreetMap · MiniPC</p>
              <h2 id="config-heading" className="font-display text-lg text-primary">CENTRAL MAP CONFIGURATION</h2>
            </div>

            {config.isLoading && (
              <div role="status" aria-label="Loading map settings" className="space-y-3">
                <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                <div className="h-20 animate-pulse rounded bg-muted/70" />
                <div className="h-20 animate-pulse rounded bg-muted/70" />
              </div>
            )}
            {config.error && (
              <div role="alert" className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
                <p className="font-semibold">Could not load the MiniPC map settings.</p>
                <p className="text-muted-foreground">{config.error.message}</p>
                <p className="text-muted-foreground">Connect using a paired RoverOS client. Only the owner can change these settings.</p>
                <Button type="button" variant="outline" onClick={() => void config.refetch()} disabled={config.isFetching}>
                  {config.isFetching ? "Retrying…" : "Retry"}
                </Button>
              </div>
            )}
            {config.data && (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-border/70 py-3 text-sm">
                  <span className="text-muted-foreground">Access</span>
                  <strong>{config.data.canManage ? "Owner · can manage" : "Read-only"}</strong>
                  <span aria-hidden="true" className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground">Provider</span>
                  <strong>OpenStreetMap</strong>
                </div>
                {config.data.canManage ? (
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!dirty || !tileUrlValid || save.isPending) return;
                      save.mutate({ tilesEnabled, tileUrl: tileUrl.trim(), tileAttribution, searchEnabled });
                    }}
                  >
                    <SettingsToggle
                      id="osm-tiles-enabled"
                      title="Live map tiles"
                      description="Load standard OpenStreetMap tiles in connected clients. Clients need an internet connection."
                      checked={tilesEnabled}
                      disabled={save.isPending}
                      onChange={setTilesEnabled}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="osm-tile-url">Public HTTPS tile URL template</Label>
                      <Input
                        id="osm-tile-url"
                        type="text"
                        value={tileUrl}
                        onChange={(event) => setTileUrl(event.target.value)}
                        disabled={save.isPending}
                        autoComplete="url"
                        spellCheck={false}
                        aria-describedby="osm-tile-help osm-tile-error"
                        placeholder={DEFAULT_TILE_URL}
                      />
                      <p id="osm-tile-help" className="text-xs leading-relaxed text-muted-foreground">
                        Must use HTTPS and contain {"{z}"}, {"{x}"} and {"{y}"} path placeholders. Use a public DNS hostname only—no IP, credentials, query string, or fragment. Default: {DEFAULT_TILE_URL}
                      </p>
                      {!tileUrlValid && (
                        <p id="osm-tile-error" role="alert" className="text-xs font-medium text-destructive">
                          Enter a valid public HTTPS tile URL template with {"{z}"}, {"{x}"} and {"{y}"} and no credentials, query, or fragment.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tile-attribution">
                        Additional tile-provider attribution <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="tile-attribution"
                        type="text"
                        value={tileAttribution}
                        onChange={(event) => setTileAttribution(event.target.value)}
                        disabled={save.isPending}
                        maxLength={160}
                        autoComplete="off"
                        aria-describedby="tile-attribution-help"
                      />
                      <p id="tile-attribution-help" className="text-xs leading-relaxed text-muted-foreground">
                        Up to 160 characters. Use this for extra credits required by other OpenStreetMap-derived tile providers. The default OpenStreetMap copyright attribution always remains visible.
                      </p>
                    </div>
                    <SettingsToggle
                      id="photon-search-enabled"
                      title="Manual address search"
                      description="Allow explicit address searches through the public Photon geocoding service. Searches are not automatic."
                      checked={searchEnabled}
                      disabled={save.isPending}
                      onChange={setSearchEnabled}
                    />
                    <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center">
                      <Button type="submit" disabled={!dirty || !tileUrlValid || save.isPending}>
                        {save.isPending ? "Saving settings…" : "Save settings on MiniPC"}
                      </Button>
                      <p className="text-xs text-muted-foreground" role="status">
                        {!tileUrlValid ? "Fix the tile URL before saving." : dirty ? "Unsaved changes" : "Settings are up to date."}
                      </p>
                    </div>
                    {save.isError && (
                      <p role="alert" className="text-sm text-destructive">
                        Settings could not be saved: {save.error.message}
                      </p>
                    )}
                  </form>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Read-only access. These central settings are managed by the owner-paired client.
                    </p>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-md border border-border/70 p-3">
                        <dt className="text-xs text-muted-foreground">Live tiles</dt>
                        <dd className="mt-1 font-medium">{config.data.tilesEnabled ? "Enabled" : "Disabled"}</dd>
                      </div>
                      <div className="rounded-md border border-border/70 p-3">
                        <dt className="text-xs text-muted-foreground">Manual address search</dt>
                        <dd className="mt-1 font-medium">{config.data.searchEnabled ? "Enabled" : "Disabled"}</dd>
                      </div>
                    </dl>
                    <div className="space-y-1">
                      <Label htmlFor="osm-tile-url-readonly">Tile URL template</Label>
                      <Input id="osm-tile-url-readonly" value={config.data.tileUrl} readOnly aria-readonly="true" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tile-attribution-readonly">Additional tile-provider attribution</Label>
                      <Input id="tile-attribution-readonly" value={config.data.tileAttribution || ""} readOnly aria-readonly="true" />
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="hud-panel space-y-4 p-4 text-sm sm:p-5" aria-labelledby="service-notes-heading">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Service notes</p>
              <h2 id="service-notes-heading" className="mt-1 font-display text-lg text-primary">WHAT CLIENTS SEND</h2>
            </div>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>No Google or other map API keys, billing account, or key entry is needed for the default OpenStreetMap tiles.</li>
              <li>Live maps need internet access. Map requests, viewport coordinates, and network information are sent to the configured tile service.</li>
              <li>Visible OpenStreetMap attribution must remain displayed wherever the map appears. Standard tiles do not provide satellite imagery or automatic road routing.</li>
              <li>Public tiles are best effort: no bulk requests, offline downloads, or prefetching. Review the tile usage policy before choosing a provider.</li>
              <li>Photon is used only when someone explicitly searches an address. RoverOS uses server-side caching and throttling for those requests.</li>
              <li>Queries and viewport data go to external map/search services; rover credentials are not shared with them.</li>
            </ul>
            <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:gap-5">
              <a className="min-h-11 inline-flex items-center text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noreferrer">
                OpenStreetMap tile usage policy
              </a>
              <a className="min-h-11 inline-flex items-center text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href="https://github.com/komoot/photon" target="_blank" rel="noreferrer">
                Photon project and documentation
              </a>
            </div>
          </section>
        </>
      )}

      <Button variant="outline" asChild>
        <Link href={demo ? "/navigation?demo=1" : "/navigation"}>Back to Navigation</Link>
      </Button>
    </main>
  );
}
