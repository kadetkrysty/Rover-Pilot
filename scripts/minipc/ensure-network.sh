#!/usr/bin/env bash
set -euo pipefail
[[ ! -f /var/lib/roveros-provisioner/complete ]] || exit 0
if [[ "${ROVEROS_SETUP_AP:-1}" == 1 ]] &&
  ! nmcli -t -f DEVICE,TYPE,STATE device status | grep -q ':wifi:connected'; then
  nmcli connection up id RoverOS-Hotspot
fi
/usr/local/lib/roveros-provisioner/configure-firewall.sh --setup
