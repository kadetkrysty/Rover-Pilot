# RoverOS MiniPC installation

This guide installs the RoverOS web app, API, WebSocket service, and PostgreSQL
database on one MiniPC. Windows and Android devices connect to that MiniPC as
clients over the same trusted local network. They do not install or connect
directly to PostgreSQL.

## Architecture

```text
Android RoverOS app ─┐
                     ├── local network ──> MiniPC:5000
Windows RoverOS app ─┘                     ├── RoverOS web app + API + WebSocket
                                           └── PostgreSQL 16 (local to MiniPC)
```

The steps below cover the Node.js service and database in this repository. They
do **not** install Arduino firmware, motor-control daemons, camera streaming, or
the separate FlyBaby service. The optional FlyBaby client expects its separate
service on the configured MiniPC host at port `8080`. Some hardware-related API routes can show demo or
status data until those hardware integrations are separately installed and
connected.

## Requirements

- A 64-bit MiniPC running Ubuntu Server 24.04 LTS (recommended). Ubuntu 22.04
  LTS is also supported when PostgreSQL 16 is installed from the PostgreSQL
  package repository.
- A stable wired or Wi-Fi connection. RoverOS clients discover the MiniPC by
  its network name; a DHCP reservation is still useful for administration.
- Node.js **22.12.0 or later**. This matches the repository's `engines` setting
  and the Capacitor Android toolchain requirement of Node 22 or later.
- PostgreSQL **16**.
- An HTTPS clone URL for this repository. For a private repository, configure
  an approved deploy key; never place a GitHub token in a clone URL.

## 1. Prepare Ubuntu and the LAN

Install and update Ubuntu Server. Connect the MiniPC, Android phone, and Windows
PC to the same trusted LAN. Set the MiniPC name to `RoverOS-Server`; clients
will find it automatically without entering its IP.

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git avahi-daemon avahi-utils
sudo hostnamectl set-hostname RoverOS-Server
sudo systemctl enable --now avahi-daemon
```

The MiniPC and clients must be on the same local network segment. If using a
guest network, client isolation, or separate VLANs, multicast discovery may be
blocked.

### Optional: use the MiniPC as a Wi-Fi access point

RoverOS advertises and discovers the server; it does not take control of the
MiniPC's Wi-Fi adapter. For a direct connection without a router, the MiniPC
must have an access-point-capable Wi-Fi adapter and an OS-managed hotspot.
NetworkManager can create one when it already manages the Wi-Fi interface:

```bash
nmcli device status
sudo nmcli device wifi hotspot ifname wlp2s0 con-name RoverOS-Server ssid RoverOS-Server
sudo nmcli --show-secrets -g 802-11-wireless-security.psk connection show RoverOS-Server
```

Replace `wlp2s0` with the MiniPC's Wi-Fi interface. If no password is supplied,
NetworkManager generates a WPA password and saves it in its protected
connection profile; the second command displays it so you can join the hotspot
from Windows and Android. Keep the password private. Use an adapter/driver that
supports WPA2 or better. Run this at the MiniPC's local
console: activating the hotspot can disconnect its existing Wi-Fi or SSH
connection. Do not install or switch network managers remotely; Ubuntu Server
installations using `systemd-networkd` need deliberate OS-level network
configuration first. After both clients have joined the hotspot, RoverOS finds
the MiniPC automatically.

Bluetooth is not used for app-to-server traffic. RoverOS uses HTTP and
WebSockets over IP; Bluetooth would require a separate Bluetooth-network
adapter and is not a drop-in replacement for Wi-Fi.

## 2. Install Node.js 22

Use NodeSource's Node 22 setup, then check the installed version. The project
requires at least `v22.12.0`.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
npm --version
```

If `node --version` is older than `v22.12.0`, stop and install a supported
version before continuing.

## 3. Install PostgreSQL 16

