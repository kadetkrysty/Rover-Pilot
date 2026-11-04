---
name: MiniPC updater privilege boundary
description: Security and test-environment constraints for invoking privileged maintenance from the RoverOS app.
---

Keep `NoNewPrivileges=true` on the RoverOS application service. Owner-authorized host maintenance should be started through a local, group-restricted systemd socket and a fixed root-owned handler; do not grant the app general sudo access or disable privilege escalation protections.

**Why:** the app runs as the `roveros` user and processes network requests. `sudo` cannot elevate when `NoNewPrivileges` is active, while disabling that protection broadens the impact of an app compromise. In the workspace test environment, `/var/tmp` is read-only, so updater tests need an isolated temporary work-directory override.

**How to apply:** keep authorization in the API before connecting to the local socket, and keep the root handler limited to starting one fixed unit. When testing the updater, direct its temporary downloads into the test fixture rather than `/var/tmp`.
