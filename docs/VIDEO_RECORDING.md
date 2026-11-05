# RoverOS MiniPC recording and shared playback

## Capture source and setup

The **MiniPC**, not the Android/Windows client, runs FFmpeg and records the rover
camera. The phone/PC camera and microphone are not recorded. `DEVICE CAM` is a
client preview only. Demo Mode plays its bundled sample and never captures video.

The source is selected from server-controlled configuration, in this order:

1. `ROVEROS_RECORDING_STREAM_URL` — recommended for a private RTSP(S) recording
   source, especially if its URL contains camera credentials.
2. `IMOU_CAMERA_STREAM_URL` — the existing camera stream setting.
3. `http://<ROVER_HOST>:8081/camera/stream` — the rover camera bridge.

The source must actually expose HTTP(S) MJPEG or RTSP(S) video. A camera model name
alone is not a usable stream address; some battery cameras do not expose RTSP.
No client can submit arbitrary URLs, filesystem paths or FFmpeg commands.
The new recording API never returns the source URL or its credentials.

The initial MiniPC installation and release updater install Ubuntu's `ffmpeg`
package. For an existing installation, install it with:

```sh
sudo apt update
sudo apt install -y ffmpeg
sudoedit /etc/roveros.env
sudo systemctl restart roveros
```

Set the recording source in that root-protected environment file. Do not commit
camera passwords or the environment file to GitHub. Keep the normal certificate
and device-pairing setup in place; recordings are not exposed over cleartext HTTP.

## Controls and shared access

- **Owner/operator:** start or stop rover capture from **VIDEO RECORDINGS**.
- **Gamepad:** Circle starts the same MiniPC recorder; Square stops and finalizes
  it. Recording status comes from the server, not a simulated timer.
- **Paired owner/operator/viewer:** list, play and export saved clips.
- **Owner only:** permanently delete shared clips, after confirmation.
- One recording runs at a time across all clients.

Starting transitions through `starting` to `recording` after FFmpeg produces
frames. Stopping finalizes the MP4 before playback/export is enabled. Camera
failures are marked `failed`; a red indicator is not treated as proof of a saved
file. In-progress clips interrupted by a server crash are marked failed at the
next service startup. Graceful service shutdown attempts to finalize the clip.

## Storage and names

Default MiniPC directory: **`/var/lib/roveros/recordings`**.

- `<UUID>.mp4`: video data.
- `<UUID>.json`: atomically written metadata, creator-device ID, UTC creation time,
  capture state, duration and size.
- Export name: `RoverOS-<UTC timestamp>-<UUID>.mp4`, for example
  `RoverOS-2026-11-05T14-30-00-000Z-<UUID>.mp4`.

The directory is private (`0700`) and videos/metadata are private (`0600`).
The service's systemd `StateDirectory=roveros` permits this directory without
relaxing `NoNewPrivileges` or the read-only application release directory.
Updates replace app code, not this media directory.

Video metadata is stored alongside the files, **not in PostgreSQL**. This keeps
media backup/deletion/recovery together and needs no database migration. Back up
both file types if retaining the library. `ROVEROS_RECORDINGS_DIR` can override
the location, but it must remain writable within the service's systemd sandbox.

## Resource and retention limits

- Video-only H.264 MP4; no audio.
- Up to 1280×720, 15 fps, approximately 1 Mbit/s, two encoding threads.
- Each clip stops automatically after **120 seconds** or around **32 MiB**.
- At least **1 GiB free disk space** is required to begin.
- **7-day retention**, **2 GiB quota**, and a **200-clip limit**. Cleanup runs when
  the library is checked and before recording starts. Oldest clips are removed
  to reserve space for new capture. Export important footage before it expires.

These are conservative defaults for the ACEPC AK1; actual camera capture and CPU
use still need qualification on that MiniPC. The app does not perform continuous,
unbounded recording or silently send video to a cloud service.

## Android/Windows transport, player and export

The existing native bridges accept JSON responses up to 1 MiB and verify the
MiniPC's exact TLS certificate. Video transfers preserve that boundary:

1. A paired client requests the shared recording list over pinned HTTPS.
2. The client loads a completed clip in **192 KiB binary chunks**, encoded as
   bounded base64 JSON. Authorization/revocation is checked on every request.
3. The client validates IDs, offsets, total size and chunk lengths, assembles at
   most one 32 MiB clip, and gives a local Blob URL to the HTML video player.
4. Native controls support pause, seeking and fullscreen after loading.
5. Android Export uses the system document picker and writes bounded chunks to
   the chosen destination; no broad storage permission is required (API 24+).
   Windows/browser export uses the client's download destination.

There are no bearer tokens in video URLs, public media directories, or unpinned
video requests. A canceled transfer stops fetching further chunks. URLs and
buffers are released when the player is closed or its page unmounts.

Relevant APIs, all requiring a currently paired device over secure transport:

```text
GET    /api/recordings
POST   /api/recordings/start
POST   /api/recordings/stop
GET    /api/recordings/:id/chunks/:offset
DELETE /api/recordings/:id
```

## Privacy and verification

Footage may identify people or reveal private spaces. Record only where
authorized, review applicable privacy/notice obligations, and obtain privacy/legal
review before collecting identifiable people in EU deployments. The app records
no microphone audio, sends no footage to third parties, and excludes media
responses from API logs. Filesystem permissions protect local access; they are
**not disk encryption**. Use Ubuntu/LUKS disk encryption for sensitive footage.
Deleting a server clip does not delete copies already exported by clients.

`npm run test:recordings` exercises actual FFmpeg capture from a synthetic HTTP
camera, MP4 finalization/decoding, chunk reconstruction, role enforcement, restart
recovery and retention. Client tests verify transfer validation and cancellation.
The server GitHub workflow installs FFmpeg and runs these tests. Real Imou/RTSP
hardware, native Android export and Windows playback must also be checked on
their target devices before declaring a production camera installation verified.
