# RoverOS MiniPC First-Run Provisioning Plan

**Status:** Proposal for review. No application code or runtime configuration was changed for this plan.

## Summary

On first boot, the MiniPC must provide a small, secure setup service before the full RoverOS server is installed. Android and Windows clients discover `RoverOS-Server`, ask whether the MiniPC is provisioned, and either open RoverOS normally or show a first-run wizard. The wizard collects the Wi-Fi network details; the MiniPC—not the clients—joins that network and installs its approved software bundle.

The most important architecture decision is the operating system. The repository's current installation guide targets Ubuntu Server and uses APT, Node.js installed on-device, PostgreSQL packages, and a systemd service. Ubuntu Core is a snap-managed, transactional system assembled from a model, base, kernel, gadget, and application snaps. Its default network setup uses netplan and systemd-networkd; installing the NetworkManager snap can take control of all network interfaces. The Ubuntu Server instructions and current hotspot script therefore cannot be reused as-is on Ubuntu Core.

This plan assumes **Ubuntu Core is the intended factory OS**, as stated in the request. It proposes a preinstalled provisioning snap and a Core-compatible RoverOS release. If “Ubuntu Core” means a minimal Ubuntu Server installation instead, select that before implementation; it is a substantially simpler APT/systemd path.

## Current project baseline

- Android and Windows already find the MiniPC named `RoverOS-Server` on the local network. Android uses DNS-SD discovery; Windows checks `RoverOS-Server.local`.
- The clients verify `/api/system/info`, but there is no provisioning state or Wi-Fi onboarding API yet. Android currently treats any verified RoverOS server as ready.
- The existing install guide installs Node.js 22, PostgreSQL 16, Avahi, the production RoverOS build, and a systemd service on Ubuntu Server.
- `scripts/setup-minipc-hotspot.sh` is an optional, interactive Ubuntu Server/NetworkManager tool. It checks the Wi-Fi adapter and NetworkManager, refuses to run over SSH, creates a WPA2 hotspot with a random password, and adds scoped firewall rules. It does not start the hotspot automatically on first boot and is not a drop-in Ubuntu Core snap.
- Current documentation excludes Arduino firmware, motor-control services, camera streaming, and the separate FlyBaby service from the MiniPC install. These need to be classified as required or optional before “install everything” can be defined.

## Proposed first-run experience

1. **Factory boot:** The MiniPC starts in a restricted provisioning state. A preinstalled setup service advertises the stable `RoverOS-Server` identity and makes the setup API available before the RoverOS application is installed.
2. **Discover and check:** Android and Windows discover the MiniPC and request a provisioning status. The response contains only a state and safe progress information—never passwords, tokens, or private configuration.
3. **Already configured:** If status is `ready`, the clients continue to the normal RoverOS interface without showing setup.
4. **Needs setup:** If status is `setup_required`, the client displays a Wi-Fi wizard. The MiniPC scans for nearby networks and returns SSID, security type, and signal strength. The user selects a network, enters its password, and confirms.
5. **Connect and install:** The client sends the credentials once through an authenticated, encrypted setup channel. A privileged MiniPC service applies the network configuration, verifies internet access, then starts a versioned, verified installation job.
6. **Reconnect if needed:** The MiniPC reports progress and a clear recovery message. If it must stop its temporary hotspot to join the home Wi-Fi, the client tells the user to join that same Wi-Fi through Windows or Android settings and then search again. The apps do not silently join a Wi-Fi network.
7. **Ready:** The MiniPC verifies the database, RoverOS API, web assets, and discovery service, saves `ready` state, and the clients enter normal operation. The setup service remains available for status and controlled recovery, but no longer accepts first-time credentials.

### Network transition requirement

The onboarding AP must exist before any client can connect. If the client is currently connected through that AP, a single Wi-Fi radio may not be able to keep the AP active while joining the home network. The exact MiniPC Wi-Fi adapter must be tested for concurrent AP/client mode. Otherwise the product needs a second Wi-Fi adapter, an Ethernet uplink during provisioning, or an explicit client reconnect step after the AP is replaced. The setup UI must not imply that the client will stay connected when the hardware cannot do so.

