import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { hashClientToken, type ClientAuthState } from "./clientAuth";

process.env.DATABASE_URL ||= "postgres://roveros:roveros@127.0.0.1:5432/roveros_test";
const { registerRoutes } = await import("./routes");
const { storage } = await import("./storage");

const OPERATOR_TOKEN = "a".repeat(64);
const REVOKED_TOKEN = "b".repeat(64);
const VIEWER_TOKEN = "c".repeat(64);
const ROVER_TOKEN = "e".repeat(64);
let authState: ClientAuthState;
let pretendTls = true;
let server: ReturnType<typeof createServer>;
let origin = "";
const originalGetConfig = storage.getConfig;
const originalGetAllConfig = storage.getAllConfig;
const originalSetConfig = storage.setConfig;
const ownerCode = "d".repeat(32);
const ownerCodeDir = fs.mkdtempSync(path.join(os.tmpdir(), "roveros-owner-code-"));
const ownerCodePath = path.join(ownerCodeDir, "owner-pairing-code");
let ownerAccessToken = "";

before(async () => {
  fs.writeFileSync(ownerCodePath, `${ownerCode}\n`, { mode: 0o600 });
  process.env.ROVEROS_OWNER_PAIRING_CODE_FILE = ownerCodePath;
  authState = {
    version: 1,
    invitations: [],
    clients: [
      {
        id: "operator",
        name: "Owner console",
        role: "operator",
        tokenHash: hashClientToken(OPERATOR_TOKEN),
        createdAt: new Date(0).toISOString(),
      },
      {
        id: "revoked",
        name: "Revoked phone",
        role: "operator",
        tokenHash: hashClientToken(REVOKED_TOKEN),
        createdAt: new Date(0).toISOString(),
        revokedAt: new Date(1).toISOString(),
      },
      {
        id: "viewer",
        name: "Viewer",
        role: "viewer",
        tokenHash: hashClientToken(VIEWER_TOKEN),
        createdAt: new Date(0).toISOString(),
      },
      {
        id: "rover",
        name: "Rover controller",
        role: "rover",
        tokenHash: hashClientToken(ROVER_TOKEN),
        createdAt: new Date(0).toISOString(),
      },
    ],
  };
  storage.getConfig = (async (key: string) => {
    if (key !== "roveros_client_auth_state") return undefined;
    return { key, value: JSON.stringify(authState) } as Awaited<ReturnType<typeof originalGetConfig>>;
  }) as typeof storage.getConfig;
  storage.getAllConfig = (async () => [
    { id: 1, key: "camera_stream_url", value: "rtsp://camera.local/private", updatedAt: new Date(0) },
    { id: 2, key: "operator_auth_token", value: "legacy-secret", updatedAt: new Date(0) },
    { id: 3, key: "roveros_client_auth_state", value: "internal", updatedAt: new Date(0) },
  ]) as typeof storage.getAllConfig;
  storage.setConfig = (async ({ key, value }) => {
    if (key === "roveros_client_auth_state") authState = JSON.parse(value) as ClientAuthState;
    return { id: 1, key, value, updatedAt: new Date() };
  }) as typeof storage.setConfig;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (pretendTls) Object.defineProperty(req.socket, "encrypted", { value: true, configurable: true });
    next();
  });
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start.");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  storage.getConfig = originalGetConfig;
  storage.getAllConfig = originalGetAllConfig;
  storage.setConfig = originalSetConfig;
  delete process.env.ROVEROS_OWNER_PAIRING_CODE_FILE;
  fs.rmSync(ownerCodeDir, { recursive: true, force: true });
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("unpaired clients cannot read configuration or issue control commands", async () => {
  pretendTls = false;
  const cleartextRead = await fetch(`${origin}/api/config`);
  assert.equal(cleartextRead.status, 426);

  pretendTls = true;
  const read = await fetch(`${origin}/api/config`);
  const control = await fetch(`${origin}/api/rover/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ direction: "forward" }),
  });
  assert.equal(read.status, 401);
  assert.equal(control.status, 401);
});

test("revoked clients cannot read settings or issue control commands", async () => {
  const headers = { authorization: `Bearer ${REVOKED_TOKEN}` };
  const read = await fetch(`${origin}/api/config`, { headers });
  const control = await fetch(`${origin}/api/rover/move`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ direction: "forward" }),
  });
  assert.equal(read.status, 401);
  assert.equal(control.status, 401);
});

test("paired viewers cannot read sensitive settings or issue commands", async () => {
  const headers = { authorization: `Bearer ${VIEWER_TOKEN}` };
  const read = await fetch(`${origin}/api/config`, { headers });
  const control = await fetch(`${origin}/api/rover/move`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ direction: "forward" }),
  });
  assert.equal(read.status, 403);
  assert.equal(control.status, 403);
  const identity = await fetch(`${origin}/api/clients/me`, { headers });
  assert.equal(identity.status, 200);
  assert.equal((await identity.json() as { role: string }).role, "viewer");
});

test("paired rover clients cannot read settings or issue operator commands", async () => {
  const headers = { authorization: `Bearer ${ROVER_TOKEN}` };
  const read = await fetch(`${origin}/api/config`, { headers });
  const command = await fetch(`${origin}/api/rover/move`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ direction: "forward" }),
  });
  assert.equal(read.status, 403);
  assert.equal(command.status, 403);
});

test("paired operators can read non-internal settings and control the rover", async () => {
  const headers = { authorization: `Bearer ${OPERATOR_TOKEN}` };
  const read = await fetch(`${origin}/api/config`, { headers });
  const configs = await read.json() as Array<{ key: string }>;
  const control = await fetch(`${origin}/api/rover/move`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ direction: "forward" }),
  });
  assert.equal(read.status, 200);
  assert.deepEqual(configs.map(({ key }) => key), ["camera_stream_url"]);
  assert.equal(control.status, 200);
});

test("owner enrollment, invitation, and revocation use separate one-time client credentials", async () => {
  const pairResponse = await fetch(`${origin}/api/clients/pair-owner`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: ownerCode, name: "Owner tablet" }),
  });
  assert.equal(pairResponse.status, 201);
  const owner = await pairResponse.json() as { clientId: string; token: string };
  ownerAccessToken = owner.token;
  assert.equal(fs.existsSync(ownerCodePath), false);
  assert.equal(authState.clients.find((client) => client.id === owner.clientId)?.tokenHash, hashClientToken(owner.token));

  const ownerHeaders = {
    authorization: `Bearer ${owner.token}`,
    "content-type": "application/json",
  };
  const invitationResponse = await fetch(`${origin}/api/clients/invitations`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ name: "Rover tablet", role: "operator" }),
  });
  assert.equal(invitationResponse.status, 201);
  const invitation = await invitationResponse.json() as { code: string };
  assert.equal(authState.invitations[0].tokenHash, hashClientToken(invitation.code));

  const claims = await Promise.all([0, 1].map(() => fetch(`${origin}/api/clients/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invitationCode: invitation.code, name: "Untrusted replacement name" }),
  })));
  assert.deepEqual(claims.map((response) => response.status).sort(), [201, 401]);
  const claimResponse = claims.find((response) => response.status === 201)!;
  assert.equal(claimResponse.status, 201);
  const paired = await claimResponse.json() as { clientId: string; name: string; token: string };
  assert.equal(paired.name, "Rover tablet");
  assert.equal(authState.invitations.length, 0);

  const revokeResponse = await fetch(`${origin}/api/clients/${paired.clientId}`, {
    method: "DELETE",
    headers: ownerHeaders,
  });
  assert.equal(revokeResponse.status, 204);
  const revokedRead = await fetch(`${origin}/api/config`, {
    headers: { authorization: `Bearer ${paired.token}` },
  });
  assert.equal(revokedRead.status, 401);
});

