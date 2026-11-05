---
name: Firmware tooling constraints
description: Replit-specific Arduino CLI verification limitation.
---

The Nix Arduino CLI package's FHS/bwrap launcher can fail in this Replit
environment with a capabilities error even though its underlying CLI binary
and AVR compiler work. This is not evidence of a sketch compilation failure.

**Why:** the wrapper failed before CLI startup; invoking the installed underlying
binary allowed a real Mega 2560 AVR compilation to succeed.

**How to apply:** distinguish launcher/container errors from compiler errors.
Use the official Ubuntu CI firmware job for repeatable builds; do not add
containers or repeatedly retry the FHS wrapper. Discover tool paths rather than
hardcoding a previous session's Nix store hash.
