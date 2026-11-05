# OpenStreetMap: requirements, setup and client operation

## Why this integration

RoverOS needs a live rover marker, zoom/pan, map clicks for adding waypoints,
draggable numbered waypoints, route lines and manual location search. Leaflet
provides those interactions without Google's JavaScript SDK or browser keys.
The same bundled renderer runs in the MiniPC web app and Windows/Android clients.
Native clients identify themselves as RoverOS in their User-Agent.

The ACEPC AK1 with 8 GB RAM does not need a tile-rendering server or planet-wide
geocoding database. Tiles are loaded directly by clients; the MiniPC handles only
small settings records and occasional cached address searches.

## Setup once on RoverOS-Server

1. Install the updated server and client releases and pair the owner device.
2. Exit Demo Mode and open **MAP SETTINGS** (`/settings/maps`).
3. Standard OpenStreetMap tiles and manual Photon search are enabled by default.
   No API key, Google Cloud account or billing setup is required.
4. The owner can disable live tiles/search, or select a different public HTTPS
   OSM-derived tile template. Supply `{z}`, `{x}`, `{y}` in the URL.
   Private addresses, credentials, URL query parameters and fragments are rejected.
5. Add any extra provider attribution required by its terms. OSM copyright remains
   visible automatically; extra provider credits are rendered as plain text.
6. Save on the MiniPC. Other paired viewing clients read the same settings.
   Open pages refresh their settings on refocus or reload.

Owners alone can write these settings. Operators/viewers can read them. Rover
devices are denied. The generic configuration and backup/restore paths cannot
bypass the owner-only Maps API. Existing Google keys are ignored and remain
protected; revoke unused Google keys separately in Google Cloud.

## Navigation

Click the map to add a waypoint. Drag a numbered marker to move it; routes continue
to use the existing route save/load and navigation APIs. Start is green and the
last waypoint is red. The cyan path joins the rover and waypoints directly.
It is **not** an automatically calculated road route or an obstacle-safe path.
Standard OSM tiles are street/cartographic maps, **not satellite imagery**.

Search is explicit, using the Search button or Enter, never autocomplete.
Enter `latitude, longitude` for local coordinate lookup without a search-provider
request, including valid zero coordinates. An address is sent through the paired,
pinned MiniPC API to Photon's public demo service. The first validated result
centers the map; click to add the desired waypoint.

The MiniPC sends no client token/cookies/pairing credentials to Photon. Requests
are fixed-origin, time/response-size bounded, limited to five results, serialized
and throttled to at most one new upstream request per 1.1 seconds per server.
Normalized successful queries are cached for ten minutes (up to 200 entries).
No address query is placed in the RoverOS request URL or response logs.

## Connectivity, privacy and service policies

- Clients need internet access for map tiles; the MiniPC needs internet for
  address searches. Being connected only to an isolated rover access point does
  not by itself provide internet.
- Tile requests expose viewport tile coordinates, IP/network information and
  normal browser-origin information to the selected provider. Photon receives
  submitted address text and the MiniPC's network information. Do not submit
  confidential/personal addresses without an appropriate basis.
- Keep visible © OpenStreetMap contributors attribution. OSM data is under ODbL;
  the Leaflet library is BSD-2-Clause and its type definitions are MIT.
- Public OSM tiles and Photon are community/demo services, with no uptime SLA.
  Heavy use can be blocked. Use an appropriate hosted provider or separately
  provisioned infrastructure for larger deployments.
- Browser/WebView HTTP caching is left enabled. Do not add cache-bypassing
  headers, bulk downloads, background prefetch or “download area” features.
- Do not point the public OSM tile server at an offline-map downloader.
  Real offline maps require a separately licensed/provider-approved dataset.
- There is no dependency on the public Nominatim API.

Policies:
[OSM tiles](https://operations.osmfoundation.org/policies/tiles/),
[Photon demo service](https://github.com/komoot/photon),
[OSM copyright](https://www.openstreetmap.org/copyright).

## Demo and errors

Offline Demo displays bundled local sample artwork. It does not load tile images,
read/write real map settings, send address queries, request geolocation or issue
real rover commands. It is not an offline map of the current location.

Missing MiniPC settings/pairing, disabled tiles, tile load failure, invalid search,
throttling, disabled search and upstream failure have explicit messages.
If tiles fail, check the client's internet access and the configured provider;
retry manually. If address search is unavailable, coordinate lookup still works.

## Verification boundaries

Automated checks cover settings authorization/validation, generic-config bypass
protection, Demo network isolation, coordinate parsing and the Photon gateway's
bounded responses, caching, errors and throttle. TypeScript and production builds
must pass. Native device interaction and an installed MiniPC remain separate
hardware validation; no check should claim they passed without running them.
