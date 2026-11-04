#!/usr/bin/env bash
set -euo pipefail
set +x

SSID="RoverOS-Server"
CONNECTION_NAME="RoverOS-Hotspot"
PROFILE_DIR="/etc/NetworkManager/system-connections"
PROFILE_PATH="${PROFILE_DIR}/${CONNECTION_NAME}.nmconnection"

fail() {
  printf 'Hotspot setup stopped: %s\n' "$*" >&2
  exit 1
}

is_ssh_session() {
  [[ -n "${SSH_CONNECTION:-}${SSH_TTY:-}" ]] && return 0

  local pid="$$"
  local comm parent
  for _ in {1..12}; do
    [[ -r "/proc/${pid}/comm" && -r "/proc/${pid}/status" ]] || break
    IFS= read -r comm <"/proc/${pid}/comm" || break
    case "$comm" in
      sshd|sshd-session|sshd-auth) return 0 ;;
    esac
    parent="$(awk '/^PPid:/ { print $2 }' "/proc/${pid}/status")"
    [[ "$parent" =~ ^[0-9]+$ && "$parent" != "$pid" ]] || break
    pid="$parent"
  done
  return 1
}

[[ "${EUID}" -eq 0 ]] || fail "run this script with sudo from the MiniPC's local console."
[[ -t 0 && -t 1 ]] || fail "an interactive local terminal is required."
is_ssh_session && fail "SSH sessions are not allowed; use the MiniPC's local console."

command -v nmcli >/dev/null || fail "NetworkManager (nmcli) is not installed."
command -v iw >/dev/null || fail "iw is required to check adapter access-point support; install it with: sudo apt install iw"
command -v openssl >/dev/null || fail "openssl is required to generate a secure password."
command -v python3 >/dev/null || fail "python3 is required to identify the hotspot subnet."

[[ "$(nmcli -t -f RUNNING general 2>/dev/null || true)" == "running" ]] ||
  fail "NetworkManager is not running. This script will not switch network managers."

wifi_devices=()
while IFS=: read -r device type; do
  [[ "$type" == "wifi" ]] && wifi_devices+=("$device")
done < <(nmcli -t -f DEVICE,TYPE device status)

if [[ "$#" -gt 1 ]]; then
  fail "usage: sudo bash scripts/setup-minipc-hotspot.sh [wifi-interface]"
elif [[ "$#" -eq 1 ]]; then
  iface="$1"
else
  [[ "${#wifi_devices[@]}" -eq 1 ]] ||
    fail "found ${#wifi_devices[@]} Wi-Fi interfaces; rerun with one interface name from 'nmcli device status'."
  iface="${wifi_devices[0]}"
fi

[[ "$iface" =~ ^[[:alnum:]_.:-]+$ ]] || fail "invalid Wi-Fi interface name."
[[ " ${wifi_devices[*]} " == *" ${iface} "* ]] || fail "'$iface' is not a Wi-Fi interface managed by this NetworkManager instance."
[[ "$(nmcli -g GENERAL.NM-MANAGED device show "$iface" 2>/dev/null || true)" == "yes" ]] ||
  fail "NetworkManager does not manage '$iface'. No network configuration was changed."

phy_number="$(iw dev "$iface" info 2>/dev/null | awk '$1 == "wiphy" { print $2; exit }')"
[[ "$phy_number" =~ ^[0-9]+$ ]] ||
  fail "could not identify the radio for '$iface'; no network configuration was changed."
phy="phy${phy_number}"

if ! iw phy "$phy" info 2>/dev/null | awk '
  /^[[:space:]]*Supported interface modes:/ { in_modes=1; next }
  in_modes && /^[^[:space:]]/ { in_modes=0 }
  in_modes && /^[[:space:]]+\* AP([[:space:]]|$)/ { found=1 }
  END { exit !found }
'; then
  fail "'$iface' does not report access-point mode support. No network configuration was changed."
fi

state="$(nmcli -g GENERAL.STATE device show "$iface" 2>/dev/null || true)"
case "$state" in
  100*|110*|120*|*connected*)
    printf 'WARNING: %s is currently active (%s). Starting this hotspot may disconnect its Wi-Fi connection and any SSH session using it.\n' "$iface" "$state"
    printf 'Continue only at the MiniPC local console, with another way to restore network access.\n'
    read -r -p "Type 'SWITCH ${iface}' to confirm the Wi-Fi change: " confirmation
    [[ "$confirmation" == "SWITCH ${iface}" ]] || fail "confirmation did not match; the network was not changed."
    ;;
  *)
    printf '%s is not currently connected (state: %s).\n' "$iface" "${state:-unknown}"
    read -r -p "Type 'START HOTSPOT' to create and activate the RoverOS Wi-Fi network: " confirmation
    [[ "$confirmation" == "START HOTSPOT" ]] || fail "confirmation did not match; the network was not changed."
    ;;
