import type { DriveStatus } from "@shared/drive";

export interface GamepadDriveSample {
  connected: boolean;
  standard: boolean;
  throttle: number;
  steering: number;
  deadman: boolean;
  neutralAndReleased: boolean;
}

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function readGamepadDriveSample(gamepad: Gamepad | null): GamepadDriveSample {
  if (!gamepad || !gamepad.connected) {
    return { connected: false, standard: false, throttle: 0, steering: 0, deadman: false, neutralAndReleased: false };
  }
  if (gamepad.mapping !== "standard" || gamepad.axes.length < 4 || gamepad.buttons.length <= 5) {
    return { connected: true, standard: false, throttle: 0, steering: 0, deadman: false, neutralAndReleased: false };
  }
  const throttle = clamp(-(gamepad.axes[1] ?? 0));
  const steering = clamp(gamepad.axes[2] ?? 0);
  const deadman = Boolean(gamepad.buttons[5]?.pressed);
  const neutralAndReleased = Math.abs(throttle) < 0.08 && Math.abs(steering) < 0.08 && !deadman;
  return { connected: true, standard: true, throttle, steering, deadman, neutralAndReleased };
}

export function isFlyskyArmReady(receiver: DriveStatus["receiver"]): boolean {
  const channels = receiver?.channels ?? [];
  return Boolean(receiver?.connected && !receiver.failsafe && receiver.ageMs <= 250 &&
    channels.length >= 5 && Math.abs(channels[0] - 1500) < 40 &&
    Math.abs(channels[2] - 1500) < 40 && channels[4] >= 1700);
}
