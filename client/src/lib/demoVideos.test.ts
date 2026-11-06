import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { demoVideoRecording } from "./demoVideos";

test("the offline demo video is a bundled ten-second 1080p MP4 asset", () => {
  const assetPath = fileURLToPath(
    new URL("../../public/demo/roveros-demo-mars-perseverance.mp4", import.meta.url),
  );
  const asset = readFileSync(assetPath);

  assert.equal(asset.toString("ascii", 4, 8), "ftyp");
  assert.equal(demoVideoRecording.durationSeconds, 10);
  assert.match(demoVideoRecording.fileName, /\.mp4$/);
  assert.equal(demoVideoRecording.url, "/demo/roveros-demo-mars-perseverance.mp4");
  assert.match(demoVideoRecording.description, /AI-generated/);

  // Read the actual MP4 metadata too: changing the label alone must not pass.
  const movieHeader = asset.indexOf(Buffer.from("mvhd"));
  assert.ok(movieHeader > 0, "MP4 movie header exists");
  assert.equal(asset[movieHeader + 4], 0, "expected version-zero movie header");
  const timescale = asset.readUInt32BE(movieHeader + 16);
  const duration = asset.readUInt32BE(movieHeader + 20);
  assert.equal(duration / timescale, demoVideoRecording.durationSeconds);
  const trackHeader = asset.indexOf(Buffer.from("tkhd"));
  assert.ok(trackHeader > 0, "MP4 video track header exists");
  assert.equal(asset[trackHeader + 4], 0, "expected version-zero track header");
  assert.equal(asset.readUInt32BE(trackHeader + 80) / 65536, 1920);
  assert.equal(asset.readUInt32BE(trackHeader + 84) / 65536, 1080);

  const serviceWorker = readFileSync(
    new URL("../../public/service-worker.js", import.meta.url),
    "utf8",
  );
  assert.ok(serviceWorker.includes(demoVideoRecording.url));
});
