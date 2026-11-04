const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

test("UFW rules stay on private interfaces and permit DHCP only on the setup AP", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roveros-firewall-test-"));
  try {
    const log = path.join(dir, "calls");
    const mocks = {
      ufw: '#!/bin/sh\nif [ "$1" = status ]; then echo "Status: active"; else printf "%s\\n" "$*" >> "$TEST_LOG"; fi\n',
      ip: '#!/bin/sh\nprintf "%s\\n" "10.42.0.0/24 dev wlan0 proto kernel scope link" "192.168.1.0/24 dev eth0 proto kernel scope link" "203.0.113.0/24 dev public0 proto kernel scope link"\n',
      nmcli: '#!/bin/sh\ncase "$*" in *wlan0*) echo RoverOS-Hotspot;; *) echo Ethernet;; esac\n',
    };
    for (const [name, contents] of Object.entries(mocks)) {
      fs.writeFileSync(path.join(dir, name), contents, { mode: 0o755 });
    }
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_LOG: log };
    const helper = path.join(__dirname, "configure-firewall.sh");
    execFileSync("bash", [helper, "--setup"], { env });
    const setup = fs.readFileSync(log, "utf8");
    assert.match(setup, /allow in on wlan0 to any app RoverOSSetupHotspot/);
    assert.doesNotMatch(setup, /on eth0 to any app/);
    assert.doesNotMatch(setup, /public0|203\.0\.113|5432|ufw disable/);
    assert.match(setup, /from 192\.168\.1\.0\/24 to any port 5000/);
    fs.writeFileSync(log, "");
    execFileSync("bash", [helper, "--runtime"], { env });
    const runtime = fs.readFileSync(log, "utf8");
    assert.match(runtime, /--force delete allow in on wlan0 to any app RoverOSSetupHotspot/);
    assert.match(runtime, /--force delete .* port 5443/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
