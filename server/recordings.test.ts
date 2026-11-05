import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RecordingService, cameraRecordingSource, recordingFileName } from "./recordings";
import { RECORDING_CHUNK_BYTES } from "../shared/recordings";

const run = promisify(execFile);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("camera input is server configuration, never an arbitrary local file or command", () => {
  assert.equal(cameraRecordingSource({} as NodeJS.ProcessEnv), "");
  assert.equal(cameraRecordingSource({ ROVER_HOST: "rover.local" }), "http://rover.local:8081/camera/stream");
  for (const url of ["file:///etc/passwd", "concat:http://x|file:///etc/passwd", "ftp://host/video", "not-a-url"]) {
    assert.throws(() => cameraRecordingSource({ IMOU_CAMERA_STREAM_URL: url }));
  }
  assert.equal(cameraRecordingSource({ IMOU_CAMERA_STREAM_URL: "rtsp://camera.local/live" }), "rtsp://camera.local/live");
});

test("captures an HTTP camera, finalizes MP4, transfers bounded chunks and deletes it", { timeout: 30000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "rover-recordings-"));
  const { stdout: jpeg } = await run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-i", "client/public/demo/roveros-demo-terrain-survey.webm",
    "-frames:v", "1", "-c:v", "mjpeg", "-threads", "1", "-f", "image2pipe", "pipe:1",
  ], { encoding: "buffer", maxBuffer: 1024 * 1024 });
  const camera = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "multipart/x-mixed-replace; boundary=frame", Connection: "close" });
    const frame = () => {
      res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`);
      res.write(jpeg);
      res.write("\r\n");
    };
    frame();
    const timer = setInterval(frame, 40);
    res.on("close", () => clearInterval(timer));
  });
  await new Promise<void>((resolve) => camera.listen(0, "127.0.0.1", resolve));
  const address = camera.address() as { port: number };
  const service = new RecordingService(directory, () => `http://127.0.0.1:${address.port}/stream`);
  try {
    const entry = await service.start(randomUUID());
    assert.equal(entry.status, "starting");
    await assert.rejects(service.start(randomUUID()), /already in progress/);
    await assert.rejects(service.delete(entry.id), /Stop the recording/);
    let active;
    for (let attempt = 0; attempt < 50; attempt++) {
      active = (await service.status()).active;
      if (active?.status === "recording" && active.durationSeconds > 0) break;
      await pause(150);
    }
    assert.equal(active?.status, "recording");
    const completed = await service.stop();
    assert.equal(completed.status, "completed", completed.error);
    assert.ok(completed.bytes > 0);
    assert.ok(completed.durationSeconds > 0);
    const media = path.join(directory, `${entry.id}.mp4`);
    assert.equal((await stat(media)).mode & 0o777, 0o600);
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_streams", "-of", "json", media]);
    const streams = JSON.parse(stdout).streams;
    assert.equal(streams.length, 1, "No microphone or camera audio is captured.");
    assert.equal(streams[0].codec_name, "h264");
    const chunks = [];
    for (let offset = 0; offset < completed.bytes; offset += RECORDING_CHUNK_BYTES) {
      const chunk = await service.chunk(entry.id, offset);
      assert.equal(chunk.total, completed.bytes);
      assert.ok(chunk.data.length < 1024 * 1024);
      chunks.push(Buffer.from(chunk.data, "base64"));
    }
    assert.deepEqual(Buffer.concat(chunks), await readFile(media));
    await assert.rejects(service.chunk("../../etc/passwd", 0), /Invalid recording ID/);
    await assert.rejects(service.chunk(entry.id, 1), /Invalid recording offset/);
    assert.ok(!JSON.stringify(await service.status()).includes(`127.0.0.1:${address.port}`));
    await service.delete(entry.id);
    assert.deepEqual((await service.status()).recordings, []);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await service.shutdown();
    camera.closeAllConnections();
    await new Promise<void>((resolve) => camera.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("marks interrupted recordings as failed and expires old footage", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "rover-recordings-recovery-"));
  try {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await writeFile(path.join(directory, `${id}.mp4`), "partial");
    await writeFile(path.join(directory, `${id}.json`), JSON.stringify({
      id, createdAt, fileName: recordingFileName(id, createdAt), createdBy: "owner",
      status: "recording", durationSeconds: 0, bytes: 0,
    }));
    const service = new RecordingService(directory, () => "");
    const current = await service.status();
    assert.equal(current.recordings[0].status, "failed");
    assert.equal(current.recordings[0].bytes, 7);
    await assert.rejects(service.chunk(id, 0), /Completed recording not found/);
    await assert.rejects(service.start("owner"), /Configure the rover camera/);
    const old = { ...current.recordings[0], createdAt: new Date(Date.now() - 8 * 86400000).toISOString() };
    old.fileName = recordingFileName(id, old.createdAt);
    await writeFile(path.join(directory, `${id}.json`), JSON.stringify(old));
    assert.deepEqual((await service.status()).recordings, []);
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
