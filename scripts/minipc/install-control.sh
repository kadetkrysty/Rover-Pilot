#!/usr/bin/env bash
# Invoked by the already privileged, verified-release installer/updater, never by the web app.
set -euo pipefail
root="${1:?Release directory required}"
[[ -f "$root/deploy/systemd/roveros-control.service" ]]
install -d -m 0755 /etc/roveros
if [[ ! -f /etc/roveros/hardware.env ]]; then
  (umask 077; cat >/etc/roveros/hardware.env <<'ENV'
# Choose a stable /dev/serial/by-id/... Arduino path. Never auto-select a motor device.
ROVEROS_ARDUINO_DEVICE=
# Set to 1 ONLY after the documented, wheels-raised hardware commissioning checks.
ROVEROS_DRIVE_COMMISSIONED=0
ENV
  )
fi
# The old publicly accessible controller must not own USB or port 5000.
if systemctl cat rover_controller.service >/dev/null 2>&1; then
  systemctl disable --now rover_controller.service
fi
install -m 0644 "$root/deploy/systemd/roveros-control.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable roveros-control.service
systemctl restart roveros-control.service
