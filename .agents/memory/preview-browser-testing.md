---
name: Preview browser testing
description: Headless CDP navigation limitation observed in this environment.
---

Direct Chromium/CDP navigation returned ERR_ABORTED in this environment even when curl returned the application HTML and the screenshot tool rendered it successfully. Proxy-certificate flags and local host mapping did not resolve it.

**Why:** repeated attempts consumed time without verifying interactions.

**How to apply:** use the supported preview screenshot tool for visual checks and automated unit tests for behavior unless a working interactive browser harness is available. Do not claim click-through or native installer verification from screenshots alone.
