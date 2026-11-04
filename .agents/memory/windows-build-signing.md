---
name: Windows build signing
description: User-approved separation between unsigned test installers and trusted signed production releases.
---

Unsigned Windows test installers are allowed. Keep them clearly labelled and separate from signed production releases.

**Why:** the user chose “Build unsigned test installers” after being told that trusted signing credentials were absent. They had previously requested code-signed installers.

**How to apply:** ordinary build validation may produce unsigned test artifacts; do not silently weaken production signing requirements or claim that signing prevents all antivirus/firewall warnings.
