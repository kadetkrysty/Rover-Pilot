---
name: Rover recording transport
description: Why MiniPC recordings use authenticated chunks and private sidecars rather than public video URLs.
---

Keep real recording capture on the MiniPC. The client-device camera is preview-only;
selecting it must never redirect rover capture to the phone/PC camera or microphone.
Demo playback must remain separate from real recording APIs.

**Why:** the rover camera and the client's camera are different sources. A previous
prototype mixed local device recording with simulated server recording indicators.

**How to apply:** record the server-configured rover source and show server-confirmed
capture state, never an independently running "REC" timer.

Preserve certificate pinning and authorization on media transfers. Native bridges
deliberately carry bounded JSON; a video element pointed directly at the MiniPC
cannot attach those bridge credentials or verify its certificate pin.

**Why:** public/signed media URLs or plain network video tags would bypass the
existing native security boundary. Bounded completed clips can be assembled locally
without widening that boundary or buffering arbitrarily large files.

**How to apply:** transfer authenticated bounded chunks and play a local Blob URL.
If adding true long-duration streaming, design its native pinned transport first;
do not merely replace this with an unauthenticated media URL.

Keep video metadata alongside private media files, outside versioned app releases.

**Why:** file deletion, retention, crash recovery and backups should operate on media
and metadata together; a separate database migration is unnecessary for this store.

**How to apply:** preserve the media state directory across updates and back up both
video and metadata. Do not move it into immutable release directories.
