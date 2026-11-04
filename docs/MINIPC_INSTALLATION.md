# RoverOS installation on the ACEPC AK1

## Supported first target

- **MiniPC:** ACEPC AK1, **8 GB RAM configuration**, as specified by the owner.
- **OS:** Ubuntu Server **24.04 LTS amd64**, latest 24.04 point release, minimal/headless; **not Ubuntu Core**.
- **Runtime:** Node.js **22 LTS, 22.12 or newer within that major**.
- **Database:** PostgreSQL **16**, listening locally on the MiniPC.
- **Clients:** the updated RoverOS Android APK and Windows app on the same trusted network.
- **Networking:** NetworkManager and Avahi; an AP-capable Wi-Fi adapter for the setup hotspot.

The AK1 model has hardware variants. Do not assume a particular CPU, SSD size, or
Wi-Fi chipset from the model name alone. The 8 GB RAM configuration meets our
planned RAM target. Prefer an SSD with at least 64 GB, keep several GB free for
updates/backups, and test the actual Wi-Fi radio. No AK1 physical test has been
performed in the development workspace.

The MiniPC hosts the web UI, API, WebSocket service, and database. Windows and
Android are **clients**, not separate database servers:

```text
Android / Windows
    └── discover RoverOS-Server
         ├── before setup: public status on HTTP 5000
         │                paired, certificate-pinned HTTPS setup on 5443
         └── after setup: RoverOS web/API/WebSocket on 5000
                              └── PostgreSQL 16 on MiniPC loopback only
```

This installs the software represented by this repository. It does **not** flash
Arduino firmware or install unspecified motor-control, camera-streaming, or
FlyBaby services. Some existing hardware APIs still return demo/status data.
Do not treat web/API readiness as proof that motors or sensors are operational.

## 1. Prepare Ubuntu once

Install Ubuntu Server 24.04 LTS amd64 without a desktop. Create an owner account,
enable OpenSSH Server, and prefer SSH keys. Use Ethernet for the initial bench
setup if available. Keep local keyboard/display access until networking is tested.

A completely bare Ubuntu install cannot advertise RoverOS or accept Wi-Fi
credentials. The small bootstrap service below must be installed once, either
on the bench or into a prepared image before shipping the MiniPC.

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git openssl iw \
  network-manager avahi-daemon avahi-utils
