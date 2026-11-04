import type { ReactNode } from "react";

function CodeBlock({ title, children }: { title: string; children: string }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-xs font-mono font-semibold text-primary">{title}</figcaption>
      <pre tabIndex={0} aria-label={title}
        className="overflow-x-auto rounded border border-border bg-black/60 p-4 text-xs leading-relaxed text-green-300">
        <code>{children}</code>
      </pre>
    </figure>
  );
}

function Section({ number, title, children }: {
  number: string; title: string; children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card/40 p-4 sm:p-6">
      <h4 className="flex items-baseline gap-3 font-display text-lg text-primary">
        <span className="font-mono text-sm text-muted-foreground">{number}</span>{title}
      </h4>
      {children}
    </section>
  );
}

export default function MiniPcInstallGuide() {
  return (
    <article className="mx-auto max-w-5xl space-y-6 p-4 pb-12 sm:p-6" data-testid="minipc-install-guide">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-primary">RoverOS deployment guide</p>
        <h3 className="text-2xl font-display text-foreground sm:text-3xl">Install RoverOS on the MiniPC</h3>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          The MiniPC hosts the RoverOS web app, API, WebSocket service, and PostgreSQL database.
          Android and Windows are clients on the same local network; they do not need PostgreSQL.
        </p>
      </header>

      <aside className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
        <h4 className="mb-2 font-display text-amber-300">ACEPC AK1, 8 GB RAM</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use headless Ubuntu Server 24.04 LTS amd64. The AK1 name covers hardware variants;
          confirm the installed storage and Wi-Fi adapter on the actual unit. Do not assume
          its Wi-Fi radio supports AP and client mode at the same time. RoverOS web/API and
          database setup does not install robot firmware, motor-control, camera, or FlyBaby services.
        </p>
      </aside>

      <Section number="01" title="Install and prepare Ubuntu Server">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Install Ubuntu Server 24.04 LTS for 64-bit amd64 with no desktop environment.</li>
          <li>Connect Ethernet if available, create an owner account, and enable OpenSSH Server for administration.</li>
          <li>During installation or at the local console, configure NetworkManager for Wi-Fi. Do not change the active network manager over SSH.</li>
          <li>Set the hostname to <code className="text-foreground">RoverOS-Server</code>; keep the MiniPC and clients on a trusted local network.</li>
        </ol>
        <CodeBlock title="Check the AK1 hardware and network manager">{`lscpu
free -h
lsblk
lspci -nn
lsusb
iw list
nmcli device status
systemctl is-active NetworkManager`}</CodeBlock>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Run these checks locally or over SSH before setup. The Wi-Fi device must report
          access-point mode if you want the MiniPC to create the RoverOS-Server network.
          A wired connection or a second Wi-Fi adapter avoids disconnecting a client during setup.
        </p>
        <CodeBlock title="Install bootstrap prerequisites and NetworkManager">{`sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git iw openssl network-manager avahi-daemon
sudo systemctl enable --now NetworkManager avahi-daemon`}</CodeBlock>
        <p className="text-sm leading-relaxed text-amber-200">
          If Ubuntu currently uses systemd-networkd, switch the Netplan renderer only at the
          MiniPC console (or with a wired recovery path). Use <code>sudo netplan try</code>
          before applying changes; accepting a Wi-Fi network-manager switch over SSH can
          disconnect the session.
        </p>
      </Section>

      <Section number="02" title="Build and publish the MiniPC release">
        <p className="text-sm leading-relaxed text-muted-foreground">
          GitHub Actions builds the web assets and server bundle on Ubuntu 24.04 using Node.js 22.
          The AK1 downloads this prebuilt bundle; it does not compile the app or install development packages.
          Push the project to GitHub, then create and push a version tag to publish a release.
        </p>
        <CodeBlock title="Publish a versioned server release from a developer computer">{`git tag v1.0.1
git push origin v1.0.1`}</CodeBlock>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Check the <strong>RoverOS MiniPC server release</strong> workflow in GitHub Actions.
          A successful tag build publishes <code>RoverOS-server-linux-x64.tar.gz</code> and its
          SHA-256 checksum. The bootstrap expects the repository to be reachable through public
          GitHub Releases; private repositories need an approved release-access design before use.
        </p>
      </Section>

      <Section number="03" title="Install the one-time bootstrap service">
        <p className="text-sm leading-relaxed text-muted-foreground">
          The bootstrap must be installed once over SSH or at the MiniPC console because a bare
          Ubuntu install cannot advertise RoverOS or accept setup credentials. Clone the project
          source to the MiniPC, then run the script with sudo. Use your actual GitHub owner/repository.
        </p>
        <CodeBlock title="Clone the source and install bootstrap">{`git clone https://github.com/kadetkrysty/Rover-Pilot.git ~/Rover-Pilot
cd ~/Rover-Pilot
sudo bash scripts/minipc/install-bootstrap.sh kadetkrysty/Rover-Pilot`}</CodeBlock>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The script verifies Ubuntu 24.04 amd64, Node.js 22.12+, NetworkManager, and Wi-Fi AP support.
          It creates a per-device HTTPS certificate, a one-time pairing code, and a WPA2 setup access point
          named <strong>RoverOS-Server</strong>. Keep the displayed Wi-Fi password, pairing code, and
          certificate fingerprint private. If Wi-Fi is already connected, the script leaves it alone;
          clients can connect through that same LAN instead.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          If the Wi-Fi adapter cannot create an AP, install through a wired LAN and use clients on that
          same LAN. The bootstrap fails rather than taking over another network manager or changing the
          active Wi-Fi connection unexpectedly.
        </p>
      </Section>

      <Section number="04" title="Connect Windows and Android clients">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Join the <strong>RoverOS-Server</strong> Wi-Fi network using the password printed by bootstrap, or connect both devices to the MiniPC's existing LAN.</li>
          <li>Open the Android or Windows client and wait for automatic discovery; do not enter an IP address.</li>
          <li>For first setup, enter the SHA-256 certificate fingerprint and one-time pairing code from the MiniPC terminal.</li>
          <li>Scan or enter a WPA2 Wi-Fi network name, enter its password, then choose <strong>Connect and install RoverOS</strong>.</li>
          <li>If the MiniPC replaces the setup Wi-Fi with the home Wi-Fi, switch the phone or PC to that same network and reopen RoverOS.</li>
        </ol>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Wi-Fi credentials use HTTPS with the MiniPC certificate fingerprint verified by the native Android
          and Windows clients. The setup code is never saved by the clients, and the MiniPC stores the
          Wi-Fi password only in a root-protected NetworkManager profile. The first version supports
          personal WPA2-Personal networks, including hidden networks; enterprise Wi-Fi is not supported.
        </p>
      </Section>

      <Section number="05" title="What setup installs and verifies">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Node.js 22 runtime and PostgreSQL 16, installed on the MiniPC.</li>
          <li>The latest stable, prebuilt RoverOS Linux amd64 release and committed database migrations.</li>
          <li>A local-only PostgreSQL database, a restricted RoverOS service account, and a systemd web/API service on TCP 5000.</li>
          <li>Avahi discovery as <code>RoverOS-Server</code>; PostgreSQL port 5432 is not opened to the LAN.</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Setup reports ready after the installer completes. This release checks the downloaded bundle
          against the SHA-256 checksum published with the GitHub release. Keep the RoverOS API limited
          to a trusted LAN; it is not intended for public internet exposure.
        </p>
      </Section>

      <Section number="06" title="Verify service health and recover">
        <CodeBlock title="Check the service from SSH">{`sudo systemctl status roveros --no-pager
sudo journalctl -u roveros -n 100 --no-pager
curl -i http://127.0.0.1:5000/api/system/info
curl -i http://127.0.0.1:5000/api/provisioning/status
sudo avahi-browse -rt _http._tcp`}</CodeBlock>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>If no AP is active, check <code>nmcli device status</code> and <code>sudo systemctl status roveros-provisioner</code>.</li>
          <li>If clients cannot discover the server, disable guest Wi-Fi/client isolation and confirm mDNS UDP 5353 and app TCP 5000 are allowed on the local network.</li>
          <li>If setup fails, reconnect to the setup network or use Ethernet/SSH, inspect the service journal, and retry from the client. Do not paste Wi-Fi passwords into logs or support requests.</li>
          <li>Do not expose PostgreSQL port 5432 or forward RoverOS ports from a public router.</li>
        </ul>
      </Section>

      <footer className="rounded-lg border border-border bg-card/40 p-4 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">AK1 hardware note:</strong> the 8 GB configuration meets the
        project’s planned RAM target, but ACEPC AK1 revisions can differ in CPU, storage, and Wi-Fi adapter.
        Confirm the exact hardware output over SSH and test AP support on the specific unit before relying on
        automatic hotspot setup. Ubuntu Server 24.04 is the first supported target; do not use Ubuntu Core.
      </footer>
    </article>
  );
}
