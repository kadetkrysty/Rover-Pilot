import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type RoverClientRole = "owner" | "operator" | "viewer" | "rover";

export interface RoverClient {
  id: string;
  name: string;
  role: RoverClientRole;
  tokenHash: string;
  createdAt: string;
  revokedAt?: string;
}

export interface ClientInvitation {
  id: string;
  name: string;
  role: Exclude<RoverClientRole, "owner">;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface ClientAuthState {
  version: 1;
  clients: RoverClient[];
  invitations: ClientInvitation[];
}

export interface AuthenticatedRoverClient {
  id: string;
  name: string;
  role: RoverClientRole;
}

export const CLIENT_AUTH_CONFIG_KEY = "roveros_client_auth_state";
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function emptyClientAuthState(): ClientAuthState {
  return { version: 1, clients: [], invitations: [] };
}

export function parseClientAuthState(value: string | undefined): ClientAuthState {
  if (!value) return emptyClientAuthState();
  const parsed: unknown = JSON.parse(value);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("clients" in parsed) ||
    !Array.isArray(parsed.clients) ||
    !("invitations" in parsed) ||
    !Array.isArray(parsed.invitations)
  ) {
    throw new Error("Stored client authorization data is invalid.");
  }
  return parsed as ClientAuthState;
}

export function createClientToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashClientToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!TOKEN_PATTERN.test(left) || !TOKEN_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function findClientByToken(
  state: ClientAuthState,
  token: string | undefined,
): AuthenticatedRoverClient | null {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const suppliedHash = hashClientToken(token);
  const found = state.clients.find(
    (client) =>
      !client.revokedAt &&
      constantTimeHexEqual(client.tokenHash, suppliedHash),
  );
  if (!found) return null;
  return { id: found.id, name: found.name, role: found.role };
}

export function isClientAuthRole(value: unknown): value is RoverClientRole {
  return value === "owner" || value === "operator" || value === "viewer" || value === "rover";
}
