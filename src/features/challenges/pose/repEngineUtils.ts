export interface AngleThresholdConfig {
  high: number;
  low: number;
  hysteresis: number;
}

/** Returns true when angle is clearly in the "high" (extended/standing) zone. */
export function isInHighZone(angle: number, config: AngleThresholdConfig): boolean {
  return angle >= config.high - config.hysteresis;
}

/** Relaxed extension check for hang between reps (far / low camera angles). */
export function isInHangZone(
  angle: number,
  config: AngleThresholdConfig,
  extraSlack = 0,
): boolean {
  return angle >= config.high - config.hysteresis - extraSlack;
}

/** Returns true when angle is clearly in the "low" (flexed/bottom) zone. */
export function isInLowZone(angle: number, config: AngleThresholdConfig): boolean {
  return angle <= config.low + config.hysteresis;
}

/** Returns true when angle is in the transitional band between high and low. */
export function isInMidZone(angle: number, config: AngleThresholdConfig): boolean {
  return !isInHighZone(angle, config) && !isInLowZone(angle, config);
}
