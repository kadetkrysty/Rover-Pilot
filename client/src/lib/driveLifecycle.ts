export function shouldActivateAfterArm(
  requestEpoch: number,
  currentEpoch: number,
  invalidated: boolean,
): boolean {
  return requestEpoch === currentEpoch && !invalidated;
}