Ubuntu 24.04 includes PostgreSQL 16. To install and pin that major version on
Ubuntu 22.04 as well, use the PostgreSQL project's APT repository:

```bash
sudo apt install -y postgresql-common ca-certificates
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16
sudo systemctl enable --now postgresql
psql --version
```

Keep PostgreSQL bound to the MiniPC itself. Do not open port `5432` to the LAN.

## 4. Create the application database

Generate a password and keep it in a password manager. The hexadecimal output
can be copied into the database URL later without URL-encoding.

```bash
openssl rand -hex 32
sudo -u postgres psql
```

At the PostgreSQL prompt, create a non-superuser account and database. When
`\password roveros` prompts, enter the generated password twice.

```sql
CREATE ROLE roveros LOGIN;
CREATE DATABASE roveros OWNER roveros;
\password roveros
\q
```

## 5. Download the RoverOS application

Create a restricted service account, clone the repository, normalize npm lock
file URLs for a public GitHub runner/server, and install dependencies:

```bash
sudo useradd --system --create-home --user-group \
  --home-dir /opt/roveros --shell /usr/sbin/nologin roveros
sudo -u roveros git clone https://github.com/OWNER/REPOSITORY.git /opt/roveros/app
cd /opt/roveros/app
sudo -u roveros node scripts/normalize-github-npm-lock.mjs
sudo -u roveros npm ci
```

Replace `OWNER/REPOSITORY` with the actual GitHub repository path. The lockfile
normalizer removes Replit-only package download URLs so `npm ci` can resolve
packages through the public npm registry.

## 6. Configure the database URL privately

Create a root-owned file that only root and the application service group can
read:

```bash
sudo install -o root -g roveros -m 640 /dev/null /etc/roveros.env
sudo nano /etc/roveros.env
```

Enter the following, replacing the placeholder with the generated password:

```ini
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://roveros:PASTE_YOUR_PASSWORD_HERE@127.0.0.1:5432/roveros
```

Save the file and check its permissions:

```bash
sudo ls -l /etc/roveros.env
```

Do not commit `/etc/roveros.env`, paste it into a support request, or put the
database password in a command-line argument.

## 7. Build RoverOS and initialize the schema

Build the production server and browser assets. Then load the protected
environment file for the initial schema setup:

```bash
cd /opt/roveros/app
sudo -u roveros npm run build
sudo -u roveros bash -c 'set -a; . /etc/roveros.env; set +a; cd /opt/roveros/app; npm run db:push'
sudo -u roveros npm prune --omit=dev
```

Run `npm run db:push` against a new, empty RoverOS database for the first
installation. For later schema updates, back up the database first and review
any schema prompts before confirming changes.

## 8. Start RoverOS with systemd

Create `/etc/systemd/system/roveros.service`:

```ini
[Unit]
Description=RoverOS web and API service
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=roveros
Group=roveros
WorkingDirectory=/opt/roveros/app
EnvironmentFile=/etc/roveros.env
ExecStart=/usr/bin/node /opt/roveros/app/dist/index.cjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable the service and verify the local API responds:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now roveros
sudo systemctl status roveros --no-pager
curl -i http://127.0.0.1:5000/api/system/info
sudo journalctl -u roveros -n 100 --no-pager
```

The MiniPC serves the site, API, and WebSocket on port `5000`.

Install the repository's Avahi service record so Android can discover RoverOS:

```bash
sudo install -m 0644 /opt/roveros/app/deploy/avahi/roveros.service \
  /etc/avahi/services/roveros.service
sudo systemctl restart avahi-daemon
sudo avahi-browse -rt _http._tcp
```

The output should include the `RoverOS-Server` service, port `5000`, and the
`roveros=1` service marker.

## 9. Restrict access to your local network

