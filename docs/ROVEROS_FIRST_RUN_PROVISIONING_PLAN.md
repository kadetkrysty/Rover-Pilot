# RoverOS MiniPC First-Run Provisioning Plan

**Status:** Proposal for review. No application code or runtime configuration was changed for this plan.

## Summary

On first boot, the MiniPC must provide a small, secure setup service before the full RoverOS server is installed. Android and Windows clients discover `RoverOS-Server`, ask whether the MiniPC is provisioned, and either open RoverOS normally or show a first-run wizard. The wizard collects the Wi-Fi network details; the MiniPC—not the clients—joins that network and installs its approved software bundle.

The operating-system clarification is that the MiniPC needs a **headless Ubuntu installation with no desktop environment**, not Ubuntu Core. The recommendation is **Ubuntu Server 24.04 LTS, 64-bit amd64, minimal install**. This aligns with the existing installation guide, Node.js 22.12+, PostgreSQL 16, APT, systemd, Avahi, and the current Ubuntu Server hotspot tooling. Use the latest 24.04 point release available when installing (24.04.5 as of this plan update).

Ubuntu 26.04 LTS is newer and has a longer support window, but the project has not been qualified on it and the default package versions differ from the current Node/PostgreSQL targets. Debian 13 is also a viable headless server OS, but its current default PostgreSQL version and the project’s Ubuntu-specific guide create extra work. Neither is the easiest first implementation. The plan keeps Ubuntu 26.04 and Debian as later qualification options rather than mixing operating systems in the first release.

## Current project baseline

- Android and Windows already find the MiniPC named `RoverOS-Server` on the local network. Android uses DNS-SD discovery; Windows checks `RoverOS-Server.local`.
- The clients verify `/api/system/info`, but there is no provisioning state or Wi-Fi onboarding API yet. Android currently treats any verified RoverOS server as ready.
- The existing install guide installs Node.js 22, PostgreSQL 16, Avahi, the production RoverOS build, and a systemd service on Ubuntu Server.
- `scripts/setup-minipc-hotspot.sh` is an optional, interactive Ubuntu Server/NetworkManager tool. It checks the Wi-Fi adapter and NetworkManager, refuses to run over SSH, creates a WPA2 hotspot with a random password, and adds scoped firewall rules. It does not start the hotspot automatically on first boot, so the first-run service must safely replace or extend this manual flow.
- Project documentation identifies an Intel Celeron MiniPC and 64-bit architecture, but does not record the exact CPU model, RAM, SSD, or Wi-Fi adapter. Hardware-specific compatibility cannot be claimed until those are measured.
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

The provisioning service must be preinstalled in a prepared Ubuntu Server image or installed during a one-time factory/bench setup. A stock headless Ubuntu install alone cannot serve the setup screen, accept Wi-Fi credentials, or download RoverOS until a network is available. SSH is useful for administration and recovery, but is not a substitute for the client-facing bootstrap service.

Responsibilities:

1. Start the temporary AP and provisioning API in setup mode.
2. Report only non-secret provisioning state and progress.
3. Scan for Wi-Fi networks and configure a selected network through the supported operating-system networking interface.
4. Verify internet access and DNS before starting software installation.
5. Fetch a signed, versioned manifest from an allow-listed release source, verify its signature and artifact checksums, then install only the declared packages.
6. Initialize the database, apply the application schema, start RoverOS, publish the normal service record, and verify health checks.
7. Persist each completed stage atomically so power loss or a failed download can resume safely.
8. Keep an audit trail of stage names, timestamps, and sanitized error codes—never request bodies, Wi-Fi passwords, pairing tokens, or credential-bearing command lines.

