import { readFile } from "node:fs/promises";

const DEFAULT_STATE_FILE = "/var/lib/roveros-provisioner/state.json";
const states = new Set([
  "setup_required",
  "wifi_connecting",
  "installing",
  "failed",
  "ready",
]);

export interface ProvisioningStatus {
  service: "RoverOS";
  rover_name: "RoverOS-Server";
  state: string;
  stage: string;
  progress: number;
  message: string;
  errorCode?: string;
  updatedAt?: string;
}

export async function getProvisioningStatus(): Promise<ProvisioningStatus> {
  const file = process.env.ROVEROS_PROVISIONING_STATE_FILE || DEFAULT_STATE_FILE;
  let raw: string;

  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        service: "RoverOS",
        rover_name: "RoverOS-Server",
        state: "ready",
        stage: "complete",
        progress: 100,
        message: "RoverOS is ready.",
      };
    }
    throw error;
  }

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") {
    throw new Error("Provisioning state is not a JSON object.");
  }

  const state = value as Record<string, unknown>;
  if (
    typeof state.state !== "string" ||
    !states.has(state.state) ||
    typeof state.stage !== "string" ||
    typeof state.progress !== "number" ||
    !Number.isFinite(state.progress) ||
    state.progress < 0 ||
    state.progress > 100 ||
    typeof state.message !== "string" ||
    state.message.length > 160
  ) {
    throw new Error("Provisioning state contains invalid public status fields.");
  }

  const result: ProvisioningStatus = {
    service: "RoverOS",
    rover_name: "RoverOS-Server",
    state: state.state,
    stage: state.stage,
    progress: state.progress,
    message: state.message,
  };

  if (typeof state.errorCode === "string" && /^[A-Z_]{1,40}$/.test(state.errorCode)) {
    result.errorCode = state.errorCode;
  }
  if (typeof state.updatedAt === "string" && state.updatedAt.length <= 40) {
    result.updatedAt = state.updatedAt;
  }
  return result;
}