## Target architecture

```text
Android client ─┐                         ┌─ Wi-Fi configuration
                ├─ discover RoverOS-Server ─> MiniPC provisioning service
Windows client ─┘   check setup state      ├─ signed software manifest
                                           ├─ database and RoverOS install
                                           └─ ready state + normal API
```

Keep the same `RoverOS-Server` discovery identity before and after installation. The bootstrap service must answer the setup-status request before the full application exists. Decide whether it owns or proxies the existing port 5000 permanently, or performs a controlled handoff to the RoverOS service. Do not have two services race to bind the same port.

The existing Android discovery plugin and Windows hostname check can be extended to recognize both setup and ready states. The endpoint and transport details below are proposals to finalize during implementation.

### Client behavior

- On each connection, query a small `GET /api/provisioning/status` endpoint.
- Handle explicit states such as `setup_required`, `wifi_connecting`, `waiting_for_internet`, `installing`, `ready`, and `failed`; do not infer setup completion from the presence of the normal API alone.
- In ready state, continue to the existing RoverOS experience.
- In setup state, provide a shared flow on Android and Windows: select or enter an SSID, enter credentials, confirm, show progress, and present specific retry/recovery actions.
- Provide a hidden-network path. The first version should support personal WPA2/WPA3 networks; enterprise networks requiring certificates or usernames should be a separate scope unless required.
- Clear password fields and in-memory values as soon as submission finishes. Never write Wi-Fi credentials to local storage, app settings, crash reports, or analytics.
- Keep setup usable on phone and desktop, with accessible status announcements, keyboard navigation, and clear distinction between “connecting to Wi-Fi” and “installing RoverOS.”

### MiniPC provisioning service

The provisioning service must be preinstalled in the factory image. A bare operating system cannot serve the setup screen, accept Wi-Fi credentials, or download RoverOS until a network is available.

Responsibilities:

1. Start the temporary AP and provisioning API in setup mode.
2. Report only non-secret provisioning state and progress.
3. Scan for Wi-Fi networks and configure a selected network through the supported operating-system networking interface.
4. Verify internet access and DNS before starting software installation.
5. Fetch a signed, versioned manifest from an allow-listed release source, verify its signature and artifact checksums, then install only the declared packages.
6. Initialize the database, apply the application schema, start RoverOS, publish the normal service record, and verify health checks.
7. Persist each completed stage atomically so power loss or a failed download can resume safely.
8. Keep an audit trail of stage names, timestamps, and sanitized error codes—never request bodies, Wi-Fi passwords, pairing tokens, or credential-bearing command lines.