esac

[[ ! -e "$PROFILE_PATH" ]] ||
  fail "a '$CONNECTION_NAME' profile already exists; inspect it with nmcli before making changes."
[[ -d "$PROFILE_DIR" ]] || fail "$PROFILE_DIR does not exist; NetworkManager is not configured for system connection profiles."

password="$(openssl rand -hex 16)"
profile_tmp="$(mktemp "${PROFILE_DIR}/.${CONNECTION_NAME}.XXXXXX")"
cleanup() {
  [[ -n "${profile_tmp:-}" && -e "$profile_tmp" ]] && rm -f -- "$profile_tmp"
}
trap cleanup EXIT
chmod 600 "$profile_tmp"

cat >"$profile_tmp" <<PROFILE
[connection]
id=${CONNECTION_NAME}
uuid=$(cat /proc/sys/kernel/random/uuid)
type=wifi
interface-name=${iface}
autoconnect=false

[802-11-wireless]
mode=ap
ssid=${SSID}

[802-11-wireless-security]
key-mgmt=wpa-psk
proto=rsn;
pairwise=ccmp;
group=ccmp;
psk=${password}

[ipv4]
method=shared

[ipv6]
method=ignore
PROFILE

mv -- "$profile_tmp" "$PROFILE_PATH"
profile_tmp=""

if ! nmcli connection load "$PROFILE_PATH"; then
  rm -f -- "$PROFILE_PATH"
  fail "NetworkManager could not load the new hotspot profile."
fi

if ! nmcli connection up "$CONNECTION_NAME" ifname "$iface"; then
  nmcli connection delete "$CONNECTION_NAME" >/dev/null 2>&1 || true
  rm -f -- "$PROFILE_PATH"
  fail "NetworkManager could not activate the hotspot; the new profile was removed."
fi

address=""
for _ in {1..10}; do
  address="$(nmcli -g IP4.ADDRESS device show "$iface" 2>/dev/null | head -n 1 || true)"
  [[ -n "$address" ]] && break
  sleep 1
done
subnet=""
if [[ -n "$address" ]]; then
  subnet="$(python3 -c 'import ipaddress, sys; print(ipaddress.ip_interface(sys.argv[1]).network)' "$address" 2>/dev/null || true)"
fi

printf '\nHotspot started.\n'
printf 'Wi-Fi name: %s\n' "$SSID"
printf 'Security: WPA2-Personal (AES/CCMP)\n'
printf 'Password: %s\n' "$password"
printf 'Connection profile: %s (autoconnect is disabled)\n' "$CONNECTION_NAME"

if [[ -n "$subnet" ]]; then
  printf 'Hotspot subnet: %s\n' "$subnet"
  if command -v ufw >/dev/null; then
    if ufw allow in on "$iface" from "$subnet" to any port 5000 proto tcp &&
       ufw allow in on "$iface" from "$subnet" to any port 5353 proto udp; then
      printf 'UFW rules added for ports 5000/TCP and 5353/UDP on %s, limited to %s.\n' "$iface" "$subnet"
      printf 'The script did not enable UFW or change other firewall rules.\n'
    else
      printf 'Could not add UFW rules. If UFW is in use, add only these scoped rules:\n' >&2
      printf '  sudo ufw allow in on %s from %s to any port 5000 proto tcp\n' "$iface" "$subnet" >&2
      printf '  sudo ufw allow in on %s from %s to any port 5353 proto udp\n' "$iface" "$subnet" >&2
    fi
  else
    printf 'UFW is not installed. If you use UFW, allow only this hotspot subnet:\n'
    printf '  sudo ufw allow in on %s from %s to any port 5000 proto tcp\n' "$iface" "$subnet"
    printf '  sudo ufw allow in on %s from %s to any port 5353 proto udp\n' "$iface" "$subnet"
  fi
else
  printf 'Could not determine the hotspot IPv4 subnet. Check it with: nmcli -g IP4.ADDRESS device show %s\n' "$iface"
  printf 'Do not add broad firewall rules; allow only the subnet assigned to this hotspot.\n'
fi

printf 'On Android and Windows, join the "%s" Wi-Fi network using the password above, then open RoverOS.\n' "$SSID"
printf 'To stop the hotspot later: sudo nmcli connection down %s\n' "$CONNECTION_NAME"
