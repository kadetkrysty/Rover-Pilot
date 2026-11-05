---
name: Google Maps configuration
description: Central MiniPC ownership, intentionally public browser keys and native WebView restrictions.
---

Configure Maps once on the MiniPC, through the owner settings page, rather than
storing a separate key in each client.

**Why:** the user explicitly requested central configuration instead of per-client
key entry. Demo must remain offline and must not solicit/save real Maps keys.

**How to apply:** clients consume MiniPC-managed Maps settings. Demo uses bundled
sample artwork, never the live SDK.

Keep generic API-key/credential configuration blocked. A dedicated, paired Maps
endpoint may expose only an intentionally public, restricted Maps JavaScript
browser key, with owner-only writes and explicit public-use confirmation.

**Why:** browser Maps necessarily receives its browser key, but that is not
permission to expose server credentials or whitelist all API keys.

**How to apply:** explain the public-key distinction and Google Cloud restrictions.
Do not put server/service-account credentials in this configuration.

Do not work around native WebView referrer failures by removing Google application
restrictions.

**Why:** Google documents that local/custom schemes can omit the referrer required
by website-restricted keys. Android native-app restrictions require an appropriate
native SDK, not merely a JavaScript key inside a WebView.

**How to apply:** use a controlled HTTPS map surface or design native Maps SDK
integration with platform-specific restrictions. Verify actual renderer origins.