```

### NetworkManager ownership

Ubuntu Server commonly uses Netplan with `systemd-networkd`. The bootstrap does
not silently replace the active network manager. Configure NetworkManager at
the local MiniPC console **before relying on Wi-Fi SSH**.

Review the existing configuration with `sudo netplan get`. Preserve any custom
static addresses or Wi-Fi settings. At the local console, an administrator can
select NetworkManager as the renderer and test it before accepting:

```bash
sudo systemctl enable --now NetworkManager
sudo netplan set network.renderer=NetworkManager
sudo netplan try
nmcli device status
```

`netplan try` requires confirmation and attempts rollback if confirmation is
not received. Do not do this as an unattended Wi-Fi SSH change. Confirm that
the intended Wi-Fi interface is managed by NetworkManager.

Collect the actual AK1 inventory:

```bash
lscpu
free -h
lsblk
lspci -nn
lsusb
iw list
nmcli device status
```

`iw list` must show `AP` under supported interface modes to use the setup
hotspot. AP/client concurrency is not assumed. With one radio, the setup AP
may disappear when the MiniPC joins the selected home Wi-Fi.

## 2. Publish the prebuilt server release from GitHub

The new workflow is `.github/workflows/roveros-server-release.yml`. It builds
on `ubuntu-24.04` using Node 22, checks the code/tests, applies the committed
schema migrations twice against PostgreSQL 16, and smoke-tests the extracted
server outside the checkout without `node_modules`.

Branch/PR/manual runs produce a downloadable test artifact. **Installable,
signed-provenance releases require a server version tag**:

```bash
git tag roveros-server-v1.0.1
git push origin roveros-server-v1.0.1
```

Use a new version for subsequent server releases. Wait for **RoverOS MiniPC
server release** to finish. It attaches three files to that GitHub Release:

1. `RoverOS-server-linux-x64.tar.gz`
2. `RoverOS-server-linux-x64.tar.gz.sha256`
3. `RoverOS-server-linux-x64.intoto.jsonl` — cryptographically signed GitHub build provenance

The tarball contains the compiled web/server/migration bundles, SQL migrations,
Avahi record, and compatibility manifest. It contains **no npm dependencies,
development toolchain, database credentials, or device-specific secrets**.
The MiniPC does not run `npm ci` or compile the app.

The installer selects the newest stable `roveros-server-vMAJOR.MINOR.PATCH`
release that contains all three assets. It ignores Android/Windows releases,
rejects off-repository asset URLs, and rejects incompatible/older server
manifests. It verifies the checksum and GitHub provenance for this repository,
this exact workflow, and the selected tag before extracting executable code.
An unsigned branch artifact is deliberately not installable through onboarding.

The default source is the public `kadetkrysty/Rover-Pilot` repository. A private
release repository requires a separate approved access mechanism; do not put
GitHub tokens in URLs, the client UI, or source files.

## 3. Install the bootstrap on the MiniPC

Make sure the versioned server release above exists first. From the owner’s
SSH session or MiniPC console:

```bash
git clone https://github.com/kadetkrysty/Rover-Pilot.git ~/Rover-Pilot
cd ~/Rover-Pilot
sudo bash scripts/minipc/install-bootstrap.sh kadetkrysty/Rover-Pilot
```

This does not build RoverOS. It:

- Checks Ubuntu 24.04 amd64, NetworkManager ownership, and Wi-Fi AP support.
- Installs Node 22 if required, plus the small networking/bootstrap prerequisites.
- Names the device `RoverOS-Server`.
- Generates a per-device self-signed HTTPS certificate and random pairing code.
- Creates a WPA2 setup profile with a random password and SSID `RoverOS-Server`.
- Installs the bootstrap service and HTTP/HTTPS DNS-SD records.
- Starts the AP if Wi-Fi is not already connected. It leaves an active Wi-Fi
  connection alone, so clients can use that existing LAN instead.

The terminal displays:

- The setup Wi-Fi password.
- The 32-character pairing code.
- The 64-character SHA-256 certificate fingerprint.

Save the pairing information securely or put it on a per-device owner label.
Do not post it in support logs. Re-running bootstrap on an unfinished device
preserves its certificate, pairing code, and AP password. It refuses to reset
an already-completed installation.

If the adapter cannot provide AP mode, prepare its existing Wi-Fi/LAN locally
and use the explicit LAN-only mode instead:

```bash
sudo bash scripts/minipc/install-bootstrap.sh kadetkrysty/Rover-Pilot --lan-only
```

This skips hotspot creation; clients must already share a reachable LAN with
the MiniPC. The Wi-Fi onboarding operation still requires a usable Wi-Fi adapter.

## 4. First connection from Android or Windows

Install client builds containing these onboarding changes.

1. Join **RoverOS-Server** in the phone/PC Wi-Fi settings using the printed AP
   password, or join the MiniPC’s existing LAN.
2. Open RoverOS. Android uses DNS-SD; Windows resolves `RoverOS-Server.local`.
   Neither app asks for the MiniPC IP.
3. The app checks `/api/provisioning/status`. A ready device opens normally;
   an unfinished device shows first-time setup.
4. Enter the certificate fingerprint and pairing code from the owner terminal.
   A mismatching certificate is rejected; the app does not just ignore HTTPS errors.
5. Scan or type the home Wi-Fi SSID and password. If scanning is unavailable
   while the radio is in AP mode, type the SSID. Hidden networks are supported.
6. Select **Connect and install RoverOS**.
7. If the AP disappears, join the selected home Wi-Fi through the client OS.
   Android rediscovery updates the changed MiniPC address; Windows retries
   the stable `.local` hostname. **Search again** remains available for recovery.

The current network-authentication scope is **WPA2-Personal** with an 8–63-byte
passphrase or 64 hexadecimal PSK. Enterprise Wi-Fi and pure WPA3-SAE are not
implemented; use a compatible network rather than weakening its security.
Bluetooth is not the RoverOS IP transport.

Passwords and pairing codes are not written to client storage. Wi-Fi submissions
use native certificate-pinned HTTPS on 5443. The MiniPC writes the network
credential only to a root-owned `0600` NetworkManager profile; it never inserts
it into a shell command. Public HTTP status contains no credentials.

## 5. Installation, health checks, and normal reboot

After Wi-Fi connects, the MiniPC downloads the verified prebuilt release,
installs PostgreSQL 16, creates the non-superuser database role and database,
applies the versioned SQL migrations, and installs the non-root RoverOS service.

The database URL is generated on-device and saved in `/etc/roveros.env`,
readable only by root/the service group. PostgreSQL remains local-only; the
installer does not expose port 5432.

A separate handoff job stops the temporary port-5000 setup listener, starts
RoverOS, and verifies the web assets, system identity, API/database health,
database schema, and Avahi service. **Only then** does it save `ready` and enable
normal startup. The pairing code is revoked and setup HTTPS stops listening.
The bootstrap remains only as a boot dispatcher; it does not reopen setup on
a completed device.

Inspect from SSH:

```bash
sudo systemctl status roveros --no-pager
sudo systemctl status postgresql --no-pager
curl -f http://127.0.0.1:5000/api/system/info
curl -f http://127.0.0.1:5000/api/system/health
curl -f http://127.0.0.1:5000/api/provisioning/status
avahi-browse -rt _http._tcp
sudo journalctl -u roveros -n 100 --no-pager
```

## 6. Recovery and backups

- **Wrong Wi-Fi password:** setup reports failure and attempts to restore the
  setup AP. Rejoin it and enter the credentials again.
- **Network switched:** join the same home Wi-Fi on the client, then use
  **Search again**. Guest networks/VLAN isolation can prevent discovery.
- **Download, signature, or package failure:** no unverified code is executed.
  Existing Wi-Fi is retained when it connected successfully. Retry onboarding
  or investigate through owner SSH.
- **Interrupted installation/reboot:** the public state becomes a recoverable
  interrupted-setup failure. Retry resumes through idempotent package/migration
  operations; installation is not falsely reported ready.
- **Startup health failure:** handoff stops the failed application, restores
  the setup service/advertisement, and reports failure.
- **Legacy database:** an installation previously created with `db:push` needs
  a reviewed migration baseline. The installer refuses to apply the new baseline
  blindly over that data. It does not delete or recreate it.

Useful recovery commands:

```bash
sudo systemctl status roveros-provisioner --no-pager
sudo journalctl -u roveros-provisioner -u roveros-handoff -n 100 --no-pager
nmcli device status
sudo nmcli connection up id RoverOS-Hotspot
```

Before any future server update, back up the database and copy the backup off
the MiniPC:

```bash
sudo -u postgres pg_dump -Fc roveros > "$HOME/roveros-$(date +%F).dump"
```

The initial installer backs up a recognized existing database before migrations
and will not replace a running server. It is **not an unattended updater or a
factory-reset feature**. Preserve `/etc/roveros.env` privately when restoring.

## 7. Network security and hardware qualification

Do not publicly forward RoverOS ports. The existing normal control API is for a
trusted LAN, not an unauthenticated public service. Keep SSH owner-only and
PostgreSQL local. The scripts do not disable antivirus/firewalls or guarantee
that third-party security software will permit traffic.

If UFW is already active, setup adds inbound app TCP 5000, setup TCP 5443, and
mDNS UDP 5353 rules scoped to actual private IPv4 subnets/interfaces. It does not
enable UFW or open PostgreSQL. A dedicated temporary DHCP/DNS profile is allowed
only on the active setup AP interface so clients can obtain addresses. The setup
HTTPS and hotspot DHCP/DNS rules for the active interface are removed
after success. Review your firewall policy separately before enabling it, and
allow owner SSH before doing so.

Before using this with the rover, test on the actual AK1: AP availability, Wi-Fi
handoff, wrong-password recovery, interrupted power, reboot, backup/restore,
and sustained CPU/RAM/disk use. The development workspace cannot validate its
radio, thermal limits, firmware, or attached rover hardware.

## References

- [Ubuntu Server installation](https://documentation.ubuntu.com/server/how-to/installation/)
- [Ubuntu release support](https://ubuntu.com/about/release-cycle)
- [GitHub artifact attestation verification](https://cli.github.com/manual/gh_attestation_verify)
- [Official GitHub CLI Linux installation](https://github.com/cli/cli/blob/trunk/docs/install_linux.md)
- [NodeSource Node.js packages](https://github.com/nodesource/distributions)
- [PostgreSQL Ubuntu packages](https://www.postgresql.org/download/linux/ubuntu/)
