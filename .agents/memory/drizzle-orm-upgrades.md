---
name: Drizzle ORM upgrades
description: npm peer-resolution issues caused by Drizzle's optional drivers in web-only apps.
---

When upgrading Drizzle ORM, inspect its full optional peer dependency set and the peer ranges of installed React renderers before installing. Even a PostgreSQL-only app can encounter React Native or Expo peer resolution through optional Drizzle drivers; resolve compatible React and renderer versions rather than forcing npm to accept an inconsistent tree.

**Why:** Updating Drizzle ORM introduced optional peers requiring React 19.3 while the installed React Three Fiber release only accepted React versions below 19.3, so a staged compatible update was needed.

**How to apply:** Before a Drizzle upgrade, check `npm view drizzle-orm@<version> peerDependencies` and the app's renderer peer ranges; stage related upgrades together when they must align.
