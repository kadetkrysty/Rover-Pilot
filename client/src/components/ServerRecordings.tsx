import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Video, Download, Play, Square, Trash2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  getRecordingLibrary, startServerRecording, stopServerRecording,
  deleteServerRecording, loadRecordingBlob,
} from "@/lib/recordingApi";
import { saveRecording } from "@/lib/saveRecording";
import type { RoverRecording } from "@shared/recordings";

const bytes = (value: number) => value >= 1024 ** 3
  ? `${(value / 1024 ** 3).toFixed(1)} GiB` : `${(value / 1024 ** 2).toFixed(1)} MiB`;
const duration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;

export default function ServerRecordings() {
  const queryClient = useQueryClient();
  const library = useQuery({
    queryKey: ["rover-recordings"], queryFn: getRecordingLibrary, refetchInterval: 3000,
    retry: false,
  });
  const data = library.data;
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState<{ entry: RoverRecording; blob: Blob; url: string } | null>(null);
  const loadedRef = useRef<typeof loaded>(null);
  const transferRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const clearPlayer = () => {
    if (loadedRef.current) URL.revokeObjectURL(loadedRef.current.url);
    loadedRef.current = null;
    setLoaded(null);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      transferRef.current?.abort();
      if (loadedRef.current) URL.revokeObjectURL(loadedRef.current.url);
    };
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["rover-recordings"] });
  const capture = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      const entry = action === "start" ? await startServerRecording() : await stopServerRecording();
      if (entry.status === "failed") throw new Error(entry.error || "The rover camera recording failed.");
      return action;
    },
    onSuccess: (action) => {
      toast.success(action === "start" ? "MiniPC camera recording is starting." : "Recording saved on the MiniPC.");
      void refresh();
    },
    onError: (error: Error) => { toast.error(error.message); void refresh(); },
  });
  const deletion = useMutation({
    mutationFn: deleteServerRecording,
    onSuccess: (_result, id) => {
      if (loadedRef.current?.entry.id === id) clearPlayer();
      toast.success("Recording permanently deleted from the MiniPC.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const open = async (entry: RoverRecording, download = false) => {
    if (busy) return;
    const controller = new AbortController();
    transferRef.current = controller;
    setBusy(entry.id);
    setProgress(0);
    try {
      let blob = loadedRef.current?.entry.id === entry.id ? loadedRef.current.blob : undefined;
      if (blob) setProgress(100);
      if (!blob) {
        blob = await loadRecordingBlob(entry, (percent) => {
          if (mounted.current && !controller.signal.aborted) setProgress(percent);
        }, controller.signal);
      }
      if (!mounted.current || controller.signal.aborted) return;
      if (download) {
        await saveRecording(blob, entry.fileName, controller.signal);
        if (mounted.current) toast.success("Video export requested. Check the selected client download location.");
      } else {
        clearPlayer();
        const selected = { entry, blob, url: URL.createObjectURL(blob) };
        loadedRef.current = selected;
        setLoaded(selected);
      }
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) {
        toast.error(error instanceof Error ? error.message : "Could not load this recording.");
      }
    } finally {
      if (mounted.current) setBusy(null);
      if (transferRef.current === controller) transferRef.current = null;
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-6" data-testid="page-video-recordings">
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold text-primary sm:text-3xl">VIDEO RECORDINGS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rover camera footage saved on RoverOS-Server</p>
      </header>
      {library.error && (
        <div role="alert" className="mb-4 rounded border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <p>{library.error.message}</p>
          <Button variant="outline" className="mt-3" onClick={() => void library.refetch()}>Retry connection</Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <aside className="space-y-4 xl:col-span-4">
          <Card className="hud-panel p-4">
            <h2 className="mb-4 font-display text-sm text-primary">RECORDING CONTROLS</h2>
            <p role="status" className="font-mono text-sm" data-testid="recording-service-status">
              {library.isLoading ? "CONNECTING…" : !data ? "UNAVAILABLE" :
                data.active ? `${data.active.status.toUpperCase()} · ${duration(data.active.durationSeconds)}` : "STANDBY"}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {data && !data.available ? "FFmpeg is missing on the MiniPC. Install the recording dependencies." :
                data && !data.cameraConfigured ? "Configure ROVEROS_RECORDING_STREAM_URL, IMOU_CAMERA_STREAM_URL or ROVER_HOST on the MiniPC before recording." :
                  "Records the configured rover camera on the MiniPC. It does not record this phone or PC camera or microphone."}
            </p>
            <div className="mt-4">
              {data?.active ? (
                <Button className="w-full" variant="destructive" disabled={!data.canRecord || capture.isPending || Boolean(library.error)}
                  onClick={() => capture.mutate("stop")} data-testid="button-stop-recording">
                  <Square aria-hidden="true" className="mr-2 h-4 w-4" /> Stop and save
                </Button>
              ) : (
                <Button className="w-full" disabled={!data?.canRecord || !data.available || !data.cameraConfigured || capture.isPending || Boolean(library.error)}
                  onClick={() => capture.mutate("start")} data-testid="button-start-recording">
                  <Video aria-hidden="true" className="mr-2 h-4 w-4" /> Start rover recording
                </Button>
              )}
            </div>
            {data && !data.canRecord && <p className="mt-3 text-xs text-muted-foreground">Only owner and operator devices can start or stop recording.</p>}
          </Card>
          <Card className="hud-panel space-y-3 p-4 text-sm">
            <h2 className="font-display text-primary">MINIPC STORAGE</h2>
            <p>{data ? `${bytes(data.usedBytes)} used / ${bytes(data.quotaBytes)} quota` : "Storage not available"}</p>
            <p className="text-muted-foreground">
              Clips automatically stop after {data?.maxSeconds || 120} seconds or 32 MiB.
              Video only, up to 720p at 15 fps.
            </p>
            <p className="text-muted-foreground">
              Footage is automatically deleted after {data?.retentionDays || 7} days.
              Oldest clips are also removed when the 2 GiB quota or 200-clip limit is reached.
              Export footage you need to keep.
            </p>
          </Card>
        </aside>
        <section aria-labelledby="recording-library-title" className="min-w-0 xl:col-span-8">
          <Card className="hud-panel space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="recording-library-title" className="font-display text-sm text-primary">SHARED RECORDING LIBRARY</h2>
              <Button variant="outline" size="sm" onClick={() => void library.refetch()} aria-label="Refresh recording library">
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
            {busy && (
              <div role="status" className="rounded border border-primary/40 bg-primary/5 p-3 text-sm">
                <p>Secure video transfer / export: {progress}%</p>
                <progress aria-label="Video transfer progress" max={100} value={progress} className="mt-2 w-full" />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => transferRef.current?.abort()}>
                  Cancel transfer
                </Button>
              </div>
            )}
            {loaded && (
              <figure>
                <video className="aspect-video w-full rounded border border-primary/30 bg-black"
                  src={loaded.url} controls playsInline preload="metadata"
                  aria-label={`Rover recording from ${new Date(loaded.entry.createdAt).toLocaleString()}`}
                  data-testid="recording-player" />
                <figcaption className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="break-all">{loaded.entry.fileName}</span>
                  <Button size="sm" variant="outline" aria-label="Close video player" onClick={clearPlayer}><X className="h-4 w-4" /></Button>
                </figcaption>
              </figure>
            )}
            {data?.recordings.map((entry) => (
              <article key={entry.id} className="rounded border border-border p-3" data-testid={`card-recording-${entry.id}`}>
                <h3 className="break-all font-mono text-sm font-semibold">{entry.fileName}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString()} · {duration(entry.durationSeconds)} · {bytes(entry.bytes)} · {entry.status.toUpperCase()}
                </p>
                {entry.error && <p className="mt-2 text-sm text-destructive" role="status">{entry.error}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.status === "completed" && <>
                    <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void open(entry)}>
                      <Play aria-hidden="true" className="mr-2 h-4 w-4" /> Load video
                    </Button>
                    <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void open(entry, true)}>
                      <Download aria-hidden="true" className="mr-2 h-4 w-4" /> Export
                    </Button>
                  </>}
                  {data.canDelete && !["starting", "recording"].includes(entry.status) && (
                    <Button size="sm" variant="outline" disabled={deletion.isPending || Boolean(busy)}
                      aria-label={`Permanently delete ${entry.fileName}`}
                      onClick={() => {
                        if (window.confirm(`Permanently delete ${entry.fileName} from the MiniPC for every client?`)) deletion.mutate(entry.id);
                      }}>
                      <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  )}
                </div>
              </article>
            ))}
            {data && data.recordings.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No saved rover recordings yet.</p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Playback loads one bounded clip through certificate-pinned, authenticated requests.
              Both Android and Windows see the same MiniPC library. Exports are copies on the client device.
            </p>
          </Card>
        </section>
      </div>
    </main>
  );
}
