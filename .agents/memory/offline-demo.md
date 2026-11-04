---
name: Offline client demo
description: Scope and safety boundary for offline Windows and Android demonstration mode.
---

The connection screen must match the main app and include a footer button named DEMO MODE for using the app offline with dummy data.

**Why:** the user explicitly requested this for the installed clients, which must be usable without a MiniPC.

**How to apply:** package local web assets with Windows as well as Android. Keep demo data separate from real pairing credentials; demo must never send rover commands or weaken normal-operation certificate pinning and authorization. Clearly identify simulated data and provide an exit back to connection setup.
