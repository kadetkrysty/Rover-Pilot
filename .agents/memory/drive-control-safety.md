---
name: Drive-control safety boundary
description: Why control authority is MiniPC-owned and motion requires explicit commissioning.
---

Keep client-facing drive authorization in the paired, pinned Node service;
hardware control must stay on a private local transport, not a second public
Python control API. Source selection must stop/disarm rather than implicitly
arm or silently take over an active operator. Motion stays disabled until the
physical system has been deliberately commissioned.

**Why:** investigation found that the previous web motor endpoint only returned
simulated success, while a separate Python controller exposed unauthenticated
motor routes and competed for the web server's port. Enabling UI motion against
either path would have misrepresented control or bypassed pairing.

**How to apply:** retain exclusive source/lease checks and independent timeouts
when adding inputs or autonomy. Software tests cannot replace wheels-raised
verification of the installed Feru configuration, radio failsafe and physical
power disconnect. Never describe software E-STOP as a safety-rated physical stop.
