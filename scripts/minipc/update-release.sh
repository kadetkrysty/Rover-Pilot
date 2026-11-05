#!/usr/bin/env bash
# Root-only, no-argument versioned updater. Never build software on the MiniPC.
set -Eeuo pipefail
set +x
umask 077

readonly REPO="${ROVEROS_GITHUB_REPOSITORY:-}"
readonly SERVICE_DIR="${ROVEROS_UPDATE_SERVICE_DIR:-/usr/local/lib/roveros-provisioner}"
readonly APP_ROOT="${ROVEROS_UPDATE_APP_ROOT:-/opt/roveros}"
readonly STATE_DIR="${ROVEROS_UPDATE_STATE_DIR:-/var/lib/roveros-provisioner}"
readonly BACKUP_DIR="${ROVEROS_UPDATE_BACKUP_DIR:-/var/backups/roveros}"
readonly ENV_FILE="${ROVEROS_UPDATE_ENV_FILE:-/etc/roveros.env}"
readonly LOCK_FILE="${ROVEROS_UPDATE_LOCK_FILE:-/run/lock/roveros-update.lock}"
readonly WORK_DIR="$(mktemp -d "${ROVEROS_UPDATE_WORK_DIR:-/var/tmp/roveros-update}.XXXXXX")"
stage="starting"
switched=0
previous_target=""
backup_file=""

write_status() {
  local state="$1" progress="$2" message="$3"
  node - "$STATE_DIR" "$state" "$stage" "$progress" "$message" "${backup_file:-}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [dir, state, stage, progress, message, backupFile] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
const file = path.join(dir, "update-status.json");
const temp = `${file}.${process.pid}.tmp`;
const value = { state, stage, progress: Number(progress), message, updatedAt: new Date().toISOString() };
if (backupFile) value.databaseBackup = backupFile;
fs.writeFileSync(temp, `${JSON.stringify(value)}\n`, { mode: 0o644 });
fs.chmodSync(temp, 0o644);
fs.renameSync(temp, file);
NODE
}

health_check() {
  for _ in {1..30}; do
    if systemctl is-active --quiet roveros.service &&
      curl --fail --silent --max-time 3 http://127.0.0.1:5000/api/system/health |
        node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const j=JSON.parse(s);process.exit(j.status==="ready"&&j.database==="ready"?0:1)}catch{process.exit(1)}})' &&
      curl --fail --silent --max-time 3 http://127.0.0.1:5000/ -o /dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback_application() {
  [[ "$switched" -eq 1 && -n "$previous_target" ]] || return 1
  systemctl stop roveros.service || true
  ln -sfn "$previous_target" "$APP_ROOT/current.rollback"
  mv -Tf "$APP_ROOT/current.rollback" "$APP_ROOT/current"
  if [[ -f "$previous_target/scripts/minipc/install-control.sh" ]]; then
    bash "$previous_target/scripts/minipc/install-control.sh" "$previous_target" || true
  else
    systemctl stop roveros-control.service || true
  fi
  switched=0
  systemctl start roveros.service || true
  health_check
}

on_error() {
  local code=$?
  trap - ERR
  if [[ "$switched" -eq 1 ]]; then
    stage="rollback"
    if rollback_application; then
      write_status "rolled_back" 100 \
        "The new app failed health checks. The previous app release was restored; database changes were not rolled back."
    else
      write_status "recovery_required" 100 \
        "The new app and automatic app rollback both failed. Use owner SSH; database changes were not rolled back."
    fi
  else
    write_status "failed" 100 \
      "Update stopped during ${stage}. Existing settings were retained; review the saved database backup before manual recovery."
  fi
  exit "$code"
}

cleanup() {
  rm -rf -- "$WORK_DIR"
  [[ -z "${staging:-}" || ! -d "$staging" ]] || rm -rf -- "$staging"
}
trap cleanup EXIT
trap on_error ERR

