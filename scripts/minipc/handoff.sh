#!/usr/bin/env bash
set -euo pipefail
set +x
readonly SERVICE_DIR="/usr/local/lib/roveros-provisioner"
readonly STATE_DIR="/var/lib/roveros-provisioner"
write_state() {
  node - "$STATE_DIR" "$1" "$2" "$3" "$4" <<'NODE'
const fs = require("node:fs"), path = require("node:path");
const [dir, state, stage, progress, message] = process.argv.slice(2);
fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
const file = path.join(dir, "state.json"), tmp = file + ".handoff.tmp";
fs.writeFileSync(tmp, JSON.stringify({ state, stage, progress: Number(progress), message, updatedAt: new Date().toISOString() }) + "\n", { mode: 0o644 });
fs.chmodSync(tmp, 0o644); fs.renameSync(tmp, file);
NODE
}
recover() {
  trap - ERR
  systemctl stop roveros.service || true
  systemctl disable roveros.service || true
  rm -f "$STATE_DIR/complete"
  write_state failed recovery 0 "RoverOS did not pass startup checks. Retry setup or use owner SSH."
  install -m 0644 "$SERVICE_DIR/roveros-provisioning.service" /etc/avahi/services/roveros.service
  systemctl restart avahi-daemon.service || true
  systemctl restart roveros-provisioner.service
  exit 1
}
trap recover ERR
sleep 3
write_state installing starting 90 "Starting and checking the RoverOS service."
systemctl stop roveros-provisioner.service
install -m 0644 /opt/roveros/current/deploy/avahi/roveros.service /etc/avahi/services/roveros.service
systemctl restart avahi-daemon.service
systemctl start roveros.service
healthy=false
for _ in {1..30}; do
  if curl --fail --silent --max-time 3 http://127.0.0.1:5000/api/system/info |
    node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const j=JSON.parse(s);process.exit(/^roveros/i.test(j.rover_name)?0:1)}catch{process.exit(1)}})' &&
    curl --fail --silent --max-time 3 http://127.0.0.1:5000/ -o /dev/null &&
    curl --fail --silent --max-time 3 http://127.0.0.1:5000/api/system/health -o /dev/null &&
    runuser -u postgres -- psql roveros -tAc "SELECT to_regclass('public.rover_config') IS NOT NULL" | grep -qx t; then
    healthy=true
    break
  fi
  sleep 2
done
[[ "$healthy" == true ]]
systemctl is-active --quiet avahi-daemon.service
"$SERVICE_DIR/configure-firewall.sh" --runtime
write_state ready complete 100 "RoverOS setup is complete."
touch "$STATE_DIR/complete"
chmod 0644 "$STATE_DIR/complete"
# The bootstrap remains a harmless boot dispatcher, but no longer opens setup ports.
systemctl enable roveros.service
rm -f /etc/roveros-provisioner/pairing-code
