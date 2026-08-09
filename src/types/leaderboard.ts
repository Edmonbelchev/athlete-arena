import type { AppIconName } from '@/constants/icons';
import type { ShopAvatarDisplay, ShopFrameDisplay } from '@/types/shop';

export type LeaderboardPeriod = 'weekly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  level: number;
  xpAmount: number;
  avatarUrl: string | null;
  avatar: ShopAvatarDisplay | null;
  frame: ShopFrameDisplay | null;
  isCurrentUser: boolean;
}

export function getLeaderboardPeriodLabel(period: LeaderboardPeriod): string {
  return period === 'weekly' ? 'This week' : 'All time';
}

export function getLeaderboardPeriodSubtitle(period: LeaderboardPeriod): string {
  if (period === 'all_time') {
    return 'Ranked by total experience points';
  }

  return 'Ranked by XP earned this week · Resets every Monday (UTC)';
}

export function getRankAccentColor(rank: number): string | null {
  if (rank === 1) {
    return '#F59E0B';
  }

  if (rank === 2) {
    return '#94A3B8';
  }

  if (rank === 3) {
    return '#D97706';
  }

  return null;
}

export function getRankIcon(rank: number): AppIconName | null {
  if (rank === 1) {
    return 'crown';
  }

  if (rank <= 3) {
    return 'medal';
  }

  return null;
}