[[ "${ROVEROS_UPDATE_TESTING:-}" == "1" || "$EUID" -eq 0 ]]
[[ "$#" -eq 0 ]]
[[ "$REPO" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]+$ ]]
[[ "$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')" == "22" ]]
[[ -f "$APP_ROOT/current/release-manifest.json" ]]
[[ -f "$STATE_DIR/complete" ]]
exec 9>"$LOCK_FILE"
flock -n 9
mkdir -p "$APP_ROOT/releases" "$BACKUP_DIR" "$STATE_DIR"
# Staging directories are generated only by this updater and may remain after power loss.
find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -name '.update-staging-*' -exec rm -rf -- {} +
stage="preflight"
write_status "running" 2 "Checking release availability and required disk space."
[[ "$(df --output=avail -k "$APP_ROOT" | tail -1 | tr -d ' ')" -ge 2097152 ]]
database_bytes="$(runuser -u postgres -- psql -tAc "SELECT pg_database_size('roveros')")"
[[ "$database_bytes" =~ ^[0-9]+$ ]]
backup_available="$(df --output=avail -B1 "$BACKUP_DIR" | tail -1 | tr -d ' ')"
[[ "$backup_available" =~ ^[0-9]+$ ]]
(( backup_available >= database_bytes + 268435456 ))

download() {
  curl --fail --silent --show-error --location --retry 3 --connect-timeout 15 \
    --max-time 600 --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --max-filesize "${3:-1073741824}" "$1" -o "$2"
}

stage="release_metadata"
download "https://api.github.com/repos/${REPO}/releases?per_page=100" "$WORK_DIR/releases.json" 8388608
node "$SERVICE_DIR/release-metadata.cjs" "$WORK_DIR/releases.json" "$WORK_DIR" "$REPO"
tag="$(cat "$WORK_DIR/release-tag")"
for asset in RoverOS-server-linux-x64.tar.gz RoverOS-server-linux-x64.tar.gz.sha256 RoverOS-server-linux-x64.intoto.jsonl; do
  download "$(cat "$WORK_DIR/${asset}.url")" "$WORK_DIR/$asset"
done
node - "$WORK_DIR" <<'NODE'
const fs = require("node:fs"), crypto = require("node:crypto"), path = require("node:path");
const dir = process.argv[2], name = "RoverOS-server-linux-x64.tar.gz";
const checksum = fs.readFileSync(path.join(dir, name + ".sha256"), "utf8");
const expected = /^([a-f0-9]{64}) {2}RoverOS-server-linux-x64\.tar\.gz\n?$/.exec(checksum);
const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, name))).digest("hex");
if (!expected || actual !== expected[1]) throw new Error("Server artifact checksum was not accepted.");
NODE

stage="provenance_verification"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3 ffmpeg
if ! command -v gh >/dev/null || ! gh attestation verify --help 2>/dev/null | grep -q -- '--source-ref'; then
  download https://cli.github.com/packages/githubcli-archive-keyring.gpg "$WORK_DIR/githubcli.gpg" 1048576
  printf '6084d5d7bd8e288441e0e94fc6275570895da18e6751f70f057485dc2d1a811b  %s\n' "$WORK_DIR/githubcli.gpg" | sha256sum -c -
  install -d -m 0755 /etc/apt/keyrings
  install -m 0644 "$WORK_DIR/githubcli.gpg" /etc/apt/keyrings/githubcli-archive-keyring.gpg
  printf 'deb [arch=amd64 signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main\n' \
    >/etc/apt/sources.list.d/github-cli.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y gh
fi
GH_PROMPT_DISABLED=1 GH_CONFIG_DIR="$WORK_DIR/gh-config" gh attestation verify "$WORK_DIR/RoverOS-server-linux-x64.tar.gz" \
  --hostname github.com \
  --bundle "$WORK_DIR/RoverOS-server-linux-x64.intoto.jsonl" \
  --repo "$REPO" --signer-workflow "$REPO/.github/workflows/roveros-server-release.yml" \
  --source-ref "refs/tags/$tag" --deny-self-hosted-runners >/dev/null

