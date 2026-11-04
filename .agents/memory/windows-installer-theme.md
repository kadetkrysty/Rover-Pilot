---
name: Windows installer theme
description: Shared CSS palette for native Windows installer and uninstaller branding.
---

Use the main app's CSS as the installer palette source rather than maintaining a separate set of colors.

**Why:** the user explicitly requested the same CSS and design assets for installation and uninstallation. NSIS renders native Win32 dialogs and cannot load browser CSS, so generation from that CSS is the bridge; do not claim that NSIS runs the stylesheet.

**How to apply:** regenerate native theme resources for every Windows build. Keep electron-builder's installation, uninstallation, permission, update and signing behavior intact when changing presentation. OS security prompts must remain controlled by Windows.
