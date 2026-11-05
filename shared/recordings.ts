export const RECORDING_CHUNK_BYTES = 192 * 1024;
export const RECORDING_MAX_BYTES = 32 * 1024 * 1024;
export const RECORDING_MAX_SECONDS = 120;
export const RECORDING_RETENTION_DAYS = 7;
export const RECORDING_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

export interface RoverRecording {
  id: string;
  fileName: string;
  createdAt: string;
  createdBy: string;
  status: "starting" | "recording" | "completed" | "failed";
  durationSeconds: number;
  bytes: number;
  error?: string;
}

export interface RecordingLibrary {
  recordings: RoverRecording[];
  active: RoverRecording | null;
  cameraConfigured: boolean;
  available: boolean;
  canRecord: boolean;
  canDelete: boolean;
  usedBytes: number;
  quotaBytes: number;
  retentionDays: number;
  maxSeconds: number;
  maxBytes: number;
  source: string;
}
