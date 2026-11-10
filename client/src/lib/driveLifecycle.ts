import type { DriveSource, DriveStatus } from "@shared/drive";

export function shouldActivateAfterArm(
  requestEpoch: number,
  currentEpoch: number,
  invalidated: boolean,
): boolean {
  return requestEpoch === currentEpoch && !invalidated;
}

export function hasConfirmedDriveLease(status: DriveStatus, source: DriveSource): boolean {
  return status.available && status.commissioned && status.serialConnected && status.firmwareReady &&
    status.canDrive && !status.estop &&
    status.armed && status.owned && status.source === source && Boolean(status.lease);
}

export function pageForDriveSource(source: DriveSource): "/" | "/gamepad" | "/flysky" {
  switch (source) {
    case "gamepad": return "/gamepad";
    case "flysky": return "/flysky";
    case "joystick": return "/";
  }
}
