#!/usr/bin/env bash
# Called only by the paired, local provisioning agent. No request data is accepted.
set -euo pipefail
set +x
umask 077

readonly REPO="${ROVEROS_GITHUB_REPOSITORY:-kadetkrysty/Rover-Pilot}"
readonly SERVICE_DIR="/usr/local/lib/roveros-provisioner"
readonly APP_ROOT="/opt/roveros"
readonly WORK_DIR="$(mktemp -d /var/tmp/roveros-install.XXXXXX)"
stage="preflight"
staging=""
cleanup() {
  rm -rf -- "$WORK_DIR"
  [[ -z "$staging" || ! -d "$staging" ]] || rm -rf -- "$staging"
}
trap cleanup EXIT
trap 'printf "RoverOS installation failed during %s.\n" "$stage" >&2' ERR
[[ "$EUID" -eq 0 && "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]
exec 9>/run/lock/roveros-install.lock
flock -n 9
if systemctl is-active --quiet roveros.service; then
  echo "A running RoverOS installation cannot be replaced by first-run setup." >&2
  exit 1
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a!==22 || b<12) process.exit(1)'
[[ "$(df --output=avail -k /opt | tail -1 | tr -d ' ')" -ge 2097152 ]]

download() {
  curl --fail --silent --show-error --location --retry 3 --connect-timeout 15 \
    --max-time 600 --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --max-filesize "${3:-1073741824}" "$1" -o "$2"
}

stage="release_metadata"
# Android/Windows releases share this repository, so never use /releases/latest.
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
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl python3
if ! command -v gh >/dev/null || ! gh attestation verify --help 2>/dev/null | grep -q -- '--source-ref'; then
  download https://cli.github.com/packages/githubcli-archive-keyring.gpg "$WORK_DIR/githubcli.gpg" 1048576
  # Official keyring checksum; a rotation requires a reviewed bootstrap update.
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

stage="unpack"
release_dir="${APP_ROOT}/releases/${tag#roveros-server-v}"
staging="${APP_ROOT}/releases/.staging-$$"
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
        if p.parts and p.parts[0] not in ("dist", "migrations", "deploy", "release-manifest.json"):
            raise ValueError("Unexpected server archive entry.")
    archive.extractall(sys.argv[2], filter="data")
PY
node - "$SERVICE_DIR/release-metadata.cjs" "$staging/release-manifest.json" "${tag#roveros-server-v}" "$APP_ROOT/current/release-manifest.json" <<'NODE'
const fs = require("node:fs");
const [helper, file, version, current] = process.argv.slice(2);
const existing = fs.existsSync(current) ? JSON.parse(fs.readFileSync(current, "utf8")).version : undefined;
require(helper).verifyManifest(JSON.parse(fs.readFileSync(file, "utf8")), version, existing);
NODE
test -s "$staging/dist/index.cjs"
test -s "$staging/dist/migrate.cjs"
test -s "$staging/dist/public/index.html"
test -s "$staging/migrations/meta/_journal.json"
find "$staging" -type d -exec chmod 0755 {} +
find "$staging" -type f -exec chmod 0644 {} +

stage="database"
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16 postgresql-client-16
systemctl enable --now postgresql.service
id -u roveros >/dev/null 2>&1 || useradd --system --create-home --user-group \
  --home-dir /var/lib/roveros --shell /usr/sbin/nologin roveros
database_exists="$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='roveros'")"
if [[ "$database_exists" == "1" ]]; then
  # Do not run a new baseline migration over an older db:push-managed installation.
  legacy="$(runuser -u postgres -- psql roveros -tAc "SELECT (to_regclass('public.users') IS NOT NULL AND to_regclass('drizzle.__drizzle_migrations') IS NULL)")"
  [[ "$legacy" != "t" ]] || { echo "An existing legacy database needs a reviewed migration." >&2; exit 1; }
  install -d -o postgres -g postgres -m 0700 /var/backups/roveros
  runuser -u postgres -- pg_dump -Fc roveros -f "/var/backups/roveros/pre-setup-$(date -u +%Y%m%dT%H%M%SZ).dump"
