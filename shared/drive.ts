import { z } from "zod";

export const driveSourceSchema = z.enum(["joystick", "gamepad", "flysky"]);
export type DriveSource = z.infer<typeof driveSourceSchema>;
export const driveActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select"), source: driveSourceSchema }).strict(),
  z.object({ action: z.literal("arm"), neutral: z.literal(true) }).strict(),
  z.object({ action: z.literal("frame"), source: driveSourceSchema, lease: z.string().uuid(),
    sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    throttle: z.number().finite().min(-1).max(1), steering: z.number().finite().min(-1).max(1) }).strict(),
  z.object({ action: z.literal("stop") }).strict(),
  z.object({ action: z.literal("estop") }).strict(),
  z.object({ action: z.literal("reset") }).strict(),
]);
export type DriveAction = z.infer<typeof driveActionSchema>;
export const driveStatusSchema = z.object({
  available: z.boolean(), commissioned: z.boolean(), serialConnected: z.boolean(), firmwareReady: z.boolean(),
  source: driveSourceSchema.nullable(), armed: z.boolean(), estop: z.boolean(),
  owned: z.boolean(), canDrive: z.boolean(), canReset: z.boolean(),
  lease: z.string().uuid().nullable(), reason: z.string().max(300),
  imu: z.object({ valid: z.boolean(), ageMs: z.number().nonnegative(), yaw: z.number().finite(),
    pitch: z.number().finite(), roll: z.number().finite(), reference: z.literal("relative") }).nullable(),
  receiver: z.object({ connected: z.boolean(), channels: z.array(z.number().int().min(800).max(2200)).max(10),
    ageMs: z.number().nonnegative(), failsafe: z.boolean() }).nullable(),
  output: z.object({ throttle: z.number().finite(), steering: z.number().finite() }),
});
export type DriveStatus = z.infer<typeof driveStatusSchema>;
export function unavailableDriveStatus(reason = "MiniPC motor-control service is unavailable."): DriveStatus {
  return { available: false, commissioned: false, serialConnected: false, firmwareReady: false,
    source: null, armed: false, estop: false, owned: false, canDrive: false, canReset: false, lease: null,
    reason, imu: null, receiver: null, output: { throttle: 0, steering: 0 } };
}
