import { Capacitor, registerPlugin } from "@capacitor/core";
import { RECORDING_CHUNK_BYTES, RECORDING_MAX_BYTES } from "@shared/recordings";

interface NativeMedia {
  beginSave(options: { fileName: string; mimeType: string; total: number }): Promise<{ id: string }>;
  appendSave(options: { id: string; data: string }): Promise<void>;
  finishSave(options: { id: string }): Promise<void>;
  cancelSave(options: { id: string }): Promise<void>;
}
const media = registerPlugin<NativeMedia>("RoverMedia");

export async function saveRecording(blob: Blob, fileName: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!/^[A-Za-z0-9.TZ -]+-[A-Za-z0-9.TZ-]+\.(mp4|webm)$/.test(fileName) ||
      fileName.length > 200 || blob.size === 0 || blob.size > RECORDING_MAX_BYTES) {
    throw new Error("Invalid video download.");
  }
  if (Capacitor.isNativePlatform()) {
    if (Capacitor.getPlatform() !== "android") throw new Error("Native video export is not supported on this platform.");
    const { id } = await media.beginSave({ fileName, mimeType: blob.type, total: blob.size });
    try {
      for (let offset = 0; offset < blob.size; offset += RECORDING_CHUNK_BYTES) {
        signal?.throwIfAborted();
        const bytes = new Uint8Array(await blob.slice(offset, offset + RECORDING_CHUNK_BYTES).arrayBuffer());
        let raw = "";
        for (let index = 0; index < bytes.length; index += 8192) {
          raw += String.fromCharCode(...Array.from(bytes.subarray(index, index + 8192)));
        }
        await media.appendSave({ id, data: btoa(raw) });
      }
      signal?.throwIfAborted();
      await media.finishSave({ id });
    } catch (error) {
      await media.cancelSave({ id }).catch(() => undefined);
      throw error;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