stage="unpack_and_manifest"
release_version="${tag#roveros-server-v}"
staging="${APP_ROOT}/releases/.update-staging-$$"
install -d -m 0755 "$staging"
python3 - "$WORK_DIR/RoverOS-server-linux-x64.tar.gz" "$staging" <<'PY'
import pathlib, sys, tarfile
with tarfile.open(sys.argv[1], "r:gz") as archive:
    members = archive.getmembers()
    if len(members) > 20000 or sum(m.size for m in members) > 1073741824:
        raise ValueError("Server archive exceeds allowed bounds.")
    for member in members:
        p = pathlib.PurePosixPath(member.name)
        if p.is_absolute() or ".." in p.parts or not (member.isfile() or member.isdir()):
            raise ValueError("Unsafe server archive entry.")
        if p.parts and p.parts[0] not in ("dist", "migrations", "deploy", "scripts", "firmware", "docs", "release-manifest.json"):
            raise ValueError("Unexpected server archive entry.")
    archive.extractall(sys.argv[2], filter="data")
PY
node - "$SERVICE_DIR/release-metadata.cjs" "$staging/release-manifest.json" "$release_version" "$APP_ROOT/current/release-manifest.json" <<'NODE'
const fs = require("node:fs");
const [helper, file, version, current] = process.argv.slice(2);
const installed = JSON.parse(fs.readFileSync(current, "utf8")).version;
require(helper).verifyManifest(JSON.parse(fs.readFileSync(file, "utf8")), version, installed);
NODE
for required in dist/index.cjs dist/migrate.cjs dist/public/index.html migrations/meta/_journal.json deploy/avahi/roveros.service scripts/minipc/install-control.sh deploy/systemd/roveros-control.service firmware/mini_pc_master/control_core.py firmware/mini_pc_master/secure_control_daemon.py; do
  test -s "$staging/$required"
done

stage="database_backup"
write_status "running" 35 "Saving a PostgreSQL backup before applying database migrations."
install -d -o postgres -g postgres -m 0700 "$BACKUP_DIR"
backup_file="${BACKUP_DIR}/pre-update-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
runuser -u postgres -- pg_dump -Fc roveros -f "$backup_file"
test -s "$backup_file"
chown postgres:postgres "$backup_file"
chmod 0600 "$backup_file"
write_status "running" 45 "PostgreSQL backup saved. Preparing to apply database migrations."

stage="database_migrations"
write_status "running" 55 "Applying the release's additive database migrations."
set -a
source "$ENV_FILE"
set +a
[[ "${DATABASE_URL:-}" =~ ^postgresql://roveros:[a-f0-9]{64}@127\.0\.0\.1:5432/roveros$ ]]
export ROVEROS_MIGRATIONS_DIR="$staging/migrations"
(cd "$staging" && runuser --preserve-environment -u roveros -- /usr/bin/node "$staging/dist/migrate.cjs")
unset DATABASE_URL database_password ROVEROS_MIGRATIONS_DIR

stage="switch_release"
release_dir="${APP_ROOT}/releases/${release_version}"
if [[ -e "$release_dir" ]]; then
  release_dir="${release_dir}-$(date -u +%Y%m%dT%H%M%SZ)-$$"
fi
find "$staging" -type d -exec chmod 0755 {} +
find "$staging" -type f -exec chmod 0644 {} +
mv "$staging" "$release_dir"
staging=""
previous_target="$(readlink -f "$APP_ROOT/current")"
systemctl stop roveros-control.service || true
write_status "running" 75 "Switching to the verified app release and checking startup health."
ln -sfn "$release_dir" "$APP_ROOT/current.new"
mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"
switched=1
bash "$APP_ROOT/current/scripts/minipc/install-control.sh" "$APP_ROOT/current"
systemctl restart roveros.service
stage="startup_health_check"
health_check
switched=0
stage="complete"
write_status "complete" 100 "RoverOS update completed. The PostgreSQL backup is retained; database changes are not automatically reversed."
exit 0
