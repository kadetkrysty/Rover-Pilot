---
name: RoverOS local-network discovery
description: The required MiniPC identity and local-network connection behavior for Android and Windows clients.
---

RoverOS Android and Windows clients should discover and connect to the MiniPC named `RoverOS-Server` without asking users to enter an IP address. Keep the transport on local-network HTTP/WebSockets; Bluetooth is not the client/server transport. The MiniPC may optionally host a Wi-Fi access point, but Android and Windows users must join that network through their OS before the apps can discover it.

**Why:** the user explicitly wants automatic MiniPC discovery without manual IP entry and named the MiniPC `RoverOS-Server`.

**How to apply:** advertise RoverOS on the same trusted local network using mDNS/DNS-SD. Treat hotspot setup as OS-level configuration that must be hardware- and network-manager-aware; do not silently change the MiniPC's network configuration.
