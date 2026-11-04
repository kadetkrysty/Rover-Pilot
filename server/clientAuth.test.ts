import assert from "node:assert/strict";
import test from "node:test";
import {
  createClientToken,
  emptyClientAuthState,
  findClientByToken,
  hashClientToken,
  parseClientAuthState,
} from "./clientAuth";

test("client tokens are random, stored as hashes, and resolve to their assigned role", () => {
  const token = createClientToken();
  assert.match(token, /^[a-f0-9]{64}$/);

  const state = emptyClientAuthState();
  state.clients.push({
    id: "device-1",
    name: "Dashboard",
    role: "operator",
    tokenHash: hashClientToken(token),
    createdAt: new Date(0).toISOString(),
  });

  assert.equal(findClientByToken(state, token)?.role, "operator");
  assert.equal(findClientByToken(state, token)?.id, "device-1");
  assert.equal(findClientByToken(state, "b".repeat(64)), null);
  assert.equal(findClientByToken(state, "not-a-token"), null);
});

test("revoked clients and malformed persisted authorization state fail closed", () => {
  const token = createClientToken();
  const state = emptyClientAuthState();
  state.clients.push({
    id: "revoked",
    name: "Old phone",
    role: "owner",
    tokenHash: hashClientToken(token),
    createdAt: new Date(0).toISOString(),
    revokedAt: new Date(1).toISOString(),
  });

  assert.equal(findClientByToken(state, token), null);
  assert.throws(() => parseClientAuthState("{broken"));
  assert.throws(() => parseClientAuthState(JSON.stringify({ version: 2, clients: [], invitations: [] })));
});
