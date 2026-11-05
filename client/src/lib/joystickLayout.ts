/** Fit the entire compass (circle AND labels) into its content slot. */
export function fitJoystick(width: number, height: number, size: number | string = 192) {
  const available = Number.isFinite(width) && Number.isFinite(height)
    ? Math.max(0, Math.min(width, height)) : 0;
  const percentage = typeof size === "string" && /^\d+(?:\.\d+)?%$/.test(size)
    ? Math.min(100, Math.max(0, parseFloat(size))) / 100 : 1;
  const requested = typeof size === "number" && Number.isFinite(size)
    ? Math.max(0, size) + 36 : available * percentage;
  const outerSize = Math.min(available, requested);
  const labelOffset = Math.min(18, outerSize * 18 / 256);
  const diameter = Math.max(0, outerSize - labelOffset * 2);
  return { outerSize, labelOffset, diameter, labelScale: labelOffset / 18 };
}
