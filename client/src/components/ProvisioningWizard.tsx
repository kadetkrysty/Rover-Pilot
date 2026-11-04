import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestSecureProvisioning } from "@/lib/provisioningClient";
import { getDiscoveredRoverUrl } from "@/lib/discoveredServer";
import { startRoverServerDiscovery } from "@/lib/roverDiscovery";
import { testRoverConnection } from "@/lib/roverConnection";

interface ProvisioningStatus {
  state: string;
  stage: string;
  progress: number;
  message: string;
}

interface Props {
  serverUrl: string;
  status: ProvisioningStatus;
  onReady: (serverUrl: string) => Promise<boolean>;
  onServerUrlChange?: (serverUrl: string) => void;
  onReconnect?: () => void;
}

interface Network {
  ssid: string;
  security: string;
  signal: number;
}

function isProvisioningStatus(value: unknown): value is ProvisioningStatus {
  if (!value || typeof value !== "object") return false;
  const status = value as Partial<ProvisioningStatus>;
  return (value as { service?: unknown }).service === "RoverOS" &&
    ["setup_required", "wifi_connecting", "installing", "failed", "ready"].includes(status.state || "") &&
    typeof status.stage === "string" &&
    typeof status.progress === "number" &&
    Number.isFinite(status.progress) &&
    status.progress >= 0 && status.progress <= 100 &&
    typeof status.message === "string" && status.message.length <= 160;
}

