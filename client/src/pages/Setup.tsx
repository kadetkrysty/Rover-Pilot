import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, ArrowLeft, Cpu, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import {
  getRoverUrl,
  normalizeRoverUrl,
  setRoverUrl,
  testRoverConnection,
} from "@/lib/roverConnection";

interface SetupProps {
  requiredConnection?: boolean;
  onConnected?: () => void;
}

export default function Setup({
  requiredConnection = false,
  onConnected,
}: SetupProps) {
  const [connecting, setConnecting] = useState(false);
  const [serverAddress, setServerAddress] = useState(() => getRoverUrl());
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const checkConnection = async () => {
    setTestStatus("testing");
    setStatusMessage("");
    try {
      const normalized = normalizeRoverUrl(serverAddress);
      await testRoverConnection(normalized);
      setTestStatus("success");
      setStatusMessage("RoverOS responded. You can connect now.");
      return normalized;
    } catch (error) {
      setTestStatus("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not reach RoverOS. Check the address and local network.",
      );
      return null;
    }
  };

  const handleTestConnection = async () => {
    await checkConnection();
  };

  const handleConnect = async () => {
    setConnecting(true);
    const normalized = await checkConnection();
    if (normalized) {
      try {
        setRoverUrl(normalized);
        if (onConnected) {
          onConnected();
        } else {
          window.location.assign("/");
          return;
        }
      } catch (error) {
        setTestStatus("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Could not save the MiniPC address.",
        );
      }
    }
    setConnecting(false);
  };

  return (
    <main
      className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden"
      data-testid="page-setup"
    >
      <div className="scanline" aria-hidden="true" />
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" aria-hidden="true" />

      <Card className="w-full max-w-md border-primary/50 bg-black/80 backdrop-blur-xl shadow-[0_0_50px_rgba(var(--primary),0.2)]" data-testid="card-setup">
        <CardHeader>
          <div className="flex justify-center mb-6" aria-hidden="true">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary">
              <Wifi className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-display tracking-widest text-primary">
            CONNECT TO MINIPC
          </CardTitle>
          <p className="text-center text-muted-foreground font-mono text-sm">
            Enter the address of the MiniPC running RoverOS. Keep both devices on the same trusted network.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rover-server-address" className="text-xs font-mono uppercase text-primary/70">
              MiniPC server address
            </Label>
            <Input
              id="rover-server-address"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="http://192.168.1.40:5000"
              value={serverAddress}
              onChange={(event) => {
                setServerAddress(event.target.value);
                setTestStatus("idle");
                setStatusMessage("");
              }}
              aria-describedby="rover-address-help rover-connection-status"
              required
              className="font-mono bg-background/50 border-primary/30 focus:border-primary text-base"
              data-testid="input-rover-server-address"
            />
            <p id="rover-address-help" className="text-xs text-muted-foreground">
              Include http:// or https:// and the port. The default port is 5000.
            </p>
          </div>

          <div id="rover-connection-status" role="status" aria-live="polite" className="min-h-10 text-sm">
            {testStatus === "success" && (
              <p className="flex items-center gap-2 text-green-400">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                {statusMessage}
              </p>
            )}
            {testStatus === "error" && (
              <p className="flex items-center gap-2 text-red-400">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                {statusMessage}
              </p>
            )}
            {testStatus === "testing" && <p className="text-muted-foreground">Checking the MiniPC…</p>}
          </div>

          <Button
            variant="outline"
            className="w-full font-mono text-xs border-primary/50"
            onClick={handleTestConnection}
            disabled={testStatus === "testing" || connecting}
            data-testid="button-test-connection"
          >
            {testStatus === "testing" ? "TESTING…" : "TEST CONNECTION"}
          </Button>

          <div className="p-4 rounded bg-primary/5 border border-primary/20 mt-6">
            <div className="flex items-center gap-2 text-primary text-sm font-bold mb-2">
              <Cpu className="w-4 h-4" aria-hidden="true" /> CLIENT / SERVER
            </div>
            <ul className="text-xs font-mono text-muted-foreground space-y-1">
              <li>• MiniPC: RoverOS web/API and database</li>
              <li>• Android: this app connects over Wi-Fi</li>
              <li>• Database credentials stay on the MiniPC</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-display tracking-widest h-12"
            onClick={handleConnect}
            disabled={connecting || testStatus === "testing"}
            data-testid="button-connect"
          >
            {connecting ? "CONNECTING…" : "SAVE AND CONNECT"}
          </Button>
          {!requiredConnection && (
            <Link href="/">
              <Button variant="ghost" className="w-full font-mono text-xs" data-testid="button-skip-setup">
                <ArrowLeft className="w-3 h-3 mr-2" aria-hidden="true" />
                BACK TO DASHBOARD
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
