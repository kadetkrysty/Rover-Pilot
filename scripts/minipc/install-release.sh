#!/usr/bin/env bash
set -euo pipefail
set +x

readonly REPO="${ROVEROS_GITHUB_REPOSITORY:-kadetkrysty/Rover-Pilot}"
readonly API_URL="https://api.github.com/repos/${REPO}/releases/latest"
readonly WORK_DIR="$(mktemp -d /var/tmp/roveros-install.XXXXXX)"
readonly APP_ROOT="/opt/roveros"
readonly SERVICE_DIR="/usr/local/lib/roveros-provisioner"

cleanup() { rm -rf -- "$WORK_DIR"; }
trap cleanup EXIT

[[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || exit 1
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16 postgresql-client-16
systemctl enable --now postgresql.service

node -e 'const [a,b,c]=process.versions.node.split(".").map(Number); if (!(a>22 || (a===22 && (b>12 || (b===12 && c>=0))))) process.exit(1)'

release_json="${WORK_DIR}/release.json"
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
  -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' \
  "$API_URL" -o "$release_json"

node - "$release_json" "$WORK_DIR" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [jsonPath, outDir] = process.argv.slice(2);
const release = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
if (release.draft || release.prerelease || typeof release.tag_name !== "string") {
  throw new Error("No stable RoverOS release is available.");
}
const expected = ["RoverOS-server-linux-x64.tar.gz", "RoverOS-server-linux-x64.tar.gz.sha256"];
for (const name of expected) {
  const asset = release.assets?.find((item) => item.name === name);
  if (!asset || !asset.browser_download_url?.startsWith("https://github.com/")) {
    throw new Error(`Release is missing the expected ${name} asset.`);
  }
  fs.writeFileSync(path.join(outDir, name + ".url"), asset.browser_download_url);
}
NODE

for asset in RoverOS-server-linux-x64.tar.gz RoverOS-server-linux-x64.tar.gz.sha256; do
  url="$(cat "${WORK_DIR}/${asset}.url")"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 "$url" -o "${WORK_DIR}/${asset}"
done
(cd "$WORK_DIR" && sha256sum --check RoverOS-server-linux-x64.tar.gz.sha256)

release_dir="${APP_ROOT}/releases/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -o root -g root -m 0755 "$release_dir"
tar -xzf "${WORK_DIR}/RoverOS-server-linux-x64.tar.gz" -C "$release_dir"
test -f "${release_dir}/dist/index.cjs"
test -f "${release_dir}/scripts/minipc/migrate.cjs"

if ! id -u roveros >/dev/null 2>&1; then
  useradd --system --create-home --user-group --home-dir /opt/roveros \
    --shell /usr/sbin/nologin roveros
fi

if ! getent passwd postgres >/dev/null; then
  echo "PostgreSQL service account was not created." >&2
  exit 1
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='roveros'" | grep -q 1; then
  database_password="$(openssl rand -hex 32)"
  printf "CREATE ROLE roveros LOGIN PASSWORD '%s';\n" "$database_password" |
    sudo -u postgres psql -v ON_ERROR_STOP=1 >/dev/null
else
  database_password="$(openssl rand -hex 32)"
  printf "ALTER ROLE roveros WITH PASSWORD '%s';\n" "$database_password" |
    sudo -u postgres psql -v ON_ERROR_STOP=1 >/dev/null
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='roveros'" | grep -q 1; then
  sudo -u postgres createdb --owner=roveros roveros
fi

if [[ -e /etc/roveros.env ]]; then
  install -m 0640 -o root -g roveros /etc/roveros.env "${WORK_DIR}/previous-roveros.env"
  # Existing databases must be backed up before schema changes.
  install -d -o postgres -g postgres -m 0700 /var/backups/roveros
  sudo -u postgres pg_dump -Fc roveros \
    -f "/var/backups/roveros/pre-update-$(date -u +%Y%m%dT%H%M%SZ).dump"
fi

printf 'NODE_ENV=production\nPORT=5000\nDATABASE_URL=postgresql://roveros:%s@127.0.0.1:5432/roveros\nROVEROS_PROVISIONING_STATE_FILE=/var/lib/roveros-provisioner/state.json\n' \
  "$database_password" >"${WORK_DIR}/roveros.env"
install -m 0640 -o root -g roveros "${WORK_DIR}/roveros.env" /etc/roveros.env

chown -R roveros:roveros "$release_dir"
ln -sfn "$release_dir" "${APP_ROOT}/current.new"
mv -Tf "${APP_ROOT}/current.new" "${APP_ROOT}/current"

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
EnvironmentFile=/etc/roveros.env
ExecStart=/usr/bin/node /opt/roveros/current/dist/index.cjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/roveros-provisioner

[Install]
WantedBy=multi-user.target
UNIT

export DATABASE_URL="postgresql://roveros:${database_password}@127.0.0.1:5432/roveros"
runuser -u roveros -- env DATABASE_URL="$DATABASE_URL" \
  /usr/bin/node "${APP_ROOT}/current/scripts/minipc/migrate.cjs"
unset DATABASE_URL database_password

install -m 0644 "${APP_ROOT}/current/deploy/avahi/roveros.service" \
  /etc/avahi/services/roveros.service
rm -f /etc/avahi/services/roveros-provisioning.service
systemctl daemon-reload
systemctl enable roveros.service
systemd-run --unit=roveros-handoff --on-active=3s \
  /bin/sh -c 'systemctl disable --now roveros-provisioner.service && systemctl restart avahi-daemon.service && systemctl start roveros.service'