fi
if [[ -f /etc/roveros.env ]]; then
  database_password="$(sed -nE 's#^DATABASE_URL=postgresql://roveros:([a-f0-9]{64})@127\.0\.0\.1:5432/roveros$#\1#p' /etc/roveros.env)"
  [[ "$database_password" =~ ^[a-f0-9]{64}$ ]]
else
  database_password="$(openssl rand -hex 32)"
fi
role_exists="$(runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='roveros'")"
if [[ "$role_exists" == "1" ]]; then
  printf "ALTER ROLE roveros WITH LOGIN PASSWORD '%s';\n" "$database_password" |
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 >/dev/null
else
  printf "CREATE ROLE roveros LOGIN PASSWORD '%s';\n" "$database_password" |
    runuser -u postgres -- psql -v ON_ERROR_STOP=1 >/dev/null
fi
[[ "$database_exists" == "1" ]] || runuser -u postgres -- createdb --owner=roveros roveros
printf 'NODE_ENV=production\nDATABASE_URL=postgresql://roveros:%s@127.0.0.1:5432/roveros\nROVEROS_PROVISIONING_STATE_FILE=/var/lib/roveros-provisioner/state.json\n' \
  "$database_password" >"$WORK_DIR/roveros.env"
printf 'ROVEROS_TLS_CERT=/etc/roveros-provisioner/server.crt\nROVEROS_TLS_KEY=/etc/roveros-provisioner/server.key\nROVEROS_OWNER_PAIRING_CODE_FILE=/etc/roveros-provisioner/owner-pairing-code\nROVEROS_TLS_PORT=5443\n' \
  >>"$WORK_DIR/roveros.env"
if [[ ! -f /etc/roveros-provisioner/owner-pairing-code ]]; then
  openssl rand -hex 16 >/etc/roveros-provisioner/owner-pairing-code
fi
install -m 0640 -o root -g roveros "$WORK_DIR/roveros.env" /etc/roveros.env
chown root:roveros /etc/roveros-provisioner /etc/roveros-provisioner/server.key /etc/roveros-provisioner/owner-pairing-code
chmod 0750 /etc/roveros-provisioner
chmod 0640 /etc/roveros-provisioner/server.key /etc/roveros-provisioner/owner-pairing-code
chmod 0644 /etc/roveros-provisioner/server.crt
export DATABASE_URL="postgresql://roveros:${database_password}@127.0.0.1:5432/roveros"
export ROVEROS_MIGRATIONS_DIR="$staging/migrations"
# Inherit credentials through the environment, never through process arguments.
(cd "$staging" && runuser --preserve-environment -u roveros -- /usr/bin/node "$staging/dist/migrate.cjs")
unset DATABASE_URL database_password ROVEROS_MIGRATIONS_DIR

stage="service"
# Version directories contain trusted, read-only executable code; the app cannot modify it.
find "$staging" -type d -exec chmod 0755 {} +
find "$staging" -type f -exec chmod 0644 {} +
if [[ -e "$release_dir" ]]; then
  release_dir="${release_dir}-$(date -u +%Y%m%dT%H%M%SZ)"
fi
mv "$staging" "$release_dir"
ln -sfn "$release_dir" "$APP_ROOT/current.new"
mv -Tf "$APP_ROOT/current.new" "$APP_ROOT/current"
cat >/etc/systemd/system/roveros.service <<'UNIT'
[Unit]
Description=RoverOS web and API service
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=roveros
Group=roveros
WorkingDirectory=/opt/roveros/current
Environment=PORT=5000
EnvironmentFile=/etc/roveros.env
ExecStart=/usr/bin/node /opt/roveros/current/dist/index.cjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
StateDirectory=roveros

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemd-run --unit=roveros-handoff --collect --no-block "$SERVICE_DIR/handoff.sh"
