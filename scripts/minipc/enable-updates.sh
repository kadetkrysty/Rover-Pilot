#!/usr/bin/env bash
# One-time owner-SSH enablement for MiniPCs installed before the update feature.
set -Eeuo pipefail
set +x
umask 077

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly SERVICE_DIR="/usr/local/lib/roveros-provisioner"
readonly CONFIG_DIR="/etc/roveros-provisioner"
readonly STATE_DIR="/var/lib/roveros-provisioner"

[[ "$EUID" -eq 0 ]] || { echo "Run this one-time command over owner SSH with sudo." >&2; exit 1; }
[[ "$#" -eq 1 && "$1" == "--install-latest" ]] || {
  echo "Usage: sudo bash scripts/minipc/enable-updates.sh --install-latest" >&2
  exit 2
}
[[ -f "$STATE_DIR/complete" && -L /opt/roveros/current && -f /opt/roveros/current/release-manifest.json ]] || {
  echo "This MiniPC does not have a completed versioned RoverOS installation." >&2
  exit 1
}
[[ -f "$CONFIG_DIR/environment" && -f /etc/roveros.env ]] || {
  echo "Required RoverOS installation settings were not found; no files were changed." >&2
  exit 1
}
repository="$(sed -nE 's/^ROVEROS_GITHUB_REPOSITORY=([A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]+)$/\1/p' "$CONFIG_DIR/environment")"
[[ "$repository" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]+$ ]] || {
  echo "The saved release repository is invalid; no files were changed." >&2
  exit 1
}

for helper in update-release.sh start-update.sh release-metadata.cjs; do
  install -m 0755 "$PROJECT_ROOT/scripts/minipc/$helper" "$SERVICE_DIR/$helper"
done
install -m 0644 "$PROJECT_ROOT/deploy/systemd/roveros-update.service" \
  /etc/systemd/system/roveros-update.service
for unit in roveros-update-trigger.socket roveros-update-trigger@.service; do
  install -m 0644 "$PROJECT_ROOT/deploy/systemd/$unit" "/etc/systemd/system/$unit"
done
if ! grep -q '^ROVEROS_GITHUB_REPOSITORY=' /etc/roveros.env; then
  printf 'ROVEROS_GITHUB_REPOSITORY=%s\n' "$repository" >>/etc/roveros.env
fi
chown root:roveros /etc/roveros.env
chmod 0640 /etc/roveros.env
systemctl daemon-reload
systemctl enable --now roveros-update-trigger.socket
systemctl start --no-block roveros-update.service
printf 'Update support is enabled. Installing the latest verified server release now.\n'
printf 'Check progress with: sudo systemctl status roveros-update.service --no-pager\n'
