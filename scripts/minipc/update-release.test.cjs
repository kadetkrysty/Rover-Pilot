const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync, spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "roveros-update-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const serviceDir = path.join(root, "service");
  const appRoot = path.join(root, "app");
  const stateDir = path.join(root, "state");
  const backupDir = path.join(root, "backups");
  const envFile = path.join(root, "roveros.env");
  const mockBin = path.join(root, "bin");
  const assetsDir = path.join(root, "assets");
  for (const dir of [serviceDir, stateDir, mockBin, assetsDir]) fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(appRoot, "releases", "1.0.0"), { recursive: true });
  fs.writeFileSync(path.join(stateDir, "complete"), "");
  fs.writeFileSync(envFile, `DATABASE_URL=postgresql://roveros:${"a".repeat(64)}@127.0.0.1:5432/roveros\n`);
  fs.copyFileSync(path.join(__dirname, "release-metadata.cjs"), path.join(serviceDir, "release-metadata.cjs"));
  fs.writeFileSync(path.join(appRoot, "releases", "1.0.0", "release-manifest.json"), JSON.stringify({
    schemaVersion: 1, product: "RoverOS", version: "1.0.0", architecture: "x64",
    operatingSystem: "ubuntu-24.04", nodeMajor: 22, sourceCommit: "a".repeat(40),
  }));
  fs.symlinkSync(path.join(appRoot, "releases", "1.0.0"), path.join(appRoot, "current"));

  const releaseDir = path.join(root, "release");
  for (const dir of [
    "dist/public", "migrations/meta", "deploy/avahi",
  ]) fs.mkdirSync(path.join(releaseDir, dir), { recursive: true });
  fs.writeFileSync(path.join(releaseDir, "release-manifest.json"), JSON.stringify({
    schemaVersion: 1, product: "RoverOS", version: "1.1.0", architecture: "x64",
    operatingSystem: "ubuntu-24.04", nodeMajor: 22, sourceCommit: "b".repeat(40),
  }));
  for (const [file, content] of [
    ["dist/index.cjs", "server bundle"],
    ["dist/migrate.cjs", "migration bundle"],
    ["dist/public/index.html", "app"],
    ["migrations/meta/_journal.json", "{}"],
    ["deploy/avahi/roveros.service", "service"],
  ]) fs.writeFileSync(path.join(releaseDir, file), content);

  const archive = path.join(assetsDir, "RoverOS-server-linux-x64.tar.gz");
  execFileSync("tar", ["-C", releaseDir, "-czf", archive, "."]);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  fs.writeFileSync(path.join(assetsDir, "RoverOS-server-linux-x64.tar.gz.sha256"), `${digest}  RoverOS-server-linux-x64.tar.gz\n`);
  fs.writeFileSync(path.join(assetsDir, "RoverOS-server-linux-x64.intoto.jsonl"), "test attestation fixture\n");
  const assetNames = [
    "RoverOS-server-linux-x64.tar.gz",
    "RoverOS-server-linux-x64.tar.gz.sha256",
    "RoverOS-server-linux-x64.intoto.jsonl",
  ];
  const tag = "roveros-server-v1.1.0";
  fs.writeFileSync(path.join(root, "releases.json"), JSON.stringify([{
    tag_name: tag,
    draft: false,
    prerelease: false,
    assets: assetNames.map((name) => ({
      name,
      browser_download_url: `https://github.com/example/rover/releases/download/${tag}/${name}`,
    })),
  }]));

  const mock = (name, contents) => {
    const file = path.join(mockBin, name);
    fs.writeFileSync(file, `#!/usr/bin/env bash\nset -euo pipefail\n${contents}\n`, { mode: 0o755 });
  };
  mock("curl", `
out=""
url=""
while (($#)); do
  if [[ "$1" == "-o" ]]; then out="$2"; shift 2; else url="$1"; shift; fi
done
case "$url" in
  https://api.github.com/*) cp "$UPDATE_TEST_RELEASES" "$out" ;;
  https://github.com/*) cp "$UPDATE_TEST_ASSETS/$(basename "$url")" "$out" ;;
  http://127.0.0.1:5000/api/system/health)
    restarts="$(cat "$UPDATE_TEST_RESTARTS" 2>/dev/null || echo 0)"
    if [[ "\${UPDATE_TEST_FAIL_FIRST_HEALTH:-0}" == 1 && "$restarts" -eq 1 ]]; then
      printf '{"status":"unavailable","database":"ready"}'
      exit 22
    fi
    printf '{"status":"ready","database":"ready"}'
    ;;
  http://127.0.0.1:5000/) exit 0 ;;
  *) echo "unexpected test URL: $url" >&2; exit 2 ;;
esac
`);
  mock("gh", `
if [[ "$*" == "attestation verify --help" ]]; then echo "--source-ref"; exit 0; fi
[[ "\${UPDATE_TEST_INVALID_ATTESTATION:-0}" != 1 ]]
`);
  mock("apt-get", "exit 0");
  mock("systemctl", `
if [[ ( "$1" == restart || "$1" == start ) && "$2" == roveros.service ]]; then
  current="$(cat "$UPDATE_TEST_RESTARTS" 2>/dev/null || echo 0)"
  echo "$((current + 1))" >"$UPDATE_TEST_RESTARTS"
fi
exit 0
`);
  mock("df", `
if [[ "$*" == *"-B1"* ]]; then printf "Avail\\n10000000000\\n"; else printf "Avail\\n4194304\\n"; fi
`);
  mock("runuser", `
case "$*" in
  *"SELECT pg_database_size"*) echo 1024 ;;
  *"pg_dump"*)
    while (($#)); do
      if [[ "$1" == "-f" ]]; then printf "postgres backup fixture\\n" >"$2"; exit 0; fi
      shift
    done
    exit 2
    ;;
  *"migrate.cjs"*)
    echo migration >>"$UPDATE_TEST_MIGRATIONS"
    if [[ "\${UPDATE_TEST_BLOCK_MIGRATION:-0}" == 1 ]]; then
      touch "$UPDATE_TEST_MIGRATION_STARTED"
      while :; do /usr/bin/sleep 0.05; done
    fi
    ;;
esac
`);
  mock("install", `
args=()
while (($#)); do
  case "$1" in
    -o|-g) shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
exec /usr/bin/install "\${args[@]}"
`);
  mock("chown", "exit 0");
  mock("sleep", "exit 0");

  const env = {
    ...process.env,
    PATH: `${mockBin}:${process.env.PATH}`,
    ROVEROS_UPDATE_TESTING: "1",
    ROVEROS_GITHUB_REPOSITORY: "example/rover",
    ROVEROS_UPDATE_SERVICE_DIR: serviceDir,
    ROVEROS_UPDATE_APP_ROOT: appRoot,
    ROVEROS_UPDATE_STATE_DIR: stateDir,
    ROVEROS_UPDATE_BACKUP_DIR: backupDir,
    ROVEROS_UPDATE_ENV_FILE: envFile,
    ROVEROS_UPDATE_WORK_DIR: path.join(root, "work"),
    ROVEROS_UPDATE_LOCK_FILE: path.join(root, "update.lock"),
    UPDATE_TEST_RELEASES: path.join(root, "releases.json"),
    UPDATE_TEST_ASSETS: assetsDir,
    UPDATE_TEST_RESTARTS: path.join(root, "restart-count"),
    UPDATE_TEST_MIGRATIONS: path.join(root, "migrations-run"),
    UPDATE_TEST_MIGRATION_STARTED: path.join(root, "migration-started"),
  };
  return { root, appRoot, stateDir, backupDir, env, script: path.join(__dirname, "update-release.sh") };
}