The mobile or desktop app must never send a shell script or arbitrary package URL for the MiniPC to execute. The privileged service should accept typed, allow-listed operations and use a safe OS API (prefer NetworkManager's D-Bus interface for Wi-Fi setup). If a subprocess is unavoidable, pass validated arguments separately; never interpolate SSIDs, passwords, URLs, or other request data into a shell command.

## Operating-system and hardware recommendation

### Recommended OS: Ubuntu Server 24.04 LTS

Use the **Ubuntu Server 24.04 LTS amd64 image without a desktop environment**. Select the Server installer, install OpenSSH Server, set the hostname to `RoverOS-Server`, and use SSH keys for administration. Keep root SSH login and password-based remote login disabled where the installation supports that policy.

Reasons for this choice:

- It matches the project's existing MiniPC installation guide and the currently documented PostgreSQL 16 and Node.js 22.12+ requirements.
- It uses the project's existing APT/systemd/Avahi operating model and avoids the custom image, snap confinement, and database-packaging work that Ubuntu Core would require.
- The Server image has no desktop environment, so it avoids the memory and storage cost of a GUI on a low-power Celeron MiniPC.
- Ubuntu 24.04 LTS standard security maintenance is scheduled through May 2029. This is sufficient for the initial implementation, but the project should qualify an upgrade path before that date.

Ubuntu Server's published baseline (3 GB suggested RAM and 25 GB suggested storage for the OS) is not the RoverOS system requirement. For planning, use **4 GB RAM and 32 GB SSD as a provisional minimum for the web/API and database only; 8 GB RAM and 64 GB SSD are recommended**. These are engineering targets, not yet validated on the project's hardware. If the MiniPC has less than 4 GB RAM or 32 GB storage, do not promise support until a measured load/upgrade test passes. Hardware-specific services may need more.

To reduce CPU, RAM, and disk pressure, build the production RoverOS release in GitHub Actions and install a verified prebuilt artifact on the MiniPC. Do not run `npm ci` and compile the application during first boot. Keep PostgreSQL local-only and budget storage for database growth, logs, backups, and at least one update/rollback.

### Network and SSH setup

- Use NetworkManager for the Wi-Fi scan, client connection, and access-point functions required by first-run setup. Configure it during OS imaging or local installation, before relying on SSH. Changing the active network manager over SSH can cut off the session and is not an acceptable unattended provisioning step.
- Verify the exact Wi-Fi adapter's driver and AP mode. Test whether it can maintain an AP while joining another Wi-Fi network; if not, document Ethernet/second-adapter use or the client reconnect step.
- Enable SSH for owner administration and recovery, preferably with key-based authentication. The first-run client API remains a separate, narrowly scoped interface; SSH credentials are never entered into the Android or Windows app.

### Alternatives considered

| OS | Assessment for RoverOS |
| --- | --- |
| Ubuntu Server 24.04 LTS amd64 | **Recommended for the first release.** Existing guide and stack already target it; headless install, APT, systemd, and PostgreSQL 16 fit the current setup. Standard maintenance through May 2029 means a later OS upgrade must be planned. |
| Ubuntu Server 26.04 LTS amd64 | Best candidate if a fresh five-year support window through May 2031 is more important than minimizing initial changes. It was released in April 2026; qualify the exact MiniPC, Node.js 22, PostgreSQL 16, NetworkManager, and installation scripts before switching. |
| Debian 13 “trixie” amd64 | Technically suitable and lean, with Debian LTS through June 2030. Not the easiest option: the current guide is Ubuntu-specific and Debian 13 defaults to PostgreSQL 17, so retaining PostgreSQL 16 and the required Node.js runtime needs extra repository/version work. |

The codebase does not identify the MiniPC's exact model or Wi-Fi chipset. Before claiming hardware support, collect `lscpu`, `free -h`, `lsblk`, `lspci -nn`, `lsusb`, and `iw list` output locally or over the owner's SSH session, then test the selected OS on that device. Do not request or store SSH passwords or private keys in the app or plan.

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

| Category | Recommended Ubuntu Server target |
| --- | --- |
| Operating system | Ubuntu Server 24.04 LTS amd64, latest point release, no desktop |
| Network discovery | Avahi and the `RoverOS-Server` DNS-SD record |
| Wi-Fi provisioning | NetworkManager configured before first run; adapter must support the required AP/client mode |
| RoverOS API and web app | Node.js 22.12+ runtime and a prebuilt, verified production artifact |
| Database | PostgreSQL 16 with a local-only listener and tested backup/restore |
| Service management | systemd unit, protected environment file, and a separate restricted provisioning service |
| Administration | OpenSSH Server with key-based owner access; do not expose SSH through the client API |
| Hardware features | Current guide excludes firmware, motor/camera services, and FlyBaby; explicitly classify each as required or optional |

The completed inventory should include versions, supported CPU architecture, disk/RAM requirements, trusted source, signature/checksum policy, and a readiness check for each component. Do not label hardware features “installed” unless their firmware, drivers, permissions, and physical connections are also verified.

## Implementation phases

### Phase 0 — Hardware qualification

- Install the recommended Ubuntu Server 24.04 LTS amd64 image without a desktop environment on the actual MiniPC.
- Record the exact CPU, RAM, storage, Wi-Fi adapter/driver, antenna, and whether Ethernet or a second Wi-Fi radio is available.
- Configure NetworkManager and SSH during local setup; verify SSH recovery before testing AP changes.
- Prototype starting an AP, joining an upstream Wi-Fi network, and maintaining or recovering client access.
- Measure idle and peak memory, disk use, database growth, and update/rollback space with the complete software inventory.
- Approve the required-vs-optional software inventory and signed release source.

**Exit gate:** no app implementation until the OS, resource budget, and Wi-Fi topology are proven on the target hardware.

### Phase 1 — Headless Ubuntu bootstrap

- Prepare an Ubuntu Server image or one-time factory setup that boots into setup mode with a unique AP credential and device pairing identity.
- Enable SSH for owner administration and recovery without putting SSH credentials in the clients.
- Start the systemd provisioning service before the RoverOS application.
- Advertise the stable `RoverOS-Server` identity and expose only setup-status and pairing behavior.
- Provide a documented physical recovery path if Wi-Fi credentials are wrong or the installer loses internet.

### Phase 2 — Provisioning backend and installer

- Implement a durable, idempotent provisioning state machine and safe status/progress API.
- Add encrypted, authenticated Wi-Fi credential submission and OS-specific network configuration.
- Add the signed release-manifest download, verification, pinned APT dependencies, PostgreSQL setup, prebuilt app-artifact installation, service activation, and post-install health checks.
- Add retry and recovery behavior for wrong credentials, no internet, package-source failures, corrupted downloads, reboot, and interrupted installation.

### Phase 3 — Android and Windows onboarding

- Extend both clients to query setup state immediately after automatic discovery.
- Keep ready-state connection behavior unchanged.
- Add the Wi-Fi wizard, pairing, progress, reconnect guidance, retry, and completed states to both clients.
- Ensure no credential is written to app storage or exposed in diagnostics.

### Phase 4 — Validation and release

- Test clean first boot, normal reboot, recovery, update, and factory reset behavior.
- Run on the actual target MiniPC and Wi-Fi hardware, not only an emulator or desktop VM.
- Release the prepared Ubuntu Server bootstrap/provisioning service and client updates together with matching versions and verified artifacts.
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

1. **Hardware qualification:** What exact MiniPC model, RAM, SSD, and Wi-Fi adapter are in use? If unknown, collect the inventory listed above over SSH or locally.
2. **Wi-Fi topology:** Can its adapter host an AP and join the home network simultaneously? If not, is Ethernet or a second adapter available, and may the client need to reconnect manually?
3. **Factory access:** How will the owner obtain each device's unique AP password and pairing identity—printed QR/label, local console, or another method?
4. **Network support:** Should the first version support personal WPA2/WPA3 networks only, or enterprise Wi-Fi as well?
5. **Software scope:** Which firmware, motor-control, camera, and FlyBaby components are required for a “fully working Rover,” and which are optional?
6. **Release source:** Can the MiniPC reach GitHub Releases, and should every installed release be signed by the project?

## References

### Current project files

- `client/src/pages/Setup.tsx` — Android first connection and discovery screen.
- `desktop/main.cjs` and `desktop/setup.html` — Windows discovery and setup screen.
- `server/routes.ts` — current `/api/system/info` identity response; no provisioning-status API exists yet.
- `scripts/setup-minipc-hotspot.sh` — current interactive Ubuntu Server hotspot setup.
- `deploy/avahi/roveros.service` — current RoverOS DNS-SD advertisement.
- `docs/MINIPC_INSTALLATION.md` and `client/src/pages/MiniPcInstallGuide.tsx` — current Ubuntu Server installation guide and software-scope notes.

### Operating-system references

- [Ubuntu Server system requirements](https://documentation.ubuntu.com/server/reference/installation/system-requirements/) — amd64 support and OS-level RAM/storage guidance; these are not full RoverOS requirements.
- [Ubuntu release cycle](https://ubuntu.com/about/release-cycle) — Ubuntu 24.04 and 26.04 LTS support windows.
- [Ubuntu 26.04 LTS release notes](https://documentation.ubuntu.com/release-notes/26.04/) — current newer Ubuntu LTS release.
- [Debian Releases](https://www.debian.org/releases/) and [Debian 13 release announcement](https://www.debian.org/News/2025/20250809) — current stable release and support lifecycle.
