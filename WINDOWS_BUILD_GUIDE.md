# RoverOS Windows client

The Windows installer is a desktop client for a RoverOS server running on the
MiniPC. It does not install the RoverOS server or PostgreSQL on the Windows
computer.

## Build the installer

The GitHub workflow signs both the packaged RoverOS executable and the NSIS
installer, verifies their Authenticode signatures, then uploads the installer.
Pull requests still run build and validation checks, but do not package or
upload a signed installer because GitHub does not expose signing secrets to
forked pull requests.

### Set up code signing once

You need a valid Authenticode code-signing certificate from a trusted certificate
authority, with its private key exported as a password-protected `.pfx` file.
A self-signed certificate will not establish publisher trust. Do not commit the
PFX file or share it in chat.

In GitHub, open **Settings → Secrets and variables → Actions** and add:

- `WIN_CSC_LINK`: the base64-encoded contents of the PFX certificate.
- `WIN_CSC_KEY_PASSWORD`: the PFX password.

On Windows, copy the encoded certificate directly to the clipboard without
printing it in the terminal:

```powershell
$pfxBytes = [System.IO.File]::ReadAllBytes("C:\secure\RoverOS-signing.pfx")
[Convert]::ToBase64String($pfxBytes) | Set-Clipboard
```

The workflow will fail rather than publish an unsigned installer if either
secret is missing or the signature/timestamp cannot be validated. Protect access
to the signing secrets and use them only in trusted workflow runs.

### Run a signed build

After adding the secrets, push a trusted branch or run the **Windows desktop
app** workflow manually. Download the `roveros-windows-installer` artifact from
the successful workflow run. It contains a signed Windows x64 installer
(`.exe`).

Code signing shows users the verified publisher and helps establish reputation,
but a new app can still receive a Microsoft SmartScreen warning until it builds
reputation. Signing cannot guarantee that every antivirus or firewall will
allow the app, and this project does not disable security software or install
firewall exclusions.

Microsoft notes that newly signed apps can still show SmartScreen warnings
until the publisher or file gains reputation. Learn more in the
[Microsoft SmartScreen reputation guide](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
and [electron-builder's Windows signing guide](https://www.electron.build/v26/features/code-signing/code-signing-win/).

## Connect to the MiniPC

1. Start the RoverOS server on the MiniPC and make sure it can reach its
   PostgreSQL database through `DATABASE_URL`.
2. Set the MiniPC hostname and advertised service name to
   `RoverOS-Server`, and keep it and Windows on the same trusted local network.
3. Install and open RoverOS on Windows. The client checks
   `http://roveros-server.local:5000` and verifies that the server identifies as
   RoverOS before opening the client.
4. If discovery fails, connect Windows to the same Wi-Fi/LAN (or the MiniPC
   hotspot) and select **Search again**. The client does not ask for an IP.

The server listens on port `5000` by default. Windows local-network name
resolution must be allowed by the network and security policy.

The Windows app is a client: it makes outbound requests to the MiniPC and does
not host an inbound server. Windows normally needs no inbound firewall rule. If
an organization blocks outbound LAN access, its administrator must allow RoverOS
to reach `roveros-server.local` on port `5000`.

## Network security

Do not expose the MiniPC server directly to the public internet. The current API
has rover-control routes that do not require authentication. Keep it on a
trusted local network until server-side authentication is in place; use a VPN
for remote access.
