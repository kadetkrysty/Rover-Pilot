---
name: Maps provider policy
description: Central MiniPC map ownership, OpenStreetMap service constraints and offline Demo.
---

Use OpenStreetMap rather than Google Maps; manage map settings centrally on the
MiniPC, not independently in each client.

**Why:** the user requested replacing Google Maps and previously required central
configuration rather than per-device key entry.

**How to apply:** do not reintroduce Google key entry or SDK requirements. Keep
owner-only settings writes, client pairing/pinning and the generic config/restore
restriction together; no alternate write path should bypass owner control.

Preserve offline Demo isolation and comply with community service policies.

**Why:** public OSM tiles prohibit bulk/offline downloading and are best effort.
The public Nominatim policy is not suitable as an automatically generated generic
geocoder. The ACEPC AK1 8 GB target should not host a planet-wide geocoder.

**How to apply:** keep attribution visible and browser caching enabled, identify
native apps, avoid prefetch/download features, and use explicit low-volume search
only. Document any switch to a dedicated provider or licensed offline dataset.
