import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { QuestLogCard } from '@/components/challenges/QuestLogCard';
import { WorkoutHistoryCard } from '@/components/history/WorkoutHistoryCard';
import { ChallengeHistoryCard } from '@/components/ui/ChallengeHistoryCard';
import { setSelectedHistoryEntry } from '@/features/history/historyEntryStore';
import {
  isChallengeHistoryEntry,
  isSoloWorkoutHistoryEntry,
  type ActivityHistoryEntry,
} from '@/types/activityHistory';

interface ActivityHistoryCardProps {
  entry: ActivityHistoryEntry;
}

function ActivityHistoryCardContent({ entry }: ActivityHistoryCardProps) {
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

export function ActivityHistoryCard({ entry }: ActivityHistoryCardProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the details for this activity"
      onPress={() => {
        setSelectedHistoryEntry(entry);
        router.push({ pathname: '/profile/history-entry', params: { entryId: entry.entryId } });
      }}
      style={({ pressed }) => (pressed ? styles.pressed : null)}>
      <ActivityHistoryCardContent entry={entry} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
});
