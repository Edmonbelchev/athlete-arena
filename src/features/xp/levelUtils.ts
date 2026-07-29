/** MVP: 500 XP per level. Replace with a progressive curve later. */
export const XP_PER_LEVEL = 500;

export function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) * XP_PER_LEVEL;
}

export function xpProgressInCurrentLevel(totalXp: number): {
  level: number;
  currentLevelXp: number;
  xpToNextLevel: number;
  progress: number;
} {
  const level = calculateLevel(totalXp);
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const currentLevelXp = totalXp - levelStartXp;
  const xpToNextLevel = nextLevelXp - levelStartXp;

  return {
    level,
    currentLevelXp,
    xpToNextLevel,
    progress: xpToNextLevel > 0 ? currentLevelXp / xpToNextLevel : 1,
  };
}
