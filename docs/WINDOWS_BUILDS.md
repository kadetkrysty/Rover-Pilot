# Windows build modes

Normal pushes, pull requests, and manual runs with the default options build
an **unsigned test installer**. Download `roveros-windows-unsigned-test` from
the successful Windows desktop app run's Artifacts section.

The installer is named `RoverOS-Test-UNSIGNED-<version>-x64.exe` and includes
an `UNSIGNED-TEST-BUILD.txt` warning. It installs as **RoverOS Test**, with a
different app identity, shortcuts and user-data directory from production.
It must not be described or distributed as a trusted signed release.

Unsigned builds may show Windows SmartScreen or antivirus warnings. Do not
disable security software to get around those warnings. Successful CI only
verifies packaging; it does not guarantee security-software acceptance or
hardware connectivity.

## Signed production installer

Run **Windows desktop app → Run workflow** and enable
`build_signed_release`. This mode requires the GitHub Actions secrets
`WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`, containing an appropriate trusted
code-signing PFX certificate and its password. Add these through GitHub's
repository Actions secrets settings, not chat or source files.

The production build requires code signing and verifies Authenticode trust
and a trusted timestamp on both RoverOS.exe and the installer before uploading
`roveros-windows-installer`. Missing signing configuration remains a hard
failure in this mode. No self-signed certificate or silent unsigned fallback
is used.
