// Smoke-test the extracted release outside the checkout: no ancestor node_modules.
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { execFileSync, spawn } from "node:child_process";
import assert from "node:assert/strict";

const dir = await mkdtemp(path.join(tmpdir(), "roveros-bundle-test-"));
let child;
try {
  execFileSync("tar", ["-xzf", "generated-artifacts/server-release/RoverOS-server-linux-x64.tar.gz", "-C", dir]);
  assert.equal(JSON.parse(await readFile(path.join(dir, "release-manifest.json"), "utf8")).architecture, "x64");
  const socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  let output = "";
  child = spawn(process.execPath, ["dist/index.cjs"], {
    cwd: dir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
      ROVEROS_PROVISIONING_STATE_FILE: path.join(dir, "not-configured.json"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (data) => output += data);
  child.stderr.on("data", (data) => output += data);
  let response;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw new Error(`Extracted server exited: ${output}`);
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/system/info`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) break;
    } catch { /* startup in progress */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.ok(response?.ok, `Extracted server did not start: ${output}`);
  assert.match((await response.json()).rover_name, /^roveros/i);
  assert.ok((await fetch(`http://127.0.0.1:${port}/`)).ok);
  const invalidCommand = await fetch(`http://127.0.0.1:${port}/api/rover/mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "invalid-fixture-☃" }),
  });
  assert.equal(invalidCommand.status, 400, "Bundled JSON/UTF-8 parsing must work without npm dependencies.");
  const state = await (await fetch(`http://127.0.0.1:${port}/api/provisioning/status`)).json();
  assert.equal(state.state, "ready");
  const health = await fetch(`http://127.0.0.1:${port}/api/system/health`, { signal: AbortSignal.timeout(3000) });
  assert.equal(health.status, 503, "Database readiness must not be fabricated.");
  const migration = spawn(process.execPath, ["dist/migrate.cjs"], {
    cwd: dir,
    env: { ...process.env, DATABASE_URL: "", NODE_PATH: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let migrationOutput = "";
  migration.stderr.on("data", (data) => migrationOutput += data);
  assert.equal(await new Promise((resolve) => migration.on("close", resolve)), 1);
  assert.match(migrationOutput, /DATABASE_URL must be set/);
  assert.doesNotMatch(output + migrationOutput, /MODULE_NOT_FOUND|Cannot find module/);
  console.log("Extracted server and migration bundles run without node_modules; unavailable DB fails health.");
} finally {
  if (child && child.exitCode === null) {
    const closed = new Promise((resolve) => child.once("close", resolve));
    child.kill("SIGTERM");
    await closed;
  }
  await rm(dir, { recursive: true, force: true });
}
