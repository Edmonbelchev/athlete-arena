/** Level 1 → 2 costs 500 XP; each level after that needs 50 XP more than the previous one. */
export const BASE_XP_PER_LEVEL = 500;
export const XP_LEVEL_INCREMENT = 50;

/** Total XP required to reach the start of `level`. */
export function xpForLevel(level: number): number {
  if (level <= 1) {
    return 0;
  }

  const completedLevelUps = level - 1;
  return completedLevelUps * (BASE_XP_PER_LEVEL + (XP_LEVEL_INCREMENT * (completedLevelUps - 1)) / 2);
}

/** XP needed to advance from `level` to `level + 1`. */
export function xpRequiredForLevel(level: number): number {
  return BASE_XP_PER_LEVEL + Math.max(level - 1, 0) * XP_LEVEL_INCREMENT;
}

export function calculateLevel(totalXp: number): number {
  const xp = Math.max(totalXp, 0);
  let level = 1;

  while (xpForLevel(level + 1) <= xp) {
    level += 1;
  }

  return level;
}

export function xpProgressInCurrentLevel(totalXp: number): {
  level: number;
  currentLevelXp: number;
  xpToNextLevel: number;
  progress: number;
} {
  const level = calculateLevel(totalXp);
  const levelStartXp = xpForLevel(level);
  const currentLevelXp = totalXp - levelStartXp;
  const xpToNextLevel = xpRequiredForLevel(level);

  return {
    level,
    currentLevelXp,
    xpToNextLevel,
    progress: xpToNextLevel > 0 ? currentLevelXp / xpToNextLevel : 1,
  };
}