The mobile or desktop app must never send a shell script or arbitrary package URL for the MiniPC to execute. The privileged service should accept typed, allow-listed operations and use a safe OS API (prefer a network-management API such as NetworkManager's D-Bus interface where supported). If a subprocess is unavoidable, pass validated arguments separately; never interpolate SSIDs, passwords, URLs, or other request data into a shell command.

## Ubuntu Core packaging plan

If Ubuntu Core is mandatory:

1. **Validate the target hardware and image.** Confirm the exact MiniPC model, CPU architecture, Wi-Fi chipset/driver, storage, and supported Ubuntu Core release. Confirm that an appropriate kernel and gadget configuration exist for the hardware.
2. **Build a factory image.** Include the required base, kernel, gadget, network stack, and a signed RoverOS provisioning snap. The provisioning service must be present before first boot and able to expose the setup API.
3. **Choose one network-management design.** Ubuntu Core defaults to netplan/systemd-networkd; the NetworkManager snap also supports Wi-Fi and AP creation, but installing it changes which service manages all network interfaces. Select and test the renderer as part of the image build; do not switch renderers opportunistically during first-run setup.
4. **Package the application and database.** Build and test a confined RoverOS snap (or a small, explicit set of snaps) for the Node.js server and web assets. Prove that PostgreSQL 16 can be packaged and operated with persistent data and the necessary confinement/interfaces. If a supported database snap is not suitable, stop and revisit the OS choice rather than falling back to undocumented APT changes.
5. **Install signed releases.** The provisioning service installs an approved snap revision or bundle using snapd and a pinned channel/version. Do not download and execute an unsigned shell installer.
6. **Use Core-managed recovery and updates.** Integrate with snapd's transactional changes and recovery model; keep database backup/migration behavior explicit and test interrupted updates.

For a minimal **Ubuntu Server 24.04** alternative, keep the current app stack and provide a first-boot systemd provisioning service that installs pinned APT dependencies, configures Wi-Fi through the chosen network manager, creates PostgreSQL state, and installs a signed RoverOS release. This is not the same installer as the Ubuntu Core path.

## Credential and installation security

Wi-Fi passwords are sensitive credentials. The proposed safeguards are:

- Give every MiniPC a unique setup identity and random AP password. Do not ship a shared factory password.
- Require a per-device pairing credential, supplied by a printed QR/label or a local-console step. Define this before building the image.
- Encrypt the credential submission channel and pin/verify the device identity. The current normal RoverOS API uses local HTTP, which must not be used to transmit Wi-Fi passwords in plaintext.
- Do not echo credentials in API responses, progress state, URLs, shell history, logs, or telemetry. Store credentials only in the operating system's protected network credential store.
- Validate SSID length/encoding, authentication mode, and passphrase bounds. Treat all client input as untrusted.
- Restrict provisioning endpoints to a paired local client. Status may be readable without authentication if it reveals no sensitive data; credential submission, retry, and reset operations require authorization.
- Allow installation only from a fixed, trusted release manifest. Verify signatures and hashes before installation; reject unsigned, stale, wrong-architecture, or altered packages.
- Keep the provisioning API narrow. It must not become a general remote shell or arbitrary package installer.

## Required software inventory

Create and approve an inventory before implementation:

| Category | Current Ubuntu Server baseline | Core requirement |
| --- | --- | --- |
| Network discovery | Avahi, `RoverOS-Server` DNS-SD record | Core-compatible discovery service/record |
| RoverOS API and web app | Node.js 22.12+, production build | Packaged and confined snap(s) |
| Database | PostgreSQL 16, local-only listener | Tested snap/package with persistent storage |
| Service management | systemd service and environment file | Snap services and snap-managed configuration |
| Hardware features | Not included by the current install guide | Explicitly classify firmware, motor/camera services, and FlyBaby as required or optional |

The completed inventory should include versions, supported CPU architecture, disk/RAM requirements, trusted source, signature/checksum policy, and a readiness check for each component. Do not label hardware features “installed” unless their firmware, drivers, permissions, and physical connections are also verified.

## Implementation phases

### Phase 0 — Platform and hardware decision

- Confirm Ubuntu Core is mandatory or select minimal Ubuntu Server.
- Record the exact MiniPC model, Wi-Fi adapter, antenna, storage, architecture, and whether Ethernet or a second Wi-Fi radio is available.
- Prototype booting the selected OS, starting an AP, joining an upstream Wi-Fi network, and maintaining/recovering client access.
- Confirm PostgreSQL 16 packaging, storage, and migration strategy for Ubuntu Core.
- Approve the required-vs-optional software inventory and signed release source.

**Exit gate:** no app implementation until the platform and Wi-Fi topology are proven on the target hardware.

### Phase 1 — Factory bootstrap image

- Build an image that boots into setup mode with a unique AP credential and device pairing identity.
- Start the provisioning service before the RoverOS application.
- Advertise the stable `RoverOS-Server` identity and expose only setup-status and pairing behavior.
- Provide a documented physical recovery path if Wi-Fi credentials are wrong or the installer loses internet.

### Phase 2 — Provisioning backend and installer

- Implement a durable, idempotent provisioning state machine and safe status/progress API.
- Add encrypted, authenticated Wi-Fi credential submission and OS-specific network configuration.
- Add the signed release-manifest download, verification, installation, database setup, service activation, and post-install health checks.
- Add retry and recovery behavior for wrong credentials, no internet, package-source failures, corrupted downloads, reboot, and interrupted installation.

### Phase 3 — Android and Windows onboarding

- Extend both clients to query setup state immediately after automatic discovery.
- Keep ready-state connection behavior unchanged.
- Add the Wi-Fi wizard, pairing, progress, reconnect guidance, retry, and completed states to both clients.
- Ensure no credential is written to app storage or exposed in diagnostics.

### Phase 4 — Validation and release

- Test clean first boot, normal reboot, recovery, update, and factory reset behavior.
- Run on the actual target MiniPC and Wi-Fi hardware, not only an emulator or desktop VM.
- Release the factory image, provisioning snap/agent, and client updates together with matching versions and signatures.
- Document first boot, network joining, recovery, updates, backups, and supported hardware/OS combinations.

## Acceptance criteria

1. A clean MiniPC boot exposes the setup service before RoverOS is installed and advertises `RoverOS-Server`.
2. Android and Windows discover it without manual IP entry and show the setup wizard only when the server reports `setup_required`.
3. A valid Wi-Fi configuration reaches the MiniPC securely; credentials never appear in client storage, server logs, progress responses, or installation commands.
4. The MiniPC verifies internet access, installs only signed and approved software, and can resume after a reboot or interrupted download.
5. `ready` is reported only after the database, schema, RoverOS service, API health check, and discovery record are all verified.
6. After first-run setup, both clients rediscover the MiniPC and enter normal operation. The user receives clear instructions if they must manually switch the client device from the setup AP to the home Wi-Fi.
7. Wrong passwords, hidden networks, no internet, unsupported hardware, disk-space failures, invalid package signatures, unauthorized requests, and power loss produce safe, recoverable states.
8. The installer does not expose PostgreSQL to Wi-Fi clients or the public internet, and cannot execute client-supplied commands.
9. Required and optional rover hardware software is explicitly listed; the UI does not claim unconnected hardware is ready.

## Decisions needed for approval

1. **Operating system:** Is Ubuntu Core mandatory, or did you mean a minimal Ubuntu Server installation? Core requires a custom image and snap packaging; it cannot use the existing APT installer unchanged.
2. **Wi-Fi hardware:** Can the MiniPC host an AP and join the home network at the same time? If not, is a second adapter or Ethernet available, and may the client need to rejoin Wi-Fi manually?
3. **Factory access:** How will the owner obtain each device's unique AP password and pairing identity—printed QR/label, local console, or another method?
4. **Network support:** Should the first version support personal WPA2/WPA3 networks only, or enterprise Wi-Fi as well?
5. **Software scope:** Which firmware, motor-control, camera, and FlyBaby components are required for a “fully working Rover,” and which are optional?
6. **Release source:** Can the MiniPC reach GitHub Releases/Snap Store, and should every installed release be signed by the project?

## References

### Current project files

- `client/src/pages/Setup.tsx` — Android first connection and discovery screen.
- `desktop/main.cjs` and `desktop/setup.html` — Windows discovery and setup screen.
- `server/routes.ts` — current `/api/system/info` identity response; no provisioning-status API exists yet.
- `scripts/setup-minipc-hotspot.sh` — current interactive Ubuntu Server hotspot setup.
- `deploy/avahi/roveros.service` — current RoverOS DNS-SD advertisement.
- `docs/MINIPC_INSTALLATION.md` and `client/src/pages/MiniPcInstallGuide.tsx` — current Ubuntu Server installation guide and software-scope notes.

### Ubuntu Core documentation

- [Using Ubuntu Core](https://documentation.ubuntu.com/core/how-to-guides/using-ubuntu-core/) — snap-managed, confined, transactional system model.
- [How installation works](https://documentation.ubuntu.com/core/explanation/how-installation-works/) — Core images include the base, kernel, gadget, snapd, and application snaps.
- [Network Manager on Ubuntu Core](https://documentation.ubuntu.com/core/explanation/system-snaps/network-manager/) — default networkd/netplan behavior and NetworkManager's takeover of network interfaces.
- [Configure Wi-Fi connections](https://documentation.ubuntu.com/core/explanation/system-snaps/network-manager/how-to-guides/configure-wifi-connections/) and [Configure Wi-Fi access points](https://documentation.ubuntu.com/core/explanation/system-snaps/network-manager/how-to-guides/configure-wifi-access-points/) — Core's supported NetworkManager workflows.
