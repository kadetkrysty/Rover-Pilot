# RoverOS Windows client

The Windows installer is a desktop client for a RoverOS server running on the
MiniPC. It does not install the RoverOS server or PostgreSQL on the Windows
computer.

## Build the installer

Push the project to GitHub and run the **Windows desktop app** workflow. After
it succeeds, download the `roveros-windows-installer` artifact from that
workflow run. It contains a Windows x64 NSIS installer (`.exe`).

## Connect to the MiniPC

1. Start the RoverOS server on the MiniPC and make sure it can reach its
   PostgreSQL database through `DATABASE_URL`.
2. Keep the MiniPC and Windows computer on the same trusted local network.
3. Install and open RoverOS on Windows.
4. Enter the MiniPC address, for example `http://192.168.1.40:5000`.
5. To change it later, choose **RoverOS → Change MiniPC address**.

The server listens on port `5000` by default. If the MiniPC uses another port,
enter that port in the address.

## Network security

Do not expose the MiniPC server directly to the public internet. The current API
has rover-control routes that do not require authentication. Keep it on a
trusted local network until server-side authentication is in place; use a VPN
for remote access.
