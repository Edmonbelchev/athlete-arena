import { QuestLogCard } from '@/components/challenges/QuestLogCard';
import { WorkoutHistoryCard } from '@/components/history/WorkoutHistoryCard';
import { ChallengeHistoryCard } from '@/components/ui/ChallengeHistoryCard';
import {
  isChallengeHistoryEntry,
  isSoloWorkoutHistoryEntry,
  type ActivityHistoryEntry,
} from '@/types/activityHistory';

interface ActivityHistoryCardProps {
  entry: ActivityHistoryEntry;
}

export function ActivityHistoryCard({ entry }: ActivityHistoryCardProps) {
  if (isSoloWorkoutHistoryEntry(entry)) {
    return <WorkoutHistoryCard entry={entry} />;
  }

  if (entry.category === 'daily_quest') {
    return <QuestLogCard entry={entry} />;
  }

  if (isChallengeHistoryEntry(entry)) {
    return <ChallengeHistoryCard entry={entry} />;
  }

  return null;
}
