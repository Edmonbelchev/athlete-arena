import { describe, expect, it } from '@jest/globals';

import {
  REP_TONE_COUNT,
  holdCueCount,
  milestoneCrossed,
  progressStage,
  repToneIndex,
} from '@/features/workouts/workoutEffects';

describe('rep tones', () => {
  it('climb across the set, from the lowest tone to the top tone on the last rep', () => {
    for (const target of [1, 3, 5, 8, 10, 20, 50, 100]) {
      const tones = Array.from({ length: target }, (_, index) => repToneIndex(index + 1, target));
      if (target > 1) {
        expect(tones[0]).toBe(1);
      }
      expect(tones[target - 1]).toBe(REP_TONE_COUNT);
      tones.forEach((tone, index) => {
        expect(tone).toBeGreaterThanOrEqual(1);
        expect(tone).toBeLessThanOrEqual(REP_TONE_COUNT);
        if (index > 0) {
          expect(tone).toBeGreaterThanOrEqual(tones[index - 1]);
        }
      });
    }
  });

  it('stays on the top tone past the target and cycles without one', () => {
    expect(repToneIndex(25, 20)).toBe(REP_TONE_COUNT);
    expect(repToneIndex(1, 0)).toBe(1);
    expect(repToneIndex(REP_TONE_COUNT + 1, 0)).toBe(1);
  });
});

describe('milestones', () => {
  it('fires halfway once and finish once', () => {
    const fired = [];
    for (let rep = 1; rep <= 25; rep += 1) {
      const milestone = milestoneCrossed(rep - 1, rep, 20);
      if (milestone) {
        fired.push([rep, milestone]);
      }
    }
    expect(fired).toEqual([
      [10, 'half'],
      [20, 'finish'],
    ]);
  });

  it('rounds odd halves up and skips halfway on tiny sets', () => {
    expect(milestoneCrossed(7, 8, 15)).toBe('half');
    expect(milestoneCrossed(1, 2, 3)).toBeNull();
    expect(milestoneCrossed(2, 3, 3)).toBe('finish');
  });

  it('handles jumps (holds tick seconds; several reps can land at once) and no target', () => {
    expect(milestoneCrossed(25, 31, 60)).toBe('half');
    expect(milestoneCrossed(55, 62, 60)).toBe('finish');
    expect(milestoneCrossed(3, 4, 0)).toBeNull();
    expect(milestoneCrossed(5, 5, 10)).toBeNull();
  });
});

describe('holds and progress', () => {
  it('cues a hold every 10 seconds', () => {
    expect([0, 9, 10, 19, 20, 61].map(holdCueCount)).toEqual([0, 0, 1, 1, 2, 6]);
  });

  it('turns gold for the last few reps and green when done', () => {
    expect(progressStage(0, 10)).toBe('normal');
    expect(progressStage(6, 10)).toBe('normal');
    expect(progressStage(7, 10)).toBe('closing');
    expect(progressStage(10, 10)).toBe('done');
    expect(progressStage(84, 100)).toBe('normal');
    expect(progressStage(85, 100)).toBe('closing');
  });
});
