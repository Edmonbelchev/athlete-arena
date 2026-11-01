/**
 * Rules for the camera screen's workout effects: which tone a rep plays, when milestones fire,
 * and how holds (plank) are cued. Kept free of React so they can be unit-tested.
 */

/** Number of rising rep tones (rep-tone-1 .. rep-tone-N). */
export const REP_TONE_COUNT = 8;

/** Holds are cued every this many seconds. */
export const HOLD_CUE_SECONDS = 10;

export type WorkoutMilestone = 'half' | 'finish';

/**
 * Tone for a rep (1-based): climbs from the lowest to the highest tone across the set, so the
 * last rep always plays the top note. Without a target the tones cycle.
 */
export function repToneIndex(rep: number, targetReps: number): number {
  if (rep < 1) {
    return 1;
  }
  if (targetReps <= 0) {
    return ((rep - 1) % REP_TONE_COUNT) + 1;
  }
  if (rep >= targetReps) {
    return REP_TONE_COUNT;
  }
  const progress = (rep - 1) / Math.max(1, targetReps - 1);
  return Math.min(REP_TONE_COUNT, Math.floor(progress * (REP_TONE_COUNT - 1)) + 1);
}

/**
 * The milestone crossed going from `previous` to `next` reps (or seconds held), if any.
 * Halfway needs a target of at least 4 so tiny sets don't celebrate every other rep.
 */
export function milestoneCrossed(previous: number, next: number, targetReps: number): WorkoutMilestone | null {
  if (targetReps <= 0 || next <= previous) {
    return null;
  }
  if (previous < targetReps && next >= targetReps) {
    return 'finish';
  }
  const half = Math.ceil(targetReps / 2);
  if (targetReps >= 4 && previous < half && next >= half) {
    return 'half';
  }
  return null;
}

/** How many hold cues have been earned after `seconds` held. */
export function holdCueCount(seconds: number): number {
  return Math.floor(Math.max(0, seconds) / HOLD_CUE_SECONDS);
}

/** Progress ring colour stage: normal, the last few reps (gold), or done. */
export function progressStage(current: number, target: number): 'normal' | 'closing' | 'done' {
  if (target <= 0) {
    return 'normal';
  }
  if (current >= target) {
    return 'done';
  }
  const remaining = target - current;
  return remaining <= Math.max(3, Math.ceil(target * 0.15)) && current > 0 ? 'closing' : 'normal';
}
