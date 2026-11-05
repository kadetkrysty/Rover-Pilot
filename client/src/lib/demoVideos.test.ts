import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { demoVideoRecording } from "./demoVideos";

test("the offline demo video is a bundled WebM asset", () => {
  const assetPath = fileURLToPath(
    new URL("../../public/demo/roveros-demo-terrain-survey.webm", import.meta.url),
  );
  const asset = readFileSync(assetPath);

  assert.deepEqual(asset.subarray(0, 4), Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  assert.equal(demoVideoRecording.durationSeconds, 6);
  assert.match(demoVideoRecording.fileName, /\.webm$/);
  assert.equal(demoVideoRecording.url, "/demo/roveros-demo-terrain-survey.webm");

  const serviceWorker = readFileSync(
    new URL("../../public/service-worker.js", import.meta.url),
    "utf8",
  );
  assert.ok(serviceWorker.includes(demoVideoRecording.url));
});
