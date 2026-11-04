# Offline demo

Select **DEMO MODE** in the connection screen footer to explore RoverOS without
a MiniPC. Windows and Android use the locally bundled dashboard, sample
telemetry, simulated camera view, lidar readings and an offline sample map.
No database or network connection is required for the installed clients.

The **DEMO MODE** banner stays visible. **EXIT DEMO** returns to the connection
screen. Existing MiniPC addresses and paired-client credentials are preserved.

This is a view-only demonstration: rover commands and configuration writes are
blocked, not forwarded or reported as successful real changes. Features that
require live services are unavailable. GPS data is a fixed sample, not the
device's location. Normal discovery, certificate pinning and client pairing are
unchanged outside demo mode.

Rebuild the client installers after changing this feature. Windows packaging
must include `dist/public/**/*`; the Windows workflow already builds these
assets before packaging. Android gets them through its normal Capacitor sync.
Opening a browser-hosted demo still requires loading or caching that website;
the independent offline guarantee applies to the installed native clients.
