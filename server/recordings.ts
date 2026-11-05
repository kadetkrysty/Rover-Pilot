import { spawn, execFile, type ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import {
  RECORDING_CHUNK_BYTES, RECORDING_MAX_BYTES, RECORDING_MAX_SECONDS,
  RECORDING_QUOTA_BYTES, RECORDING_RETENTION_DAYS, type RoverRecording,
} from "../shared/recordings";

const run = promisify(execFile);
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function cameraRecordingSource(env = process.env): string {
  const value = env.ROVEROS_RECORDING_STREAM_URL || env.IMOU_CAMERA_STREAM_URL ||
    (env.ROVER_HOST ? `http://${env.ROVER_HOST}:8081/camera/stream` : "");
  if (!value) return "";
  const url = new URL(value);
  if (!["http:", "https:", "rtsp:", "rtsps:"].includes(url.protocol) ||
      !url.hostname || url.hash || value.length > 2048) {
    throw new Error("The configured camera source must be an HTTP(S) or RTSP(S) stream.");
  }
  return value;
}

export function recordingFileName(id: string, createdAt: string): string {
  return `RoverOS-${createdAt.replace(/[:.]/g, "-")}-${id}.mp4`;
}

export class RecordingService {
  readonly directory: string;
  private initialized?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private active?: {
    entry: RoverRecording; child: ChildProcess; done: Promise<void>;
    started: number; frames: boolean;
  };
  private stopping = false;
  private availability?: { checked: number; value: boolean };
  private storageFailure = false;

  constructor(
    directory = process.env.ROVEROS_RECORDINGS_DIR || "/var/lib/roveros/recordings",
    private source = () => cameraRecordingSource(),
  ) {
    this.directory = path.resolve(directory);
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private mediaPath(id: string): string {
    if (!ID.test(id)) throw new Error("Invalid recording ID.");
    return path.join(this.directory, `${id}.mp4`);
  }

  private async save(entry: RoverRecording): Promise<void> {
    const target = path.join(this.directory, `${entry.id}.json`);
    await fs.writeFile(`${target}.tmp`, JSON.stringify(entry), { mode: 0o600 });
    await fs.rename(`${target}.tmp`, target);
  }

  private async entries(): Promise<RoverRecording[]> {
    const names = await fs.readdir(this.directory);
    const entries: RoverRecording[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const id = name.slice(0, -5);
      if (!ID.test(id)) continue;
      const handle = await fs.open(path.join(this.directory, name), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if ((await handle.stat()).size > 8192) throw new Error("Recording metadata is invalid.");
        const entry = JSON.parse(await handle.readFile("utf8")) as RoverRecording;
        if (entry.id !== id || !Number.isFinite(Date.parse(entry.createdAt)) ||
            entry.fileName !== recordingFileName(id, entry.createdAt) ||
            !["starting", "recording", "completed", "failed"].includes(entry.status) ||
            !Number.isFinite(entry.bytes) || entry.bytes < 0 ||
            !Number.isFinite(entry.durationSeconds) || entry.durationSeconds < 0 ||
            typeof entry.createdBy !== "string") throw new Error("Recording metadata is invalid.");
        entries.push(entry);
      } finally { await handle.close(); }
    }
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private initialize(): Promise<void> {
    return this.initialized ||= (async () => {
      await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
      await fs.chmod(this.directory, 0o700);
      const entries = await this.entries();
      for (const entry of entries) {
        if (entry.status === "starting" || entry.status === "recording") {
          let size = 0;
          try { size = (await fs.stat(this.mediaPath(entry.id))).size; } catch { /* Missing media is a failed recording. */ }
          await this.save({ ...entry, bytes: size, status: "failed", error: "Server restarted before recording completed." });
        }
      }
      const indexed = new Set(entries.map((entry) => entry.id));
      for (const name of await fs.readdir(this.directory)) {
        const id = name.endsWith(".mp4") ? name.slice(0, -4) : "";
        if (!ID.test(id) || indexed.has(id)) continue;
        const info = await fs.lstat(this.mediaPath(id));
        if (!info.isFile()) throw new Error("Recording storage contains an invalid media file.");
        const createdAt = info.mtime.toISOString();
        await this.save({
          id, createdAt, createdBy: "recovered", fileName: recordingFileName(id, createdAt),
          bytes: info.size, durationSeconds: 0, status: "failed",
          error: "An interrupted recording was recovered without its metadata.",
        });
      }
    })().catch((error) => { this.initialized = undefined; throw error; });
  }

  private async remove(entry: RoverRecording) {
    await fs.rm(this.mediaPath(entry.id), { force: true });
    await fs.rm(path.join(this.directory, `${entry.id}.json`), { force: true });
  }

  private async cleanup() {
    const entries = await this.entries();
    let used = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    let count = entries.length;
    for (const entry of [...entries].reverse()) {
      if (entry.id === this.active?.entry.id) continue;
      if (Date.parse(entry.createdAt) < Date.now() - RECORDING_RETENTION_DAYS * 86400000 ||
          used > RECORDING_QUOTA_BYTES - RECORDING_MAX_BYTES || count >= 200) {
        await this.remove(entry);
        used -= entry.bytes;
        count--;
      }
    }
  }

  private async ffmpegAvailable() {
    if (this.availability && Date.now() - this.availability.checked < 60000) return this.availability.value;
    let value = false;
    try { await run("ffmpeg", ["-version"], { timeout: 3000, maxBuffer: 65536 }); value = true; } catch { /* Report unavailable. */ }
    this.availability = { checked: Date.now(), value };
    return value;
  }

  async status() {
    return this.serialize(async () => {
      await this.initialize();
      if (this.storageFailure) throw new Error("The MiniPC could not save recording metadata.");
      await this.cleanup();
      let cameraConfigured = false;
      try { cameraConfigured = Boolean(this.source()); } catch { /* Invalid admin configuration is not exposed. */ }
      const available = await this.ffmpegAvailable();
      if (this.active) {
        this.active.entry.bytes = (await fs.stat(this.mediaPath(this.active.entry.id))).size;
      }
      const recordings = (await this.entries()).map((entry) =>
        entry.id === this.active?.entry.id ? { ...this.active.entry } : entry);
      return {
        recordings, active: this.active?.entry || null, cameraConfigured, available,
        usedBytes: recordings.reduce((sum, entry) => sum + entry.bytes, 0),
        quotaBytes: RECORDING_QUOTA_BYTES, retentionDays: RECORDING_RETENTION_DAYS,
        maxSeconds: RECORDING_MAX_SECONDS, maxBytes: RECORDING_MAX_BYTES,
        source: "Configured rover camera (video only)",
      };
    });
  }

  async start(createdBy: string) {
    return this.serialize(async () => {
      await this.initialize();
      if (this.stopping) throw new Error("Server is shutting down.");
      if (this.active) throw new Error("A recording is already in progress.");
      const source = this.source();
      if (!source) throw new Error("Configure the rover camera stream before recording.");
      if (!await this.ffmpegAvailable()) throw new Error("FFmpeg is missing. Install the MiniPC recording dependencies.");
      await this.cleanup();
      const disk = await fs.statfs(this.directory);
      if (disk.bavail * disk.bsize < 1024 * 1024 * 1024) {
        throw new Error("At least 1 GiB of free MiniPC disk space is required.");
      }
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const entry: RoverRecording = {
        id, createdAt, createdBy, fileName: recordingFileName(id, createdAt),
        status: "starting", durationSeconds: 0, bytes: 0,
      };
      const destination = this.mediaPath(id);
      // Precreate private output: FFmpeg must not create world-readable camera footage.
      const output = await fs.open(destination, "wx", 0o600);
      await output.close();
      await this.save(entry);
      const args = [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        ...(/^rtsps?:/.test(source)
          ? ["-rtsp_transport", "tcp", "-timeout", "15000000"]
          : ["-rw_timeout", "15000000"]),
        "-i", source, "-map", "0:v:0", "-an",
        "-vf", "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=15",
        "-c:v", "libx264", "-preset", "ultrafast", "-threads", "2",
        "-profile:v", "baseline", "-level:v", "3.1",
        "-pix_fmt", "yuv420p", "-b:v", "1000k", "-maxrate", "1200k",
        "-bufsize", "2000k", "-t", String(RECORDING_MAX_SECONDS),
        "-fs", String(RECORDING_MAX_BYTES - 1024 * 1024),
        "-movflags", "+faststart", "-progress", "pipe:1", destination,
      ];
      const child = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "ignore"] });
      let finish!: () => void;
      const done = new Promise<void>((resolve) => { finish = resolve; });
      const session = { entry, child, done, started: Date.now(), frames: false };
      this.active = session;
      let progress = "";
      let finalized = false;
      let timedOut = false;
      let duration = 0;
      let forcedKill: NodeJS.Timeout | undefined;
      const terminateTimedOut = () => {
        timedOut = true;
        child.kill("SIGINT");
        forcedKill = setTimeout(() => child.kill("SIGKILL"), 10000);
      };
      child.stdout?.on("data", (chunk: Buffer) => {
        progress += chunk.toString();
        const lines = progress.split("\n");
        progress = lines.pop()?.slice(-1024) || "";
        for (const line of lines) {
          if (line.startsWith("out_time_us=")) {
            const seconds = Number(line.slice(12)) / 1000000;
            if (Number.isFinite(seconds) && seconds > 0) {
              session.frames = true;
              duration = seconds;
              entry.status = "recording";
              entry.durationSeconds = seconds;
            }
          }
        }
      });
      const timeout = setTimeout(terminateTimedOut, (RECORDING_MAX_SECONDS + 30) * 1000);
      const startupTimeout = setTimeout(() => {
        if (!session.frames) terminateTimedOut();
      }, 20000);
      const finalize = async (code: number | null) => {
        if (finalized) return;
        finalized = true;
        clearTimeout(timeout);
        clearTimeout(startupTimeout);
        if (forcedKill) clearTimeout(forcedKill);
        try {
          const size = (await fs.stat(destination)).size;
          entry.bytes = size;
          entry.durationSeconds = Math.min(RECORDING_MAX_SECONDS, duration);
          if (session.frames && size > 0 && size <= RECORDING_MAX_BYTES &&
              (code === 0 || code === 255) && !timedOut) {
            try {
              const { stdout } = await run("ffprobe", [
                "-v", "error", "-show_entries", "format=duration", "-of", "json", destination,
              ], { timeout: 5000, maxBuffer: 65536 });
              const actualDuration = Number(JSON.parse(stdout).format?.duration);
              if (!Number.isFinite(actualDuration) || actualDuration <= 0 || actualDuration > RECORDING_MAX_SECONDS + 2) {
                throw new Error("Invalid recorded video duration.");
              }
              entry.durationSeconds = actualDuration;
              entry.status = "completed";
            } catch {
              entry.status = "failed";
              entry.error = "The camera video did not finalize into a playable MP4.";
            }
          } else {
            entry.status = "failed";
            entry.error = "Camera recording failed or timed out. Check the configured stream and FFmpeg.";
          }
          await this.save(entry);
        } catch {
          this.storageFailure = true;
          entry.status = "failed";
          entry.error = "The MiniPC could not save the recording.";
        } finally {
          if (this.active === session) this.active = undefined;
          finish();
        }
      };
      child.once("error", () => { void finalize(null); });
      child.once("close", (code) => { void finalize(code); });
      return { ...entry };
    });
  }

  async stop() {
    // Do not hold the mutation queue while waiting for FFmpeg's final MP4 flush.
    const session = this.active;
    if (!session) throw new Error("No recording is in progress.");
    session.child.kill("SIGINT");
    const kill = setTimeout(() => session.child.kill("SIGKILL"), 10000);
    try { await session.done; return { ...session.entry }; }
    finally { clearTimeout(kill); }
  }

  async delete(id: string) {
    return this.serialize(async () => {
      this.mediaPath(id);
      await this.initialize();
      if (this.active?.entry.id === id) throw new Error("Stop the recording before deleting it.");
      const entry = (await this.entries()).find((item) => item.id === id);
      if (!entry) throw new Error("Recording not found.");
      await this.remove(entry);
    });
  }

  async chunk(id: string, offset: number) {
    this.mediaPath(id);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset % RECORDING_CHUNK_BYTES !== 0) {
      throw new Error("Invalid recording offset.");
    }
    await this.initialize();
    const entry = (await this.entries()).find((item) => item.id === id);
    if (!entry || entry.status !== "completed") throw new Error("Completed recording not found.");
    const handle = await fs.open(this.mediaPath(id), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const { size } = await handle.stat();
      if (size !== entry.bytes || size > RECORDING_MAX_BYTES || offset >= size) {
        throw new Error("Recording size or offset is invalid.");
      }
      const buffer = Buffer.alloc(Math.min(RECORDING_CHUNK_BYTES, size - offset));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (bytesRead !== buffer.length) throw new Error("Recording read was interrupted.");
      return { data: buffer.toString("base64"), offset, total: size, fileName: entry.fileName };
    } finally { await handle.close(); }
  }

  async shutdown() {
    this.stopping = true;
    await this.queue;
    if (this.active) await this.stop();
  }
}
