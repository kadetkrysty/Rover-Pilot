#!/usr/bin/env bash
set -euo pipefail
set +x

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly RELEASE_REPO="${1:-kadetkrysty/Rover-Pilot}"
readonly AP_MODE="${2:---access-point}"
readonly SERVICE_DIR="/usr/local/lib/roveros-provisioner"
readonly CONFIG_DIR="/etc/roveros-provisioner"
readonly STATE_DIR="/var/lib/roveros-provisioner"
readonly NM_DIR="/etc/NetworkManager/system-connections"

fail() {
  printf 'RoverOS bootstrap stopped: %s\n' "$*" >&2
  exit 1
}

[[ "${EUID}" -eq 0 ]] || fail "run with sudo from an Ubuntu Server terminal or SSH session."
[[ -f /etc/os-release ]] || fail "cannot identify this operating system."
. /etc/os-release
[[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" == "24.04" ]] ||
  fail "this bootstrap currently supports Ubuntu Server 24.04 only."
[[ "$(dpkg --print-architecture)" == "amd64" ]] ||
  fail "this bootstrap currently supports 64-bit amd64 MiniPCs only."
[[ "$RELEASE_REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] ||
  fail "release repository must be written as owner/repository."
[[ "$AP_MODE" == --access-point || "$AP_MODE" == --lan-only ]] ||
  fail "second argument must be --access-point or --lan-only."
[[ ! -f "$STATE_DIR/complete" ]] ||
  fail "this MiniPC is already provisioned; bootstrap will not reset it."
if [[ -f "$STATE_DIR/state.json" ]] &&
   grep -Eq '"state"[[:space:]]*:[[:space:]]*"(wifi_connecting|installing)"' "$STATE_DIR/state.json"; then
  fail "setup is in progress. Do not reinstall bootstrap during installation; investigate interrupted setup through owner SSH."
fi
command -v nmcli >/dev/null || fail "NetworkManager must be installed and configured before bootstrap."
systemctl is-active --quiet NetworkManager ||
  fail "NetworkManager is not active. Configure it locally before running this script; do not switch network managers over SSH."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl iw openssl avahi-daemon avahi-utils

if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a===22 && b>=12 ? 0 : 1)' 2>/dev/null; then
  apt-get update
  if ! apt-cache show nodejs 2>/dev/null | grep -q '^Version: 22\.'; then
    nodesource_setup="$(mktemp /var/tmp/roveros-nodesource.XXXXXX)"
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
      https://deb.nodesource.com/setup_22.x -o "$nodesource_setup"
    bash "$nodesource_setup"
    rm -f "$nodesource_setup"
  fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a!==22 || b<12) process.exit(1)' ||
  fail "this bootstrap requires Node.js 22.12+ in the Node 22 LTS series."

wifi_device="$(nmcli -t --escape yes -f DEVICE,TYPE device status |
  awk -F: '$2 == "wifi" { print $1; exit }')"
if [[ "$AP_MODE" == --access-point ]]; then
  [[ -n "$wifi_device" ]] || fail "no Wi-Fi device managed by NetworkManager was found."
  phy="$(iw dev "$wifi_device" info 2>/dev/null | awk '$1 == "wiphy" { print $2; exit }')"
  [[ "$phy" =~ ^[0-9]+$ ]] || fail "could not identify the Wi-Fi radio."
  iw phy "phy${phy}" info 2>/dev/null | awk '
    /^[[:space:]]*Supported interface modes:/ { in_modes=1; next }
    in_modes && /^[^[:space:]]/ { in_modes=0 }
    in_modes && /^[[:space:]]+\* AP([[:space:]]|$) { found=1 }
    END { exit !found }
  ' || fail "the detected Wi-Fi adapter does not report access-point mode."
fi

mkdir -p "$SERVICE_DIR" "$CONFIG_DIR" "$STATE_DIR" "$NM_DIR" /etc/avahi/services
chmod 700 "$CONFIG_DIR"
chmod 755 "$STATE_DIR"
install -d -m 0755 /etc/ufw/applications.d
cat >/etc/ufw/applications.d/roveros-setup <<'FIREWALL'
[RoverOSSetupHotspot]
title=RoverOS temporary setup hotspot
description=DHCP and DNS on the RoverOS setup AP interface only
ports=67/udp|53/tcp|53/udp
FIREWALL
chmod 644 /etc/ufw/applications.d/roveros-setup
install -m 0755 "$PROJECT_ROOT/scripts/minipc/provisioner.cjs" "$SERVICE_DIR/provisioner.cjs"
for helper in install-release.sh update-release.sh start-update.sh enable-updates.sh handoff.sh ensure-network.sh configure-firewall.sh release-metadata.cjs; do
  install -m 0755 "$PROJECT_ROOT/scripts/minipc/$helper" "$SERVICE_DIR/$helper"
done
for unit in roveros-update.service roveros-update-trigger.socket roveros-update-trigger@.service; do
  install -m 0644 "$PROJECT_ROOT/deploy/systemd/$unit" "/etc/systemd/system/$unit"
done
install -m 0644 "$PROJECT_ROOT/deploy/avahi/roveros-provisioning.service" "$SERVICE_DIR/roveros-provisioning.service"

if [[ ! -f "$CONFIG_DIR/pairing-code" ]]; then
  openssl rand -hex 16 >"$CONFIG_DIR/pairing-code"
fi
pairing_code="$(cat "$CONFIG_DIR/pairing-code")"
[[ "$pairing_code" =~ ^[a-f0-9]{32}$ ]] || fail "existing pairing code is invalid."
if [[ ! -f "$CONFIG_DIR/owner-pairing-code" ]]; then
  openssl rand -hex 16 >"$CONFIG_DIR/owner-pairing-code"
fi
owner_pairing_code="$(cat "$CONFIG_DIR/owner-pairing-code")"
[[ "$owner_pairing_code" =~ ^[a-f0-9]{32}$ ]] || fail "existing owner enrollment code is invalid."
if [[ ! -f "$CONFIG_DIR/server.crt" || ! -f "$CONFIG_DIR/server.key" ]]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 3650 \
    -keyout "$CONFIG_DIR/server.key" \
    -out "$CONFIG_DIR/server.crt" \
    -subj "/CN=RoverOS-Server" \
    -addext "subjectAltName=DNS:RoverOS-Server.local,DNS:roveros-server.local" \
    >/dev/null 2>&1
fi
chmod 600 "$CONFIG_DIR/server.key" "$CONFIG_DIR/server.crt"
printf '%s\n' "$pairing_code" >"$CONFIG_DIR/pairing-code"
chmod 600 "$CONFIG_DIR/pairing-code"
chmod 600 "$CONFIG_DIR/owner-pairing-code"
printf 'ROVEROS_GITHUB_REPOSITORY=%s\n' "$RELEASE_REPO" >"$CONFIG_DIR/environment"
printf 'ROVEROS_SETUP_AP=%s\n' "$([[ "$AP_MODE" == --access-point ]] && echo 1 || echo 0)" >>"$CONFIG_DIR/environment"
if [[ -n "$wifi_device" ]]; then
  [[ "$wifi_device" =~ ^[A-Za-z0-9_.:-]{1,15}$ ]] || fail "unexpected Wi-Fi interface name."
  printf 'ROVEROS_WIFI_DEVICE=%s\n' "$wifi_device" >>"$CONFIG_DIR/environment"
fi
chmod 600 "$CONFIG_DIR/environment"

if [[ "$AP_MODE" == --access-point && ! -f "${NM_DIR}/RoverOS-Hotspot.nmconnection" ]]; then
  ap_password="$(openssl rand -hex 16)"
  cat >"${NM_DIR}/RoverOS-Hotspot.nmconnection" <<PROFILE
[connection]
id=RoverOS-Hotspot
uuid=$(cat /proc/sys/kernel/random/uuid)
type=wifi
autoconnect=false
interface-name=${wifi_device}

[wifi]
mode=ap
ssid=RoverOS-Server

[wifi-security]
key-mgmt=wpa-psk
proto=rsn;
pairwise=ccmp;
group=ccmp;
psk=${ap_password}

[ipv4]
method=shared

[ipv6]
method=ignore
PROFILE
  chmod 600 "${NM_DIR}/RoverOS-Hotspot.nmconnection"
fi
nmcli connection reload

install -m 0644 "$PROJECT_ROOT/deploy/avahi/roveros-provisioning.service" \
  /etc/avahi/services/roveros.service
rm -f /etc/avahi/services/roveros-provisioning.service
hostnamectl set-hostname RoverOS-Server

cat >/etc/systemd/system/roveros-provisioner.service <<'UNIT'
[Unit]
Description=RoverOS first-run provisioning service
After=NetworkManager.service avahi-daemon.service
Wants=NetworkManager.service avahi-daemon.service

[Service]
Type=simple
User=root
Group=root
Environment=ROVEROS_STATE_DIR=/var/lib/roveros-provisioner
Environment=ROVEROS_PAIRING_CODE_FILE=/etc/roveros-provisioner/pairing-code
Environment=ROVEROS_TLS_CERT=/etc/roveros-provisioner/server.crt
Environment=ROVEROS_TLS_KEY=/etc/roveros-provisioner/server.key
Environment=ROVEROS_INSTALLER=/usr/local/lib/roveros-provisioner/install-release.sh
EnvironmentFile=/etc/roveros-provisioner/environment
ExecStartPre=/usr/local/lib/roveros-provisioner/ensure-network.sh
ExecStart=/usr/bin/node /usr/local/lib/roveros-provisioner/provisioner.cjs
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=false
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable avahi-daemon.service roveros-provisioner.service
systemctl restart avahi-daemon.service
systemctl restart roveros-provisioner.service

fingerprint="$(openssl x509 -in "$CONFIG_DIR/server.crt" -outform DER | sha256sum | awk '{print $1}')"
printf '\nRoverOS first-run bootstrap is installed.\n'
printf 'MiniPC name: RoverOS-Server\n'
if [[ "$AP_MODE" == --access-point ]]; then
  ap_password="$(nmcli --show-secrets -g 802-11-wireless-security.psk connection show id RoverOS-Hotspot)"
  printf 'Wi-Fi setup network: RoverOS-Server\n'
  printf 'Wi-Fi password: %s\n' "$ap_password"
fi
printf 'Setup pairing code: %s\n' "$pairing_code"
printf 'Owner enrollment code: %s\n' "$owner_pairing_code"
printf 'HTTPS certificate SHA-256 fingerprint: %s\n' "$fingerprint"
printf '\nKeep both codes and the fingerprint private. The setup code is only for first-run Wi-Fi setup; the owner enrollment code is only for pairing the first normal-operation owner client.\n'

printf 'If already connected to Wi-Fi, use that LAN. Setup does not replace an active Wi-Fi connection until you submit the client wizard.\n'