export default function ProvisioningWizard({
  serverUrl,
  status,
  onReady,
  onServerUrlChange,
  onReconnect,
}: Props) {
  const [fingerprint, setFingerprint] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [hidden, setHidden] = useState(false);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reconnectNote, setReconnectNote] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);
  const readyAttemptRef = useRef(false);

  useEffect(() => {
    setCurrentStatus(status);
    readyAttemptRef.current = false;
  }, [status]);

  const loadNetworks = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await requestSecureProvisioning(
        serverUrl, fingerprint, pairingCode, "/api/provisioning/networks", "GET",
      );
      setNetworks(result.networks || []);
      if (result.networks?.length === 0) setError("No Wi-Fi networks were found. Enter the network name manually.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not scan for Wi-Fi networks.");
    } finally {
      setBusy(false);
    }
  }, [fingerprint, pairingCode, serverUrl]);

  // Keep discovery alive through the access-point handoff. On Android the
  // server's local IP can change when it joins the selected Wi-Fi network.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let stopDiscovery = () => {};
    void startRoverServerDiscovery(async (candidate) => {
      const discoveredUrl = getDiscoveredRoverUrl(candidate);
      if (!active || !discoveredUrl) return;
      try {
        const response = await fetch(`${discoveredUrl}/api/provisioning/status`, {
          cache: "no-store",
          signal: AbortSignal.timeout(3500),
        });
        if (!response.ok) return;
        const next: unknown = await response.json();
        if (!active || !isProvisioningStatus(next)) return;
        readyAttemptRef.current = false;
        onServerUrlChange?.(discoveredUrl);
        setCurrentStatus(next);
        setReconnectNote("");
      } catch {
        // Discovery may find other devices; only a valid RoverOS status is used.
      }
    }, () => undefined).then((stop) => {
      if (active) stopDiscovery = stop;
      else stop();
    }).catch(() => undefined);
    return () => {
      active = false;
      stopDiscovery();
    };
  }, [onServerUrlChange]);

  // One bounded request at a time; a temporary network loss is expected during
  // handoff and is retried without creating overlapping polls.
  useEffect(() => {
    let active = true;
    let timer = 0;
    let requestController: AbortController | null = null;
    let checking = false;

    const poll = async () => {
      if (!active || checking) return;
      checking = true;
      requestController = new AbortController();
      const timeout = window.setTimeout(() => requestController?.abort(), 4500);
      try {
        const response = await fetch(`${serverUrl}/api/provisioning/status`, {
          cache: "no-store",
          signal: requestController.signal,
        });
        if (!response.ok) throw new Error("Setup status is temporarily unavailable.");
        const next: unknown = await response.json();
        if (!isProvisioningStatus(next)) throw new Error("MiniPC returned an invalid setup status.");
        if (!active) return;
        setCurrentStatus(next);
        if (next.state === "ready" && !readyAttemptRef.current) {
          readyAttemptRef.current = true;
          try {
            await testRoverConnection(serverUrl);
            if (active) {
              const connected = await onReady(serverUrl);
              if (!connected && active) {
                readyAttemptRef.current = false;
                setReconnectNote("RoverOS is installed, but the normal service is not reachable yet. Reconnect to the MiniPC Wi-Fi, then search again.");
              }
            }
          } catch {
            if (active) {
              readyAttemptRef.current = false;
              setReconnectNote("RoverOS is installed. Waiting for the normal service to return; the setup connection may have changed.");
            }
          }
        }
      } catch {
        // Continue until the setup endpoint is reachable again or the user leaves.
      } finally {
        window.clearTimeout(timeout);
        checking = false;
        if (active) timer = window.setTimeout(poll, 2500);
      }
    };

    if (["wifi_connecting", "installing", "ready"].includes(currentStatus.state)) {
      timer = window.setTimeout(poll, 1200);
    }
    return () => {
      active = false;
      window.clearTimeout(timer);
      requestController?.abort();
    };
  }, [currentStatus.state, onReady, serverUrl]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || busySetup) return;
    setBusy(true);
    setError("");
    setReconnectNote("");
    try {
      await requestSecureProvisioning(
        serverUrl,
        fingerprint,
        pairingCode,
        currentStatus.state === "failed" ? "/api/provisioning/retry" : "/api/provisioning/wifi",
        "POST",
        { ssid, password, hidden },
      );
      setCurrentStatus({
        state: "wifi_connecting",
        stage: "wifi",
        progress: 10,
        message: "Connecting to Wi-Fi. Keep this screen open.",
      });
      readyAttemptRef.current = false;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send Wi-Fi settings.");
    } finally {
      // The Wi-Fi password is never retained after a request attempt, successful or not.
      setPassword("");
      setBusy(false);
    }
  };

  const busySetup = ["wifi_connecting", "installing"].includes(currentStatus.state);
  const credentialsValid = /^[\da-f]{64}$/i.test(fingerprint.replace(/:/g, "").trim()) &&
    /^[\da-f]{32}$/i.test(pairingCode.trim());

  return (
    <Card className="w-full max-w-lg border-primary/50 bg-black/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Wifi aria-hidden="true" /> Set up RoverOS-Server
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use the certificate fingerprint and one-time pairing code printed by the MiniPC
          bootstrap installer. Wi-Fi settings travel through the fingerprint-verified setup
          connection; the password is cleared as soon as a request is attempted.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span>HTTPS certificate SHA-256 fingerprint</span>
          <Input autoComplete="off" spellCheck={false} value={fingerprint}
            onChange={(event) => setFingerprint(event.target.value)}
            placeholder="64 hexadecimal characters" aria-label="Certificate fingerprint" />
        </label>
        <label className="block space-y-1 text-sm">
          <span>One-time pairing code</span>
          <Input autoComplete="off" spellCheck={false} value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value)}
            placeholder="32 hexadecimal characters" aria-label="One-time pairing code" />
        </label>

        {!busySetup && currentStatus.state !== "ready" && (
          <>
            <Button type="button" variant="outline" className="min-h-11 w-full"
              disabled={busy || !credentialsValid} onClick={loadNetworks}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                <RefreshCw className="mr-2 h-4 w-4" />}
              Scan Wi-Fi
            </Button>
            {networks.length > 0 && (
              <label className="block space-y-1 text-sm">
                <span>Nearby network</span>
                <select className="h-11 w-full rounded-md border border-input bg-background px-3"
                  value={ssid} onChange={(event) => setSsid(event.target.value)}>
                  <option value="">Choose a network</option>
                  {networks.map((network) => (
                    <option key={network.ssid} value={network.ssid}>
                      {network.ssid} · {network.security}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <form className="space-y-4" onSubmit={submit}>
              <label className="block space-y-1 text-sm">
                <span>Wi-Fi network name (SSID)</span>
                <Input required maxLength={32} autoComplete="off" value={ssid}
                  onChange={(event) => setSsid(event.target.value)} />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Wi-Fi password</span>
                <Input required type="password" minLength={8} maxLength={64}
                  autoComplete="new-password" value={password}
                  onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
                This is a hidden network
              </label>
              <Button type="submit" className="min-h-11 w-full"
                disabled={busy || !credentialsValid || !ssid.trim() || !password}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {currentStatus.state === "failed" ? "Retry Wi-Fi setup" : "Connect and install RoverOS"}
              </Button>
            </form>
          </>
        )}

        {busySetup && (
          <div role="status" aria-live="polite" className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
            <p className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {currentStatus.message || "Setting up RoverOS…"}
            </p>
            <progress className="w-full accent-primary" max={100}
              value={Math.min(100, Math.max(0, currentStatus.progress))}>
              {currentStatus.progress}%
            </progress>
            <p className="text-xs text-muted-foreground">
              Keep this screen open. The MiniPC may restart its network and RoverOS service; setup will reconnect automatically when possible.
            </p>
          </div>
        )}

        {currentStatus.state === "ready" && (
          <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-green-400">
              <CheckCircle className="h-4 w-4" aria-hidden="true" /> RoverOS installation is complete.
            </p>
            <p className="text-sm text-muted-foreground">
              Checking the normal RoverOS service. On Android, join the Wi-Fi network you selected if the setup access point has closed.
            </p>
          </div>
        )}
        {currentStatus.state === "failed" && (
          <p role="alert" className="flex items-start gap-2 text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{currentStatus.message || "Setup could not finish. Check the Wi-Fi details and try again."}</span>
          </p>
        )}
        {(error || reconnectNote) && (
          <p role="alert" className="text-sm text-red-300">{error || reconnectNote}</p>
        )}
        {(reconnectNote || currentStatus.state === "ready" || busySetup) && onReconnect && (
          <Button type="button" variant="outline" className="min-h-11 w-full"
            onClick={onReconnect}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Search again / reconnect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
