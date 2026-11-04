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
- A stable wired or Wi-Fi connection and a DHCP reservation for the MiniPC.
- Node.js **22.12.0 or later**. This matches the repository's `engines` setting
  and the Capacitor Android toolchain requirement of Node 22 or later.
- PostgreSQL **16**.
- An HTTPS clone URL for this repository. For a private repository, configure
  an approved deploy key; never place a GitHub token in a clone URL.

## 1. Prepare Ubuntu and the LAN

Install and update Ubuntu Server. Connect the MiniPC, Android phone, and Windows
PC to the same trusted LAN. Create a DHCP reservation in your router so the
MiniPC keeps the same address. This guide uses `192.168.1.40`; replace it with
your MiniPC's real address.

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git
```

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

## 9. Restrict access to your local network

Replace `192.168.1.0/24` with your LAN subnet. If you administer this computer
over SSH, allow SSH before enabling the firewall:

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow from 192.168.1.0/24 to any port 5000 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Do **not** open PostgreSQL port `5432` to the LAN and do not configure public
router port forwarding for RoverOS. The current rover-control API does not
require user authentication, so port `5000` must remain limited to a trusted
network. Do not expose it directly to the internet. Use a properly secured VPN
if remote access is needed.

## 10. Connect Windows and Android clients

Use this address format on both clients:

```text
http://192.168.1.40:5000
```

Use the reserved MiniPC IP (or a DNS name that resolves to it), not `localhost`
and not the phone or Windows PC's own IP.

### Android

1. Join the same Wi-Fi/LAN as the MiniPC.
2. Install the signed APK from the GitHub Release produced by the Android app
   build workflow. For a temporary debug build, download the APK artifact from
   the corresponding Actions run.
3. On first launch, enter the MiniPC address, tap **Test Connection**, then
   **Save and Connect**.
4. To change the saved address later, open **Config** in the app.

The Android app keeps its web interface on the phone and sends its API and
WebSocket traffic to the MiniPC on port `5000`. It does not connect directly to
PostgreSQL.

### Windows

1. Join the same LAN as the MiniPC.
2. Run the Windows app build workflow in GitHub Actions and download the
   `roveros-windows-installer` artifact.
3. Install the `.exe`, launch RoverOS, and enter the same MiniPC address when
   prompted.

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
  non-guest LAN, confirm the reserved IP, inspect `sudo ufw status`, and check
  that `roveros` is active.
- **Android reports a network error while the browser works:** update to the
  Android build that includes MiniPC address setup, then check the saved URL
  under Config.

## Version references

- [NodeSource Node.js distributions](https://github.com/nodesource/distributions)
- [PostgreSQL packages for Ubuntu](https://www.postgresql.org/download/linux/ubuntu/)
- [Capacitor configuration](https://capacitorjs.com/docs/config) — Android's
  bundled WebView origin defaults to `https://localhost`; the RoverOS server
  allows that exact origin for the Android client.
