#!/usr/bin/env bash
# Keep firewall changes local to actual private LAN interfaces. Never enable/disable UFW.
set -euo pipefail
mode="${1:---setup}"
[[ "$mode" == --setup || "$mode" == --runtime ]] || exit 1
command -v ufw >/dev/null || exit 0
ufw status | grep -q 'Status: active' || exit 0
while read -r subnet device_keyword iface rest; do
  [[ "$device_keyword" == dev ]] || continue
  [[ "$iface" =~ ^[A-Za-z0-9_.:-]{1,15}$ ]] || continue
  [[ "$subnet" =~ ^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)[0-9./]+$ ]] || continue
  ufw allow in on "$iface" from "$subnet" to any port 5000 proto tcp >/dev/null
  # Port 5443 transitions from first-run setup HTTPS to paired normal-operation HTTPS.
  ufw allow in on "$iface" from "$subnet" to any port 5443 proto tcp >/dev/null
  ufw allow in on "$iface" from "$subnet" to any port 5353 proto udp >/dev/null
  if [[ "$mode" == --setup ]]; then
    if [[ "$(nmcli -g GENERAL.CONNECTION device show "$iface" 2>/dev/null || true)" == RoverOS-Hotspot ]]; then
      # DHCP starts before the client has a private address. Scope this rule to
      # the actual AP interface and a dedicated profile, never the general LAN.
      ufw allow in on "$iface" to any app RoverOSSetupHotspot >/dev/null
    fi
  else
    ufw --force delete allow in on "$iface" to any app RoverOSSetupHotspot >/dev/null || true
  fi
done < <(ip -o -4 route show scope link)
