#!/usr/bin/env bash
set -euo pipefail
set +x

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly RELEASE_REPO="${1:-kadetkrysty/Rover-Pilot}"
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
command -v nmcli >/dev/null || fail "NetworkManager must be installed and configured before bootstrap."
systemctl is-active --quiet NetworkManager ||
  fail "NetworkManager is not active. Configure it locally before running this script; do not switch network managers over SSH."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl iw openssl

if ! node -e 'const [a,b,c]=process.versions.node.split(".").map(Number); process.exit(a>22 || (a===22 && (b>12 || (b===12 && c>=0))) ? 0 : 1)' 2>/dev/null; then
  apt-get update
  if ! apt-cache show nodejs 2>/dev/null | grep -q '^Version: 22\.'; then
    curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
      https://deb.nodesource.com/setup_22.x -o /tmp/roveros-nodesource-setup.sh
    bash /tmp/roveros-nodesource-setup.sh
    rm -f /tmp/roveros-nodesource-setup.sh
  fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

node -e 'const [a,b,c]=process.versions.node.split(".").map(Number); if (!(a>22 || (a===22 && (b>12 || (b===12 && c>=0))))) process.exit(1)' ||
  fail "Node.js 22.12 or later is required."

wifi_device="$(nmcli -t --escape yes -f DEVICE,TYPE device status |
  awk -F: '$2 == "wifi" { print $1; exit }')"
[[ -n "$wifi_device" ]] || fail "no Wi-Fi device managed by NetworkManager was found."
phy="$(iw dev "$wifi_device" info 2>/dev/null | awk '$1 == "wiphy" { print $2; exit }')"
[[ "$phy" =~ ^[0-9]+$ ]] || fail "could not identify the Wi-Fi radio."
iw phy "phy${phy}" info 2>/dev/null | awk '
  /^[[:space:]]*Supported interface modes:/ { in_modes=1; next }
  in_modes && /^[^[:space:]]/ { in_modes=0 }
  in_modes && /^[[:space:]]+\* AP([[:space:]]|$) { found=1 }
  END { exit !found }
' || fail "the detected Wi-Fi adapter does not report access-point mode."

mkdir -p "$SERVICE_DIR" "$CONFIG_DIR" "$STATE_DIR" "$NM_DIR" /etc/avahi/services
chmod 700 "$CONFIG_DIR" "$STATE_DIR"
install -m 0755 "$PROJECT_ROOT/scripts/minipc/provisioner.cjs" "$SERVICE_DIR/provisioner.cjs"
install -m 0755 "$PROJECT_ROOT/scripts/minipc/install-release.sh" "$SERVICE_DIR/install-release.sh"

pairing_code="$(openssl rand -hex 16)"
ap_password="$(openssl rand -hex 16)"
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 3650 \
  -keyout "$CONFIG_DIR/server.key" \
  -out "$CONFIG_DIR/server.crt" \
  -subj "/CN=RoverOS-Server" \
  -addext "subjectAltName=DNS:RoverOS-Server.local,DNS:roveros-server.local" \
  >/dev/null 2>&1
chmod 600 "$CONFIG_DIR/server.key" "$CONFIG_DIR/server.crt"
printf '%s\n' "$pairing_code" >"$CONFIG_DIR/pairing-code"
chmod 600 "$CONFIG_DIR/pairing-code"
printf 'ROVEROS_GITHUB_REPOSITORY=%s\n' "$RELEASE_REPO" >"$CONFIG_DIR/environment"
chmod 600 "$CONFIG_DIR/environment"

cat >"${NM_DIR}/RoverOS-Hotspot.nmconnection" <<PROFILE
[connection]
id=RoverOS-Hotspot
uuid=$(cat /proc/sys/kernel/random/uuid)
type=wifi
autoconnect=false

[wifi]
mode=ap
ssid=RoverOS-Server

[wifi-security]
key-mgmt=wpa-psk
psk=${ap_password}

[ipv4]
method=shared

[ipv6]
method=ignore
PROFILE
chmod 600 "${NM_DIR}/RoverOS-Hotspot.nmconnection"
nmcli connection reload

install -m 0644 "$PROJECT_ROOT/deploy/avahi/roveros-provisioning.service" \
  /etc/avahi/services/roveros-provisioning.service
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
ExecStartPre=/bin/bash -c 'nmcli -t -f DEVICE,TYPE,STATE device status | grep -q ":wifi:connected" || nmcli connection up id RoverOS-Hotspot'
ExecStart=/usr/bin/node /usr/local/lib/roveros-provisioner/provisioner.cjs
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=false
ProtectHome=true
ProtectSystem=full
ReadWritePaths=/etc/NetworkManager/system-connections /etc/roveros-provisioner /var/lib/roveros-provisioner /opt/roveros /etc/roveros.env /etc/systemd/system /etc/avahi/services

[Install]
WantedBy=multi-user.target
UNIT

if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw allow in on "$wifi_device" from 10.42.0.0/24 to any port 5000 proto tcp
  ufw allow in on "$wifi_device" from 10.42.0.0/24 to any port 5443 proto tcp
  ufw allow in on "$wifi_device" from 10.42.0.0/24 to any port 5353 proto udp
fi

systemctl daemon-reload
systemctl enable --now avahi-daemon.service roveros-provisioner.service
systemctl restart avahi-daemon.service

fingerprint="$(openssl x509 -in "$CONFIG_DIR/server.crt" -outform DER | sha256sum | awk '{print $1}')"
printf '\nRoverOS first-run bootstrap is installed.\n'
printf 'MiniPC name: RoverOS-Server\n'
printf 'Wi-Fi setup network: RoverOS-Server\n'
printf 'Wi-Fi password: %s\n' "$ap_password"
printf 'Setup pairing code: %s\n' "$pairing_code"
printf 'HTTPS certificate SHA-256 fingerprint: %s\n' "$fingerprint"
printf '\nKeep the Wi-Fi password, pairing code, and fingerprint private. The pairing code is required by the client setup screen.\n'

device_state="$(nmcli -g GENERAL.STATE device show "$wifi_device" 2>/dev/null || true)"
if [[ "$device_state" != 100* && "$device_state" != 110* && "$device_state" != 120* ]]; then
  nmcli connection up id RoverOS-Hotspot || true
fi