test("only the owner can inspect available updates and updater status", async () => {
  const viewerHeaders = { authorization: `Bearer ${VIEWER_TOKEN}` };
  assert.equal((await fetch(`${origin}/api/system/update`, { headers: viewerHeaders })).status, 403);
  assert.equal((await fetch(`${origin}/api/system/update/status`, { headers: viewerHeaders })).status, 403);
  assert.equal((await fetch(`${origin}/api/system/update`, { method: "POST", headers: viewerHeaders })).status, 403);

  const manifestPath = path.join(ownerCodeDir, "current-release.json");
  fs.writeFileSync(manifestPath, JSON.stringify({ version: "1.0.0" }));
  process.env.ROVEROS_CURRENT_RELEASE_MANIFEST = manifestPath;
  const updateStatusPath = path.join(ownerCodeDir, "update-status.json");
  const systemctlPath = path.join(ownerCodeDir, "systemctl");
  fs.writeFileSync(systemctlPath, '#!/bin/sh\nprintf "%s\\n" "$UPDATE_TEST_SYSTEMD_STATE"\n', { mode: 0o755 });
  process.env.ROVEROS_UPDATE_STATUS_FILE = updateStatusPath;
  process.env.ROVEROS_GITHUB_REPOSITORY = "example/rover";
  const updateSocketPath = path.join(ownerCodeDir, "update-trigger.sock");
  process.env.ROVEROS_UPDATE_SOCKET_PATH = updateSocketPath;
  process.env.ROVEROS_UPDATE_SYSTEMCTL_PATH = systemctlPath;
  process.env.UPDATE_TEST_SYSTEMD_STATE = "inactive";
  const triggerServer = net.createServer((socket) => {
    let request = "";
    socket.on("data", (chunk) => {
      request += chunk.toString("utf8");
      if (request.includes("\n")) socket.end(request === "START\n" ? "STARTED\n" : "REJECTED\n");
    });
  });
  await new Promise<void>((resolve, reject) => {
    triggerServer.once("error", reject);
    triggerServer.listen(updateSocketPath, resolve);
  });
  const savedFetch = globalThis.fetch;
  const requestApi = savedFetch;
  const assetNames = [
    "RoverOS-server-linux-x64.tar.gz",
    "RoverOS-server-linux-x64.tar.gz.sha256",
    "RoverOS-server-linux-x64.intoto.jsonl",
  ];
  globalThis.fetch = (async () => new Response(JSON.stringify([{
    tag_name: "roveros-server-v1.1.0",
    draft: false,
    prerelease: false,
    assets: assetNames.map((name) => ({
      name,
      browser_download_url: `https://github.com/example/rover/releases/download/roveros-server-v1.1.0/${name}`,
    })),
  }]), { status: 200 })) as typeof fetch;
  try {
    const ownerHeaders = { authorization: `Bearer ${ownerAccessToken}` };
    const updateResponse = await requestApi(`${origin}/api/system/update`, { headers: ownerHeaders });
    assert.equal(updateResponse.status, 200);
    assert.deepEqual(await updateResponse.json(), {
      currentVersion: "1.0.0",
      availableVersion: "1.1.0",
      updateAvailable: true,
      updateStatus: { state: "idle", progress: 0 },
    });
    const statusResponse = await requestApi(`${origin}/api/system/update/status`, { headers: ownerHeaders });
    assert.equal((await statusResponse.json() as { state: string }).state, "idle");

    fs.writeFileSync(updateStatusPath, JSON.stringify({ state: "running", progress: 2 }));
    process.env.UPDATE_TEST_SYSTEMD_STATE = "activating";
    const startingStatus = await requestApi(`${origin}/api/system/update/status`, { headers: ownerHeaders });
    assert.equal((await startingStatus.json() as { state: string }).state, "running");
    const duplicateStart = await requestApi(`${origin}/api/system/update`, {
      method: "POST",
      headers: ownerHeaders,
    });
    assert.equal(duplicateStart.status, 409);

    process.env.UPDATE_TEST_SYSTEMD_STATE = "inactive";
    const interruptedStatus = await requestApi(`${origin}/api/system/update/status`, { headers: ownerHeaders });
    assert.equal((await interruptedStatus.json() as { state: string }).state, "interrupted");
    fs.rmSync(updateStatusPath, { force: true });
    const startResponse = await requestApi(`${origin}/api/system/update`, {
      method: "POST",
      headers: ownerHeaders,
    });
    assert.equal(startResponse.status, 202);
    assert.deepEqual(await startResponse.json(), { state: "started" });
  } finally {
    globalThis.fetch = savedFetch;
    await new Promise<void>((resolve) => triggerServer.close(() => resolve()));
    fs.rmSync(updateSocketPath, { force: true });
    delete process.env.ROVEROS_CURRENT_RELEASE_MANIFEST;
    delete process.env.ROVEROS_UPDATE_STATUS_FILE;
    delete process.env.ROVEROS_GITHUB_REPOSITORY;
    delete process.env.ROVEROS_UPDATE_SOCKET_PATH;
    delete process.env.ROVEROS_UPDATE_SYSTEMCTL_PATH;
    delete process.env.UPDATE_TEST_SYSTEMD_STATE;
  }
});
