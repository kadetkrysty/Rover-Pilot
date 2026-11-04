import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestSecureProvisioning } from "@/lib/provisioningClient";

interface ProvisioningStatus {
  state: string;
  stage: string;
  progress: number;
  message: string;
}

interface Props {
  serverUrl: string;
  status: ProvisioningStatus;
  onReady: () => void;
}

interface Network {
  ssid: string;
  security: string;
  signal: number;
}

export default function ProvisioningWizard({ serverUrl, status, onReady }: Props) {
  const [fingerprint, setFingerprint] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [hidden, setHidden] = useState(false);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentStatus, setCurrentStatus] = useState(status);

  useEffect(() => setCurrentStatus(status), [status]);

  const loadNetworks = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await requestSecureProvisioning(
        serverUrl, fingerprint, pairingCode, "/api/provisioning/networks", "GET",
      );
      setNetworks(result.networks || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not scan for Wi-Fi networks.");
    } finally {
      setBusy(false);
    }
  }, [fingerprint, pairingCode, serverUrl]);

  useEffect(() => {
    if (!["wifi_connecting", "installing"].includes(currentStatus.state)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${serverUrl}/api/provisioning/status`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const next = await response.json() as ProvisioningStatus;
        setCurrentStatus(next);
        if (next.state === "ready") onReady();
      } catch {
        // Temporary network changes during Wi-Fi setup are expected.
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [currentStatus.state, onReady, serverUrl]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestSecureProvisioning(
        serverUrl,
        fingerprint,
        pairingCode,
        currentStatus.state === "failed" ? "/api/provisioning/retry" : "/api/provisioning/wifi",
        "POST",
        { ssid, password, hidden },
      );
      setPassword("");
      setCurrentStatus({
        state: "wifi_connecting",
        stage: "wifi",
        progress: 10,
        message: "Connecting to Wi-Fi. Keep this screen open.",
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send Wi-Fi settings.");
    } finally {
      setBusy(false);
    }
  };

  const busySetup = ["wifi_connecting", "installing"].includes(currentStatus.state);

  return (
    <Card className="w-full max-w-lg border-primary/50 bg-black/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Wifi aria-hidden="true" /> Set up RoverOS-Server
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Enter the certificate fingerprint and one-time pairing code shown by the MiniPC
          installer. Wi-Fi credentials are sent only over the fingerprint-verified encrypted
          setup connection and are not saved on this phone.
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

        {!busySetup && (
          <>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="min-h-11 flex-1"
                disabled={busy || !fingerprint || !pairingCode} onClick={loadNetworks}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> :
                  <RefreshCw className="mr-2 h-4 w-4" />}
                Scan Wi-Fi
              </Button>
            </div>
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
                disabled={busy || !fingerprint || !pairingCode}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect and install RoverOS
              </Button>
            </form>
          </>
        )}

        {busySetup && (
          <div role="status" aria-live="polite" className="space-y-2 rounded-md border p-4">
            <p className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {currentStatus.message}
            </p>
            <progress className="w-full" max={100} value={currentStatus.progress}>
              {currentStatus.progress}%
            </progress>
            <p className="text-xs text-muted-foreground">
              The MiniPC will restart its RoverOS service when setup finishes. This can take several minutes.
            </p>
          </div>
        )}

        {currentStatus.state === "ready" && (
          <p role="status" className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-4 w-4" aria-hidden="true" /> RoverOS is ready.
          </p>
        )}
        {currentStatus.state === "failed" && (
          <p role="alert" className="flex items-start gap-2 text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{currentStatus.message}</span>
          </p>
        )}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </CardContent>
    </Card>
  );
}
