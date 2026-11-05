import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isDemoMode } from "@/lib/demoMode";
import { demoVideoRecording } from "@/lib/demoVideos";
import { Clock, Download, Film, HardDrive, Play } from "lucide-react";
import ServerRecordings from "@/components/ServerRecordings";

export default function VideoRecordings() {
  return isDemoMode() ? <DemoVideoRecordings /> : <ServerRecordings />;
}

function DemoVideoRecordings() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const playSample = () => {
    void videoRef.current?.play().catch(() => {
      videoRef.current?.focus();
    });
  };

  return (
    <main
      className="min-h-screen bg-background p-4 font-sans text-foreground sm:p-6"
      data-testid="page-video-recordings"
    >
      <header className="mb-6">
        <h1
          className="text-2xl font-display font-bold text-primary sm:text-3xl"
          data-testid="text-video-title"
        >
          VIDEO RECORDINGS
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Mission footage and playback
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6">
        <div className="space-y-4 xl:col-span-4">
          <Card className="hud-panel p-4">
            <h2 className="mb-4 text-sm font-display text-primary">
              RECORDING CONTROLS
            </h2>
            <div
              className="flex items-center gap-2"
              role="status"
              data-testid="recording-service-status"
            >
              <span
                aria-hidden="true"
                className="h-3 w-3 rounded-full bg-primary"
              />
              <span className="font-mono text-sm">
                DEMO PLAYBACK ONLY
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The bundled sample can be played and downloaded. Demo Mode does not record or save camera footage.
            </p>
          </Card>

          <Card className="hud-panel p-4">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-display text-primary">
              <HardDrive aria-hidden="true" className="h-4 w-4" />
              STORAGE
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">MiniPC recording storage</dt>
                <dd>Not used</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Included sample clips</dt>
                <dd>1 (bundled with app)</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              The sample is an app asset, not a recording on the MiniPC.
            </p>
          </Card>

          <Card className="hud-panel p-4">
            <h2 className="mb-3 text-sm font-display text-primary">VIDEO SOURCE</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {demoVideoRecording.source}
            </p>
          </Card>
        </div>

        <section aria-labelledby="saved-recordings-title" className="xl:col-span-8">
          <Card className="hud-panel p-4 sm:p-5">
            <h2
              id="saved-recordings-title"
              className="mb-4 text-sm font-display text-primary"
            >
              DEMO VIDEO PLAYER
            </h2>

              <div className="space-y-4">
                <figure className="overflow-hidden rounded border border-primary/30 bg-black">
                  <video
                    ref={videoRef}
                    className="aspect-video w-full bg-black"
                    src={demoVideoRecording.url}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={`${demoVideoRecording.title}, six-second silent demo video`}
                    data-testid="demo-video-player"
                  >
                    Your browser does not support the bundled WebM sample video.
                  </video>
                  <figcaption className="sr-only">
                    Silent simulated rover footage included to test video playback.
                  </figcaption>
                </figure>

                <article
                  className="flex flex-col gap-4 rounded border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                  data-testid={`card-recording-${demoVideoRecording.id}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      aria-hidden="true"
                      className="flex h-16 w-20 shrink-0 items-center justify-center rounded bg-muted sm:h-20 sm:w-32"
                    >
                      <Film className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="break-words font-mono text-sm font-bold text-foreground">
                        {demoVideoRecording.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {demoVideoRecording.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock aria-hidden="true" className="h-3 w-3" />
                          0:06
                        </span>
                        <span>WebM · silent</span>
                        <span>Included with app</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={playSample}
                      aria-label={`Play ${demoVideoRecording.title}`}
                      data-testid={`button-play-${demoVideoRecording.id}`}
                    >
                      <Play aria-hidden="true" className="mr-2 h-4 w-4" />
                      Play
                    </Button>
                    <a
                      href={demoVideoRecording.url}
                      download={demoVideoRecording.fileName}
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Download ${demoVideoRecording.fileName}`}
                      data-testid={`button-download-${demoVideoRecording.id}`}
                    >
                      <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </div>
                </article>
              </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
