---
name: Runtime media assets
description: Keep bundled application media outside ignored upload directories.
---

Keep runtime-imported media in application-owned asset directories, not the upload folder.

**Why:** files force-tracked under the ignored upload folder disappeared from Git during later checkpoint/merge preparation, while local copies remained. Local builds passed but all clean GitHub builds failed.

**How to apply:** move required small static images into tracked client assets and import them there. Check Git tracking before relying on successful local builds. Keep user uploads and large generated assets separate.
