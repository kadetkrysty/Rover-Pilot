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
2. Keep the MiniPC and Windows computer on the same trusted local network.
3. Install and open RoverOS on Windows.
4. Enter the MiniPC address, for example `http://192.168.1.40:5000`.
5. To change it later, choose **RoverOS → Change MiniPC address**.

The server listens on port `5000` by default. If the MiniPC uses another port,
enter that port in the address.

The Windows app is a client: it makes outbound requests to the MiniPC and does
not host an inbound server. Windows normally needs no inbound firewall rule. If
an organization blocks outbound LAN access, its administrator must allow RoverOS
to reach the chosen MiniPC address and port.

## Network security

Do not expose the MiniPC server directly to the public internet. The current API
has rover-control routes that do not require authentication. Keep it on a
trusted local network until server-side authentication is in place; use a VPN
for remote access.
