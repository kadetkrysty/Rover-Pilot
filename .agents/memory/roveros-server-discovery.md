---
name: RoverOS provisioning and discovery
description: The headless Ubuntu Server target, first-run Wi-Fi onboarding, and client discovery behavior.
---

RoverOS Android and Windows clients should discover and connect to the MiniPC named `RoverOS-Server` without asking users to enter an IP address. The MiniPC should use a headless Ubuntu Server installation with no desktop environment and be accessible to its owner over SSH. Ubuntu Server 24.04 LTS amd64 is the recommended first target because the current RoverOS installation guide and PostgreSQL 16/Node.js 22 stack already target it. On first connection, clients should check provisioning state; if setup is incomplete, the client collects Wi-Fi credentials and the MiniPC installs its trusted software stack. Normal operation uses local-network HTTP/WebSockets; sensitive provisioning uses authenticated, certificate-pinned HTTPS. Bluetooth is not the client/server transport. The MiniPC may host a Wi-Fi access point, but Android and Windows users must join that network through their OS before the apps can discover it.

**Why:** the user clarified that “Ubuntu Core” means a minimal Ubuntu installation without a desktop, wants owner SSH access, and asked for the easiest compatible Ubuntu version. The existing project guide targets Ubuntu Server 24.04 LTS with PostgreSQL 16 and Node.js 22.

**How to apply:** advertise RoverOS on the same trusted local network using mDNS/DNS-SD. Use a prepared headless Ubuntu Server image and a preinstalled systemd provisioning service; configure NetworkManager deliberately for Wi-Fi onboarding and do not switch network managers over SSH. Verify the exact MiniPC RAM, storage, CPU, and AP-capable Wi-Fi adapter before declaring hardware support.

The owner specified **ACEPC AK1, 8 GB RAM configuration** and approved building RoverOS releases in GitHub Actions and installing prebuilt artifacts instead of compiling on the low-power MiniPC. Storage and Wi-Fi revision remain unverified.

**Why:** the owner supplied this model and explicitly approved the prebuilt-release recommendation.

**How to apply:** keep development/Android/Windows build toolchains off the MiniPC; qualify the actual adapter and storage before claiming hardware compatibility.
