# Offline demo recording

`roveros-demo-mars-perseverance.mp4` is AI-generated illustrative footage of a
Perseverance-style rover navigating Mars-like terrain. It is not NASA mission
footage, a live camera feed, or a recording captured by the user's rover.

- Landscape 16:9, 1920 × 1080, H.264/yuv420p MP4, silent.
- Exactly 10 seconds at 24 frames per second (240 frames).
- Generated as an eight-second 1080p shot, then slowed to ten seconds.
- Compressed to approximately 3.2 MiB with the MP4 index at the beginning for
  prompt playback. The small, intentionally bundled asset is included in web,
  Windows and Android builds; it does not require the MiniPC or internet.
- The service worker precaches it for web offline playback after a successful
  initial cache installation. Android and Windows ship it locally.

The large generated master and intermediate previews belong in the ignored
`generated-artifacts/` directory, not Git history or app packages.
