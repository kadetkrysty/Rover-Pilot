import test from "node:test";
import assert from "node:assert/strict";
import { decodeRecordingChunk, loadRecordingBlob } from "./recordingApi";
import { RECORDING_CHUNK_BYTES, RECORDING_MAX_BYTES, type RoverRecording } from "../../../shared/recordings";

const entry: RoverRecording = {
  id: "49a69a96-cd37-416d-a97b-d35ce8151200",
  createdAt: "2026-11-05T13:00:00.000Z",
  fileName: "RoverOS-2026-11-05T13-00-00-000Z-49a69a96-cd37-416d-a97b-d35ce8151200.mp4",
  createdBy: "owner", durationSeconds: 10, status: "completed",
  bytes: RECORDING_CHUNK_BYTES + 4,
};

test("loads a video through bounded authenticated chunk requests without media URL tokens", async () => {
  const content = Buffer.alloc(entry.bytes, 42);
  const offsets: number[] = [];
  const progress: number[] = [];
  const blob = await loadRecordingBlob(entry, (percent) => progress.push(percent), new AbortController().signal,
    async (url) => {
      assert.match(url, /^\/api\/recordings\/[a-f0-9-]+\/chunks\/[0-9]+$/);
      const offset = Number(url.split("/").pop());
      offsets.push(offset);
      return Response.json({
        offset, total: entry.bytes, fileName: entry.fileName,
        data: content.subarray(offset, offset + RECORDING_CHUNK_BYTES).toString("base64"),
      });
    });
  assert.deepEqual(offsets, [0, RECORDING_CHUNK_BYTES]);
  assert.equal(progress.at(-1), 100);
  assert.equal(blob.type, "video/mp4");
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), content);
});

test("rejects oversized, interrupted, malformed and canceled video transfers", async () => {
  const controller = new AbortController();
  controller.abort();
  const unexpectedFetch = async () => { throw new Error("must not fetch"); };
  await assert.rejects(loadRecordingBlob(entry, () => {}, controller.signal, unexpectedFetch));
  await assert.rejects(loadRecordingBlob({ ...entry, bytes: RECORDING_MAX_BYTES + 1 }, () => {},
    new AbortController().signal, unexpectedFetch));
  assert.throws(() => decodeRecordingChunk({
    offset: 0, total: entry.bytes, fileName: entry.fileName, data: "%%%bad%%%",
  }, entry, 0));
  assert.throws(() => decodeRecordingChunk({
    offset: 0, total: entry.bytes, fileName: entry.fileName, data: "AAAA",
  }, entry, 0), /incomplete/);
  await assert.rejects(loadRecordingBlob(entry, () => {}, new AbortController().signal,
    async () => new Response("revoked", { status: 401 })), /pairing/);
});
