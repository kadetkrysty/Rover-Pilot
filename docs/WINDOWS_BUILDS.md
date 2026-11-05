# Windows build modes

## Shared installer styling

NSIS installers are native Windows dialogs and cannot interpret a CSS file.
Before every `npm run desktop:win`, the `predesktop:win` step reads the real
`client/src/index.css` palette and generates native NSIS colors, RoverOS header
and sidebar bitmaps, and matching installer/uninstaller icons. There is no
separate hand-maintained installer palette.

Generated resources live in the ignored `generated-artifacts/installer-theme/`
directory. Run `npm run desktop:assets` to regenerate them locally. GitHub also
uploads `roveros-windows-installer-theme` for inspection. The native theme
preserves electron-builder's page callbacks, install permissions, signing
checks, update behavior and default handling of user data. Windows security
prompts and some OS-drawn controls retain their system appearance; they are not
HTML controls and do not run the application's CSS.

The NSIS bundle is DPI-aware so Windows does not blur its wizard text. Its
finish-page checkbox also disables themed drawing for that checkbox only,
allowing the configured light text to remain readable against the dark
background.

The web app's Rajdhani, Orbitron, and JetBrains Mono WOFF2 fonts are bundled
locally, rather than fetched from Google Fonts. Windows, Android, and the
MiniPC-hosted app therefore use the same fonts when offline. Their SIL Open
Font License notices are included beside the font files.

## Test installers

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
