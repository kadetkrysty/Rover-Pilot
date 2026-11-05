import { z } from "zod";
import { roverFetch } from "./roverConnection";
import { isDemoMode } from "./demoMode";
import {
  RECORDING_CHUNK_BYTES, RECORDING_MAX_BYTES, type RoverRecording,
} from "@shared/recordings";

const recordingSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().max(200).regex(/^RoverOS-[A-Za-z0-9.TZ-]+\.mp4$/),
  createdAt: z.string().datetime(),
  createdBy: z.string().max(100),
  status: z.enum(["starting", "recording", "completed", "failed"]),
  durationSeconds: z.number().finite().min(0).max(150),
  bytes: z.number().int().min(0).max(RECORDING_MAX_BYTES),
  error: z.string().max(300).optional(),
});

const librarySchema = z.object({
  recordings: z.array(recordingSchema).max(200),
  active: recordingSchema.nullable(),
  cameraConfigured: z.boolean(), available: z.boolean(),
  canRecord: z.boolean(), canDelete: z.boolean(),
  usedBytes: z.number().finite().nonnegative(),
  quotaBytes: z.number().finite().positive(),
  retentionDays: z.number().int().positive(),
  maxSeconds: z.number().int().positive(),
  maxBytes: z.number().int().positive().max(RECORDING_MAX_BYTES),
  source: z.string().max(128),
});

async function request(path: string, method = "GET") {
  if (isDemoMode()) throw new Error("Real recordings are disabled in Demo Mode.");
  const response = await roverFetch(path, {
    method, ...(method === "POST" ? { body: "{}", headers: { "Content-Type": "application/json" } } : {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : "The MiniPC recording request failed.");
  }
  return response;
}

export async function getRecordingLibrary() {
  return librarySchema.parse(await (await request("/api/recordings")).json());
}
export async function startServerRecording() {
  return recordingSchema.parse(await (await request("/api/recordings/start", "POST")).json());
}
export async function stopServerRecording() {
  return recordingSchema.parse(await (await request("/api/recordings/stop", "POST")).json());
}
export async function deleteServerRecording(id: string) {
  z.string().uuid().parse(id);
  await request(`/api/recordings/${id}`, "DELETE");
}

export function decodeRecordingChunk(value: unknown, entry: RoverRecording, offset: number): Uint8Array {
  const chunk = z.object({
    data: z.string().max(4 * Math.ceil(RECORDING_CHUNK_BYTES / 3)).regex(/^[A-Za-z0-9+/]*={0,2}$/),
    offset: z.literal(offset),
    total: z.literal(entry.bytes),
    fileName: z.literal(entry.fileName),
  }).parse(value);
  const raw = atob(chunk.data);
  const expected = Math.min(RECORDING_CHUNK_BYTES, entry.bytes - offset);
  if (raw.length !== expected || expected <= 0) throw new Error("The MiniPC returned an incomplete video chunk.");
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function loadRecordingBlob(
  recording: RoverRecording,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
  fetcher = roverFetch,
): Promise<Blob> {
  if (isDemoMode()) throw new Error("Real recordings are disabled in Demo Mode.");
  const entry = recordingSchema.parse(recording);
  if (entry.status !== "completed" || entry.bytes === 0) throw new Error("This recording is not ready for playback.");
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < entry.bytes; offset += RECORDING_CHUNK_BYTES) {
    signal.throwIfAborted();
    const response = await fetcher(`/api/recordings/${entry.id}/chunks/${offset}`);
    signal.throwIfAborted();
    if (!response.ok) throw new Error("Video transfer failed. Check the MiniPC connection and device pairing.");
    chunks.push(decodeRecordingChunk(await response.json(), entry, offset));
    onProgress(Math.round(Math.min(offset + RECORDING_CHUNK_BYTES, entry.bytes) / entry.bytes * 100));
  }
  signal.throwIfAborted();
  return new Blob(chunks, { type: "video/mp4" });
}
