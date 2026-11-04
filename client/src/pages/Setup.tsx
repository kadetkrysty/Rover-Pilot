import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle, Cpu, Search, Wifi, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getRoverUrl,
  setRoverUrl,
  testRoverConnection,
} from "@/lib/roverConnection";
import { getDiscoveredRoverUrl } from "@/lib/discoveredServer";
import { startRoverServerDiscovery } from "@/lib/roverDiscovery";

type ConnectionState = "searching" | "checking" | "success" | "error";

interface SetupProps {
  requiredConnection?: boolean;
  onConnected?: () => void;
}

const DISCOVERY_TIMEOUT_MS = 18000;

export default function Setup({
  requiredConnection = false,
  onConnected,
}: SetupProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("searching");
  const [statusMessage, setStatusMessage] = useState(
    "Searching for RoverOS-Server on the local network…",
  );

  useEffect(() => {
    let active = true;
    let connected = false;
    let searchExpired = false;
    let processing = false;
    let stopDiscovery = () => {};
    const queuedUrls: string[] = [];
    const attemptedUrls = new Set<string>();

    const discoveryTimer = window.setTimeout(() => {
      if (!active || connected) return;
      searchExpired = true;
      setConnectionState("error");
      setStatusMessage(
        "RoverOS-Server was not found. Join its Wi-Fi or the same local network, then search again.",
      );
      stopDiscovery();
    }, DISCOVERY_TIMEOUT_MS);

    const processQueue = async () => {
      if (processing || connected || !active) return;
      processing = true;

      while (queuedUrls.length > 0 && active && !connected) {
        const serverUrl = queuedUrls.shift();
        if (!serverUrl) continue;

        setConnectionState("checking");
        setStatusMessage("RoverOS-Server found. Checking the connection…");

        try {
          await testRoverConnection(serverUrl);
          if (!active || searchExpired) return;

          setRoverUrl(serverUrl);
          connected = true;
          window.clearTimeout(discoveryTimer);
          stopDiscovery();
          setConnectionState("success");
          setStatusMessage("Connected to RoverOS-Server.");

          if (requiredConnection && onConnected) {
            onConnected();
          } else if (!requiredConnection) {
            window.location.assign("/");
          }
          return;
        } catch {
          if (!active || searchExpired) return;
          setConnectionState("searching");
          setStatusMessage(
            "A device responded but did not pass the RoverOS check. Continuing to search…",
          );
        }
      }

      processing = false;
    };

    const enqueueServer = (serverUrl: string) => {
      if (!active || searchExpired || attemptedUrls.has(serverUrl)) return;
      attemptedUrls.add(serverUrl);
      queuedUrls.push(serverUrl);
      void processQueue();
    };

    const start = async () => {
      if (!Capacitor.isNativePlatform()) {
        setConnectionState("error");
        setStatusMessage(
          "Automatic discovery is available in the RoverOS Android app. Open the native app or return to the MiniPC-hosted web app.",
        );
        window.clearTimeout(discoveryTimer);
        return;
      }

      const savedUrl = getRoverUrl();
      if (savedUrl) enqueueServer(savedUrl);

      try {
        const stop = await startRoverServerDiscovery(
          (candidate) => {
            const serverUrl = getDiscoveredRoverUrl(candidate);
            if (serverUrl) enqueueServer(serverUrl);
          },
          (message) => {
            if (active && !connected) {
              setConnectionState("error");
              setStatusMessage(message);
            }
          },
        );

        if (!active || connected || searchExpired) {
          stop();
        } else {
          stopDiscovery = stop;
        }
      } catch {
        if (active && !connected) {
          setConnectionState("error");
          setStatusMessage(
            "Android could not start network discovery. Check local-network access and try again.",
          );
          window.clearTimeout(discoveryTimer);
        }
      }
    };

    void start();

    return () => {
      active = false;
      window.clearTimeout(discoveryTimer);
      stopDiscovery();
    };
  }, [retryCount, requiredConnection, onConnected]);

  const searching =
    connectionState === "searching" || connectionState === "checking";

  return (
    <main
      className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden"
      data-testid="page-setup"
    >
      <div className="scanline" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"
        aria-hidden="true"
      />

      <Card
        className="w-full max-w-md border-primary/50 bg-black/80 backdrop-blur-xl shadow-[0_0_50px_rgba(var(--primary),0.2)]"
        data-testid="card-setup"
      >
        <CardHeader>
          <div className="flex justify-center mb-6" aria-hidden="true">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary">
              <Wifi className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-display tracking-widest text-primary">
            CONNECT TO MINIPC
          </CardTitle>
          <p className="text-center text-muted-foreground font-mono text-sm leading-relaxed">
            RoverOS searches for <strong>RoverOS-Server</strong> automatically.
            Join its Wi-Fi or connect both devices to the same local network.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            id="rover-connection-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="min-h-12 text-sm"
          >
            {connectionState === "success" && (
              <p className="flex items-center gap-2 text-green-400">
                <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {statusMessage}
              </p>
            )}
            {connectionState === "error" && (
              <p className="flex items-start gap-2 text-red-300">
                <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{statusMessage}</span>
              </p>
            )}
            {searching && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                {statusMessage}
              </p>
            )}
          </div>

          <Button
            variant="outline"
            className="w-full min-h-12 font-mono text-sm border-primary/50"
            onClick={() => {
              setConnectionState("searching");
              setStatusMessage("Searching for RoverOS-Server…");
              setRetryCount((count) => count + 1);
            }}
            disabled={searching}
            data-testid="button-search-minipc"
          >
            {searching ? "SEARCHING…" : "SEARCH AGAIN"}
          </Button>

          <div className="p-4 rounded bg-primary/5 border border-primary/20 mt-6">
            <div className="flex items-center gap-2 text-primary text-sm font-bold mb-2">
              <Cpu className="w-4 h-4" aria-hidden="true" /> CLIENT / SERVER
            </div>
            <ul className="text-sm leading-relaxed text-muted-foreground space-y-1">
              <li>• MiniPC: RoverOS web/API and database</li>
              <li>• Android and Windows: clients on the local Wi-Fi</li>
              <li>• No IP address or database password is needed here</li>
            </ul>
          </div>
        </CardContent>

        {!requiredConnection && (
          <CardFooter>
            <Button
              asChild
              variant="ghost"
              className="w-full min-h-11 font-mono text-sm"
            >
              <Link href="/" data-testid="button-back-to-dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                BACK TO DASHBOARD
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