Replace `192.168.1.0/24` with your LAN subnet. If you administer this computer
over SSH, allow SSH before enabling the firewall:

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow from 192.168.1.0/24 to any port 5000 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 5353 proto udp
sudo ufw enable
sudo ufw status verbose
```

If using NetworkManager's default hotspot subnet (`10.42.0.0/24`), allow both
ports from that subnet instead of the router LAN subnet:

```bash
sudo ufw allow from 10.42.0.0/24 to any port 5000 proto tcp
sudo ufw allow from 10.42.0.0/24 to any port 5353 proto udp
```

Do **not** open PostgreSQL port `5432` to the LAN and do not configure public
router port forwarding for RoverOS. The current rover-control API does not
require user authentication, so port `5000` must remain limited to a trusted
network. Do not expose it directly to the internet. Use a properly secured VPN
if remote access is needed.

## 10. Connect Windows and Android clients

Both clients search for the MiniPC named `RoverOS-Server`; no IP address needs
to be typed. Discovery uses mDNS on the local network and the RoverOS HTTP
service on port `5000`.

### Android

1. Join the same Wi-Fi/LAN as the MiniPC.
2. Install the signed APK from the GitHub Release produced by the Android app
   build workflow. For a temporary debug build, download the APK artifact from
   the corresponding Actions run.
3. Open the app. It searches the local network for `RoverOS-Server` and connects
   automatically. If discovery times out, confirm the network and tap **Search
   Again**.

The Android app keeps its web interface on the phone and sends its API and
WebSocket traffic to the MiniPC on port `5000`. It does not connect directly to
PostgreSQL.

### Windows

1. Join the same LAN as the MiniPC.
2. Run the Windows app build workflow in GitHub Actions and download the
   `roveros-windows-installer` artifact.
3. Install the `.exe` and launch RoverOS. It searches for
   `RoverOS-Server.local` and connects automatically. If it is not found, check
   that Windows is on the same private network and select **Search again**.

## 11. Back up and update the server

Before updating, make a database backup, stop the service, update the source,
rebuild, and restart:

```bash
sudo -u postgres pg_dump -Fc roveros > "$HOME/roveros-$(date +%F).dump"
sudo systemctl stop roveros
cd /opt/roveros/app
sudo -u roveros git pull --ff-only
sudo -u roveros node scripts/normalize-github-npm-lock.mjs
sudo -u roveros npm ci
sudo -u roveros npm run build
sudo -u roveros bash -c 'set -a; . /etc/roveros.env; set +a; cd /opt/roveros/app; npm run db:push'
sudo -u roveros npm prune --omit=dev
sudo systemctl start roveros
sudo systemctl status roveros --no-pager
```

Store backups somewhere separate from the MiniPC as well.

## Troubleshooting

- **Service fails to start:** run `sudo journalctl -u roveros -n 100 --no-pager`.
- **Database connection fails:** check that PostgreSQL is active and the URL in
  `/etc/roveros.env` has the correct role, password, database, and local address.
- **The MiniPC itself cannot reach the API:** run
  `curl -i http://127.0.0.1:5000/api/system/info`.
- **The other devices cannot reach the MiniPC:** verify both are on the same
  non-guest LAN, inspect `sudo ufw status`, confirm Avahi is active, and check
  `sudo avahi-browse -rt _http._tcp`.
- **Discovery works on the router but not the MiniPC hotspot:** confirm the
  clients joined the `RoverOS-Server` SSID and that the hotspot subnet is
  allowed through UFW.
- **Windows cannot find the MiniPC:** verify the Windows network is private and
  that local multicast name resolution is not blocked by network policy.
- **Android reports a discovery error:** update to the latest APK and ensure
  the MiniPC's Avahi service record is installed and announcing port `5000`.

## Version references

- [NodeSource Node.js distributions](https://github.com/nodesource/distributions)
- [PostgreSQL packages for Ubuntu](https://www.postgresql.org/download/linux/ubuntu/)
- [Capacitor configuration](https://capacitorjs.com/docs/config) — Android's
  bundled WebView origin defaults to `https://localhost`; the RoverOS server
  allows that exact origin for the Android client.
