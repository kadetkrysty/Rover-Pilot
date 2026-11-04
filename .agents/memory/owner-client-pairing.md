---
name: Owner client pairing
description: Credential separation between first-run setup and normal RoverOS client enrollment.
---

Never reuse the first-run Wi-Fi setup pairing code for normal-operation owner enrollment. The owner enrollment credential must be generated separately and consumed once; subsequent clients are added and revoked by the owner.

**Why:** the user explicitly required that normal client authorization not reuse the revoked first-run pairing code.

**How to apply:** keep setup and normal-operation enrollment as separate credential flows when changing RoverOS provisioning, TLS, or client authorization.