function runUpdate(env, script) {
  const result = spawnSync("bash", [script], { env, encoding: "utf8", timeout: 30_000 });
  if (result.error) throw result.error;
  return result;
}

function statusFor(fixture) {
  return JSON.parse(fs.readFileSync(path.join(fixture.stateDir, "update-status.json"), "utf8"));
}

test("an interrupted migration leaves the current release intact and a retry completes", async (t) => {
  const f = fixture(t);
  f.env.UPDATE_TEST_BLOCK_MIGRATION = "1";
  const child = spawn("bash", [f.script], {
    env: f.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let childOutput = "";
  child.stdout.setEncoding("utf8").on("data", (value) => { childOutput += value; });
  child.stderr.setEncoding("utf8").on("data", (value) => { childOutput += value; });
  for (let attempt = 0; attempt < 500 && !fs.existsSync(f.env.UPDATE_TEST_MIGRATION_STARTED); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(
    fs.existsSync(f.env.UPDATE_TEST_MIGRATION_STARTED),
    `update reached migration; child exit=${child.exitCode}; output=${childOutput}; state=${fs.existsSync(path.join(f.stateDir, "update-status.json")) ? fs.readFileSync(path.join(f.stateDir, "update-status.json"), "utf8") : "missing"}`,
  );
  const exitPromise = once(child, "exit");
  process.kill(-child.pid, "SIGKILL");
  await exitPromise;
  assert.equal(fs.realpathSync(path.join(f.appRoot, "current")), path.join(f.appRoot, "releases", "1.0.0"));
  assert.equal(statusFor(f).state, "running");
  assert.equal(statusFor(f).stage, "database_migrations");
  assert.equal(fs.readdirSync(f.backupDir).length, 1);

  f.env.UPDATE_TEST_BLOCK_MIGRATION = "0";
  const retry = runUpdate(f.env, f.script);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(fs.realpathSync(path.join(f.appRoot, "current")), path.join(f.appRoot, "releases", "1.1.0"));
  assert.equal(statusFor(f).state, "complete");
  assert.equal(fs.readFileSync(f.env.UPDATE_TEST_MIGRATIONS, "utf8").trim().split("\n").length, 2);
  assert.equal(fs.readdirSync(f.backupDir).length, 2);
});

test("invalid GitHub provenance fails closed before database backup or release switch", (t) => {
  const f = fixture(t);
  f.env.UPDATE_TEST_INVALID_ATTESTATION = "1";
  const result = runUpdate(f.env, f.script);
  assert.notEqual(result.status, 0);
  assert.equal(statusFor(f).state, "failed");
  assert.equal(statusFor(f).stage, "provenance_verification", `${result.stdout}\n${result.stderr}`);
  assert.equal(fs.realpathSync(path.join(f.appRoot, "current")), path.join(f.appRoot, "releases", "1.0.0"));
  assert.equal(fs.readdirSync(f.backupDir).length, 0);
});

test("failed startup health checks restore the previous app release without claiming database rollback", (t) => {
  const f = fixture(t);
  f.env.UPDATE_TEST_FAIL_FIRST_HEALTH = "1";
  const result = runUpdate(f.env, f.script);
  assert.notEqual(result.status, 0);
  assert.equal(fs.realpathSync(path.join(f.appRoot, "current")), path.join(f.appRoot, "releases", "1.0.0"));
  assert.equal(statusFor(f).state, "rolled_back", `${result.stdout}\n${result.stderr}`);
  assert.match(statusFor(f).message, /database changes were not rolled back/i);
  assert.equal(fs.readdirSync(f.backupDir).length, 1);
});
