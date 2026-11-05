# Central Google Maps configuration

## Why the old Demo form did not work

Offline Demo deliberately refuses settings writes and external map requests.
Navigation nevertheless displayed a key form with an incorrect "stored locally"
message. In normal mode, its generic configuration request was also rejected
because that API deliberately hides keys/credentials.

The form is now removed from Navigation. Demo Navigation uses the bundled local
sample map. There are no Google requests, keys or settings changes in Demo Mode.

## Configure once on the MiniPC

1. Exit Demo Mode and connect a paired client to **RoverOS-Server**.
2. Open **MAP SETTINGS** in the main menu (`/settings/maps`).
3. Use an **owner-paired** client. Operators/viewers have read-only status.
4. In Google Cloud, create a dedicated **Maps JavaScript browser key**, enable
   billing and **Maps JavaScript API**. For address search, enable **Geocoding API**.
   Places API is not needed by the current address-search implementation.
5. Restrict the key to the APIs used and your actual authorized website origins.
   Configure usage quotas and billing alerts.
6. Enter that restricted browser key in Map Settings, confirm it is intended for
   public client use, and select **Save on MiniPC**.
7. Reload connected clients after adding, replacing or removing the configuration.

The value is stored in the MiniPC database, not per-client local storage or a
compiled frontend environment variable. Clients retrieve it over their existing
paired, certificate-pinned connection. The generic configuration API remains
closed to API keys; a dedicated Maps endpoint exposes only this intentionally
public browser key. Only the owner can replace/remove it.

The form does not prefill existing keys or echo saved keys in write responses.
Maps responses are excluded from application API logs. No key is hardcoded.

## A browser key is not a server secret

Google Maps JavaScript runs in the browser/WebView and must receive its browser
key. Central storage does **not** hide it from client users. Do not use server-side
keys, service-account credentials, private keys or unrestricted/shared-project
credentials. The app cannot inspect the restrictions configured in Google Cloud;
the owner must configure them there.

## Android and Windows restrictions

Use the renderer origin shown on the Map Settings page when checking Google
website restrictions. For HTTP/HTTPS-hosted clients, include the exact scheme,
hostname and port. Discovery by an IP address can give a different origin from a
hostname; do not compensate by authorizing every website.

Google warns that local/custom-scheme WebViews may omit the HTTP referrer needed
for website-restricted keys. The Android packaged WebView and an HTTPS-hosted
Windows page do not necessarily have the same origin or restriction behavior.
Never remove application restrictions merely to make a local WebView work.
Production options are a controlled HTTPS-hosted map surface or an appropriate
native Maps SDK with its own platform/app restrictions.

This change fixes configuration delivery and error handling. It does not add a
native Android Maps SDK or certify Google compatibility with every local origin.

## Troubleshooting and privacy

- **Offline Demo:** uses local artwork; no live satellite maps/address search.
- **Settings unavailable:** connect/pair the installed client; configure with the
  owner, not an unpaired preview.
- **Google authentication/load error:** check billing, enabled APIs, internet access
  and website restrictions in Google Cloud. SDK/network errors and authentication
  failures now show a visible error with reload/settings actions; script loading
  times out after 20 seconds instead of leaving an indefinite loading indicator.
- **Changed key:** reload each connected client to reset the Google SDK.
- Live Maps sends map requests, viewport coordinates, search queries and network
  information to Google. This is not offline navigation. Inform operators and
  review privacy obligations if precise location identifies people in your use.

No actual Google Cloud key, billing configuration or physical native clients were
used to validate this change. Tests cover the central API, pairing/owner access,
input validation and Demo isolation. A real restricted-key device check is still
required before claiming live Google Maps is verified.

Reference: [Google Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices).
