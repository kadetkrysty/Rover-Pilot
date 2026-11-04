#!/usr/bin/env bash
set -euo pipefail
[[ "$#" -eq 1 && "$1" == "--socket" && "$EUID" -eq 0 ]] || exit 2
IFS= read -r -n 6 -t 3 request
[[ "$request" == "START" ]] || exit 2
/usr/bin/systemctl start --no-block roveros-update.service
printf 'STARTED\n'
