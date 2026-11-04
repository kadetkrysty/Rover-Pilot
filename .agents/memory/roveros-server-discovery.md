---
name: RoverOS local-network discovery
description: The required MiniPC identity and local-network connection behavior for Android and Windows clients.
---

RoverOS Android and Windows clients should discover and connect to the MiniPC named `RoverOS-Server` without asking users to enter an IP address. The MiniPC is expected to ship with Ubuntu Core before RoverOS is installed. On first connection, clients should check provisioning state; if setup is incomplete, the client collects Wi-Fi credentials and the MiniPC installs its trusted software stack. Ubuntu Server APT/systemd installation instructions are not automatically compatible with Ubuntu Core. Keep the transport on local-network HTTP/WebSockets; Bluetooth is not the client/server transport. The MiniPC may host a Wi-Fi access point, but Android and Windows users must join that network through their OS before the apps can discover it.

**Why:** the user explicitly wants automatic MiniPC discovery without manual IP entry, named the MiniPC `RoverOS-Server`, and stated that factory devices start with Ubuntu Core and need first-run Wi-Fi and software provisioning.

**How to apply:** advertise RoverOS on the same trusted local network using mDNS/DNS-SD. For Ubuntu Core, plan a Core-compatible preinstalled provisioning service/image; do not assume an APT shell installer or silently change the MiniPC's network configuration. Treat hotspot setup as hardware- and network-manager-aware.
