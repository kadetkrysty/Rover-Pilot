import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  clearRoverCredentials,
  getRoverCredentials,
  getRoverUrl,
  roverSecureFetch,
  saveRoverCredentials,
  type RoverCredentials,
} from "@/lib/roverConnection";

interface PairedClient {
  id: string;
  name: string;
  role: "owner" | "operator" | "viewer" | "rover";
  createdAt: string;
  revokedAt: string | null;
}

interface ClientCredentialsResponse {
  clientId: string;
  name: string;
  role: string;
  token: string;
}

interface CurrentClient {
  id: string;
  name: string;
  role: PairedClient["role"];
}

const deviceLabel = () => {
  const platform = /Android/i.test(navigator.userAgent) ? "Android" : "RoverOS client";
  return `${platform} device`;
};

export default function SecuritySettings() {
  const [fingerprint, setFingerprint] = useState(
    () => getRoverCredentials()?.fingerprint || "",
  );
  const [clientName, setClientName] = useState(deviceLabel);
  const [ownerCode, setOwnerCode] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"operator" | "viewer" | "rover">("operator");
  const [issuedInvitation, setIssuedInvitation] = useState("");
  const [clients, setClients] = useState<PairedClient[]>([]);
  const [currentClient, setCurrentClient] = useState<CurrentClient | null>(null);
  const [checkingPairing, setCheckingPairing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const hasCredentials = !!getRoverCredentials();

  const request = useCallback(async (
    path: string,
    method = "GET",
    body?: Record<string, unknown>,
    tokenOverride?: string,
  ) => {
    const response = await roverSecureFetch(
      path,
      {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
      getRoverUrl(),
      {
        fingerprint,
        ...(tokenOverride ? { token: tokenOverride } : {}),
      },
    );
    const parsed = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(parsed?.error || `MiniPC returned HTTP ${response.status}.`);
    }
    return parsed;
  }, [fingerprint]);

  const refreshClients = useCallback(async () => {
    if (!hasCredentials || currentClient?.role !== "owner") return;
    try {
      const result = await request("/api/clients");
      setClients(Array.isArray(result) ? result : []);
    } catch (error) {
      setClients([]);
      setMessage(error instanceof Error ? error.message : "Could not load paired clients.");
    }
  }, [currentClient?.role, hasCredentials, request]);

  useEffect(() => {
    if (!hasCredentials) {
      setCurrentClient(null);
      setClients([]);
      return;
    }
    let cancelled = false;
    setCheckingPairing(true);
    void request("/api/clients/me")
      .then((result) => {
        if (!cancelled) setCurrentClient(result as CurrentClient);
      })
      .catch((error) => {
        if (!cancelled) {
          setCurrentClient(null);
          setClients([]);
          setMessage(error instanceof Error ? error.message : "Could not verify this device's pairing.");
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingPairing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasCredentials, request]);

  useEffect(() => {
    if (currentClient?.role === "owner") void refreshClients();
  }, [currentClient?.role, refreshClients]);

  const withBusy = async (operation: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The secure request failed.");
    } finally {
      setBusy(false);
    }
  };

  const handlePairOwner = (event: FormEvent) => {
    event.preventDefault();
    void withBusy(async () => {
      const result = await request("/api/clients/pair-owner", "POST", {
        name: clientName,
        code: ownerCode,
      }) as ClientCredentialsResponse;
      await saveRoverCredentials({ fingerprint, token: result.token });
      setOwnerCode("");
      window.location.reload();
    });
  };

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    void withBusy(async () => {
      const result = await request("/api/clients/claim", "POST", {
        invitationCode,
      }) as ClientCredentialsResponse;
      await saveRoverCredentials({ fingerprint, token: result.token });
      setInvitationCode("");
      setMessage("This device is now paired.");
      window.location.reload();
    });
  };

  const handleCreateInvitation = (event: FormEvent) => {
    event.preventDefault();
    void withBusy(async () => {
      const result = await request("/api/clients/invitations", "POST", {
        name: inviteName,
        role: inviteRole,
      });
      setIssuedInvitation(result.code);
      setInviteName("");
      await refreshClients();
    });
  };

  const handleRevoke = (client: PairedClient) => {
    void withBusy(async () => {
      await request(`/api/clients/${encodeURIComponent(client.id)}`, "DELETE");
      setMessage(`${client.name} was revoked.`);
      await refreshClients();
    });
  };

  const disconnectThisDevice = () => {
    clearRoverCredentials();
    setMessage("This device's saved pairing was removed.");
    window.location.reload();
  };

  const isOwner = currentClient?.role === "owner";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6" data-testid="page-security-settings">
      <header>
        <h1 className="text-2xl font-display font-bold text-primary">PAIRED CLIENTS</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Rover controls and settings use certificate-pinned HTTPS and a separate normal-operation pairing credential.
          The first-run Wi-Fi setup code cannot pair a client.
        </p>
      </header>

      <Card className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Connect this device</h2>
        <label className="block space-y-2 text-sm">
          <span>MiniPC HTTPS certificate SHA-256 fingerprint</span>
          <Input
            value={fingerprint}
            onChange={(event) => setFingerprint(event.target.value.replace(/:/g, "").trim())}
            autoComplete="off"
            spellCheck={false}
            placeholder="64 hexadecimal characters"
            data-testid="input-server-fingerprint"
          />
        </label>
        {!hasCredentials && (
          <form className="space-y-3 border-t border-border pt-4" onSubmit={handlePairOwner}>
            <h3 className="font-medium">Pair the first owner device</h3>
            <p className="text-sm text-muted-foreground">
              Enter the owner enrollment code printed by the MiniPC setup installer. This code is separate from the one-time Wi-Fi setup code.
            </p>
            <label className="block space-y-2 text-sm">
              <span>Name for this owner device</span>
              <Input value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={64} />
            </label>
            <Input
              value={ownerCode}
              onChange={(event) => setOwnerCode(event.target.value.trim())}
              autoComplete="off"
              spellCheck={false}
              placeholder="Owner enrollment code"
              data-testid="input-owner-enrollment-code"
            />
            <Button type="submit" disabled={busy}>Pair as owner</Button>
          </form>
        )}

        {!hasCredentials && (
          <form className="space-y-3 border-t border-border pt-4" onSubmit={handleJoin}>
            <h3 className="font-medium">Join with an owner invitation</h3>
            <Input
              value={invitationCode}
              onChange={(event) => setInvitationCode(event.target.value.trim())}
              autoComplete="off"
              spellCheck={false}
              placeholder="One-time invitation code"
              data-testid="input-client-invitation-code"
            />
            <Button type="submit" variant="outline" disabled={busy}>Pair this device</Button>
          </form>
        )}

        {currentClient && (
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            This device is paired as {currentClient.role}: {currentClient.name}.
          </p>
        )}
        {hasCredentials && !currentClient && !checkingPairing && (
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            This device's saved pairing could not be verified. Remove it here, then pair again.
          </p>
        )}
        {hasCredentials && currentClient?.role !== "owner" && (
          <Button type="button" variant="destructive" onClick={disconnectThisDevice}>
            Forget pairing on this device
          </Button>
        )}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </Card>

      {hasCredentials && (
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Owner controls</h2>
          {!isOwner ? (
            <p className="text-sm text-muted-foreground">Only the paired owner can create invitations or revoke clients.</p>
          ) : (
            <>
              <form className="grid gap-3 sm:grid-cols-[1fr_9rem_auto]" onSubmit={handleCreateInvitation}>
                <Input
                  value={inviteName}
                  onChange={(event) => setInviteName(event.target.value)}
                  placeholder="New device name"
                  maxLength={64}
                />
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)}
                  aria-label="New client role"
                >
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                  <option value="rover">Rover controller</option>
                </select>
                <Button type="submit" disabled={busy}>Create invite</Button>
              </form>
              {issuedInvitation && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm">Share this one-time code with the new device. It expires in 10 minutes.</p>
                  <code className="mt-2 block break-all select-all">{issuedInvitation}</code>
                </div>
              )}
              <div className="divide-y divide-border">
                {clients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.role} · {client.revokedAt ? "revoked" : "paired"}
                      </p>
                    </div>
                    {client.role !== "owner" && !client.revokedAt && (
                      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => handleRevoke(client)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </main>
  );
}
