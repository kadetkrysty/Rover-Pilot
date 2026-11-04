import type { ReactNode } from "react";

interface CodeBlockProps {
  title: string;
  children: string;
}

function CodeBlock({ title, children }: CodeBlockProps) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-xs font-mono font-semibold text-primary">
        {title}
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={title}
        className="overflow-x-auto rounded border border-border bg-black/60 p-4 text-xs leading-relaxed text-green-300"
      >
        <code>{children}</code>
      </pre>
    </figure>
  );
}

function GuideSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card/40 p-4 sm:p-6">
      <h4 className="flex items-baseline gap-3 font-display text-lg text-primary">
        <span className="font-mono text-sm text-muted-foreground">{number}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

export default function MiniPcInstallGuide() {
  return (
    <article className="mx-auto max-w-5xl space-y-6 p-4 pb-12 sm:p-6">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">
          RoverOS deployment guide
        </p>
        <h3 className="text-2xl font-display text-foreground sm:text-3xl">
          Install RoverOS on the MiniPC
        </h3>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The MiniPC is the always-on host for the RoverOS web app, API, WebSocket,
          and PostgreSQL database. Android and Windows connect to it as clients
          over your local network. Client devices do not need a database or
          database password.
        </p>
      </header>

      <aside
        className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
        aria-labelledby="host-scope-title"
      >
        <h4 id="host-scope-title" className="font-display text-amber-300">
          Important: what this installation includes
        </h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          These steps install the repository’s Node.js web/API service and database.
          They do not install or configure Arduino firmware, motor-control daemons,
          camera streams, or the separate FlyBaby service. The optional FlyBaby
          client expects that separate service on the configured MiniPC host at
          port 8080. Hardware routes in this
          repository may return demo/status data until those hardware integrations
          are installed and connected.
        </p>
      </aside>

      <div className="grid gap-3 sm:grid-cols-3" aria-label="RoverOS host stack">
        {[
          ["Operating system", "Ubuntu Server 24.04 LTS recommended"],
          ["Runtime", "Node.js 22.12.0 or later"],
          ["Database", "PostgreSQL 16"],
        ].map(([title, detail]) => (
          <div key={title} className="rounded border border-border bg-background/60 p-3">
            <p className="text-xs font-mono uppercase text-primary">{title}</p>
            <p className="mt-1 text-sm text-foreground">{detail}</p>
          </div>
        ))}
      </div>

      <GuideSection number="01" title="Prepare the MiniPC and local network">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Install 64-bit Ubuntu Server 24.04 LTS and apply its updates.</li>
          <li>
            Name the device <code className="text-foreground">RoverOS-Server</code>.
            Android and Windows will find it automatically; no IP entry is needed.
          </li>
          <li>
            Connect all devices to the same trusted Wi-Fi/LAN. A DHCP reservation
            is useful for administration but is not required by the apps.
          </li>
          <li>
            Keep PostgreSQL on the MiniPC. Do not expose database port 5432 to
            other network devices.
          </li>
        </ul>
        <CodeBlock title="Set the network name and install mDNS">{`sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git avahi-daemon avahi-utils
sudo hostnamectl set-hostname RoverOS-Server
sudo systemctl enable --now avahi-daemon`}</CodeBlock>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Discovery uses mDNS and works on the same local network segment. Guest
          Wi-Fi, client isolation, or VLAN separation can block it.
        </p>
      </GuideSection>

      <aside
        className="space-y-3 rounded-lg border border-blue-500/40 bg-blue-500/10 p-4 sm:p-6"
        aria-labelledby="hotspot-title"
      >
        <h4 id="hotspot-title" className="font-display text-blue-200">
          Optional: make the MiniPC a Wi-Fi hotspot
        </h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          RoverOS discovery works over a MiniPC hotspot as well as a normal
          router. The MiniPC needs an access-point-capable adapter. If
          NetworkManager already manages its Wi-Fi, create the hotspot from the
          MiniPC’s local console:
        </p>
        <CodeBlock title="NetworkManager hotspot">{`nmcli device status
sudo nmcli device wifi hotspot ifname wlp2s0 con-name RoverOS-Server ssid RoverOS-Server`}</CodeBlock>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Replace <code className="text-foreground">wlp2s0</code> with the
          MiniPC’s Wi-Fi interface. NetworkManager generates a password when
          omitted; record it and join from Windows and Android. This can replace
          the MiniPC’s current Wi-Fi connection, so do not activate it over SSH.
          Do not switch the network manager remotely on an Ubuntu Server using
          systemd-networkd. Bluetooth is not supported as an app transport;
          RoverOS uses HTTP and WebSockets over IP.
        </p>
      </aside>

      <GuideSection number="02" title="Install Node.js 22 and PostgreSQL 16">
        <p className="text-sm leading-relaxed text-muted-foreground">
          This project requires Node.js <strong>22.12.0 or newer</strong>. Ubuntu
          24.04 ships PostgreSQL 16 in its standard packages. These commands use
          the official NodeSource Node 22 setup and PostgreSQL package repository
          instructions so Ubuntu 22.04 users can also install PostgreSQL 16.
        </p>
        <CodeBlock title="Install Node.js 22">{`curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
npm --version
# Confirm node reports v22.12.0 or newer`}</CodeBlock>
        <CodeBlock title="Install PostgreSQL 16">{`sudo apt install -y postgresql-common ca-certificates
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16
sudo systemctl enable --now postgresql
psql --version`}</CodeBlock>
      </GuideSection>

      <GuideSection number="03" title="Create the RoverOS database">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Create a dedicated database owner, not a PostgreSQL superuser. Generate
          a long password and keep it private; it will be entered into the
          MiniPC’s protected environment file in step 06.
        </p>
        <CodeBlock title="Create a database role and database">{`# Generate a password; copy it to a secure password manager.
openssl rand -hex 32

# Open PostgreSQL's local administrator prompt.
sudo -u postgres psql

CREATE ROLE roveros LOGIN;
CREATE DATABASE roveros OWNER roveros;
\\password roveros
\\q`}</CodeBlock>
      </GuideSection>

      <GuideSection number="04" title="Download the RoverOS source code">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Replace the repository URL with the HTTPS clone URL for your RoverOS
          GitHub repository. For a private repository, use an approved deploy key;
          do not put a GitHub token in the clone URL.
        </p>
        <CodeBlock title="Create a restricted service account and clone the app">{`sudo useradd --system --create-home --user-group \\
  --home-dir /opt/roveros --shell /usr/sbin/nologin roveros
sudo -u roveros git clone https://github.com/OWNER/REPOSITORY.git /opt/roveros/app
cd /opt/roveros/app

# Rewrite Replit-only npm lockfile URLs as the app account, then install.
sudo -u roveros node scripts/normalize-github-npm-lock.mjs
sudo -u roveros npm ci`}</CodeBlock>
      </GuideSection>

      <GuideSection number="05" title="Set the database connection securely">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Client apps discover <code className="text-foreground">RoverOS-Server</code>
          automatically. The database URL below remains local to the MiniPC. Use
          the password created in step 03.
        </p>
        <CodeBlock title="Create a root-owned environment file">{`sudo install -o root -g roveros -m 640 /dev/null /etc/roveros.env
sudo nano /etc/roveros.env`}</CodeBlock>
        <CodeBlock title="Contents of /etc/roveros.env">{`NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://roveros:PASTE_YOUR_PASSWORD_HERE@127.0.0.1:5432/roveros`}</CodeBlock>
        <p className="text-sm text-muted-foreground">
          Save the file, then confirm its permissions with{" "}
          <code className="text-foreground">sudo ls -l /etc/roveros.env</code>.
          It should be readable only by root and the roveros group. Do not commit
          this file or share its contents.
        </p>
      </GuideSection>

      <GuideSection number="06" title="Build the app and initialize its schema">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Build the static web assets and server bundle, then create the database
          tables. Run the schema command against a new, empty RoverOS database
          during initial installation.
        </p>
        <CodeBlock title="Build and initialize">{`cd /opt/roveros/app
sudo -u roveros npm run build
sudo -u roveros bash -c 'set -a; . /etc/roveros.env; set +a; cd /opt/roveros/app; npm run db:push'
sudo -u roveros npm prune --omit=dev`}</CodeBlock>
      </GuideSection>

      <GuideSection number="07" title="Run RoverOS automatically with systemd">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Create the service file below. It starts the production server after
          networking and PostgreSQL are available, and restarts it if it exits.
        </p>
        <CodeBlock title="/etc/systemd/system/roveros.service">{`[Unit]
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
WantedBy=multi-user.target`}</CodeBlock>
        <CodeBlock title="Enable the service and verify it">{`sudo systemctl daemon-reload
sudo systemctl enable --now roveros
sudo systemctl status roveros --no-pager
curl -i http://127.0.0.1:5000/api/system/info
sudo journalctl -u roveros -n 100 --no-pager`}</CodeBlock>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Install the Avahi service record so Android can identify RoverOS among
          other HTTP services on the network.
        </p>
        <CodeBlock title="Advertise RoverOS for automatic discovery">{`sudo install -m 0644 /opt/roveros/app/deploy/avahi/roveros.service /etc/avahi/services/roveros.service
sudo systemctl restart avahi-daemon
sudo avahi-browse -rt _http._tcp`}</CodeBlock>
      </GuideSection>

      <GuideSection number="08" title="Allow trusted local-network access only">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Change <code className="text-foreground">192.168.1.0/24</code> to
          your LAN subnet. Allow SSH first if you administer the MiniPC remotely.
          Do not create router port forwarding for RoverOS or PostgreSQL.
        </p>
        <CodeBlock title="Restrict the firewall to your LAN">{`sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow from 192.168.1.0/24 to any port 5000 proto tcp
sudo ufw allow from 192.168.1.0/24 to any port 5353 proto udp
sudo ufw enable
sudo ufw status verbose

# Do not open port 5432 to the LAN.`}</CodeBlock>
        <aside className="rounded border border-red-500/40 bg-red-500/10 p-4 text-sm text-muted-foreground">
          RoverOS rover-control API routes do not currently require user
          authentication. Keep port 5000 on a trusted, isolated LAN; do not expose
          it to the public internet. Use a properly secured VPN for remote access.
        </aside>
      </GuideSection>

      <GuideSection number="09" title="Connect the Windows and Android clients">
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            On the Windows PC or Android phone, join the same Wi-Fi/LAN as the
            MiniPC.
          </li>
          <li>
            Enter the MiniPC URL, for example{" "}
            <code className="text-foreground">http://192.168.1.40:5000</code>.
            Use the reserved MiniPC address, not localhost.
          </li>
          <li>
            Android asks for this address on first launch. Tap TEST CONNECTION,
            then SAVE AND CONNECT. The address is saved on the device and can be
            changed from the app’s CONFIG page.
          </li>
          <li>
            Build/install Windows using the{" "}
            <code className="text-foreground">Windows app build</code> GitHub
            Actions workflow. Install the generated{" "}
            <code className="text-foreground">.exe</code>, then enter the same
            MiniPC URL when prompted.
          </li>
          <li>
            To install Android, run the{" "}
            <code className="text-foreground">Android app build</code> workflow
            with its signed-release option, then install the signed APK from the
            created GitHub Release.
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          The Android client uses the MiniPC’s API and WebSocket on port 5000.
          Android does not connect directly to PostgreSQL. If Android reports a
          network error, verify the firewall, address, port, and that the API is
          running.
        </p>
      </GuideSection>

      <GuideSection number="10" title="Update RoverOS and back up the database">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Before updating an existing installation, back up its database. Review
          schema prompts carefully; do not accept a destructive change unless you
          intend it.
        </p>
        <CodeBlock title="Back up and update from the repository">{`sudo -u postgres pg_dump -Fc roveros > "$HOME/roveros-$(date +%F).dump"
sudo systemctl stop roveros
cd /opt/roveros/app
sudo -u roveros git pull --ff-only
sudo -u roveros node scripts/normalize-github-npm-lock.mjs
sudo -u roveros npm ci
sudo -u roveros npm run build
sudo -u roveros bash -c 'set -a; . /etc/roveros.env; set +a; cd /opt/roveros/app; npm run db:push'
sudo -u roveros npm prune --omit=dev
sudo systemctl start roveros
sudo systemctl status roveros --no-pager`}</CodeBlock>
      </GuideSection>

      <GuideSection number="11" title="Troubleshoot a client that cannot connect">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            On the MiniPC, check{" "}
            <code className="text-foreground">sudo systemctl status roveros</code>{" "}
            and{" "}
            <code className="text-foreground">sudo journalctl -u roveros -n 100</code>.
          </li>
          <li>
            From the MiniPC, run{" "}
            <code className="text-foreground">curl -i http://127.0.0.1:5000/api/system/info</code>.
            The service should return an HTTP response.
          </li>
          <li>
            From another device on the LAN, open{" "}
            <code className="text-foreground">http://MINIPC-IP:5000</code> in a
            browser. If this fails, check the reserved IP and UFW rule.
          </li>
          <li>
            Make sure the entered URL has the right protocol and port, and that
            the phone is not using mobile data or an isolated guest Wi-Fi.
          </li>
          <li>
            If the website opens but Android’s connection test fails, update the
            Android APK to the version with MiniPC connection support.
          </li>
        </ul>
      </GuideSection>

      <footer className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>Official installation references:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <a className="text-primary underline underline-offset-4" href="https://github.com/nodesource/distributions" target="_blank" rel="noreferrer">
              NodeSource Node.js 22 instructions
            </a>
          </li>
          <li>
            <a className="text-primary underline underline-offset-4" href="https://www.postgresql.org/download/linux/ubuntu/" target="_blank" rel="noreferrer">
              PostgreSQL for Ubuntu
            </a>
          </li>
          <li>
            <a className="text-primary underline underline-offset-4" href="https://capacitorjs.com/docs/config" target="_blank" rel="noreferrer">
              Capacitor Android configuration
            </a>
          </li>
        </ul>
      </footer>
    </article>
  );
}
