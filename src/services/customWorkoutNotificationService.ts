import {
  workoutShareNotificationId,
  type ChallengeNotification,
  type WorkoutNotificationType,
} from '@/features/notifications/types';
import { getCustomWorkoutTemplateDetail, getMyCustomWorkoutTemplates } from '@/services/customWorkoutService';
import { getWorkoutSharerDisplayName } from '@/types/customWorkouts';

interface NotificationCopy {
  title: string;
  message: string;
  templateId: string;
}

export function buildWorkoutShareNotificationCopy(input: {
  templateTitle: string;
  sharerName: string;
  templateId: string;
}): NotificationCopy {
  return {
    templateId: input.templateId,
    title: 'Workout shared with you',
    message: `${input.sharerName} shared "${input.templateTitle}" with you`,
  };
}

export async function buildWorkoutShareNotificationCopyFromShare(
  templateId: string,
): Promise<NotificationCopy | null> {
  try {
    const detail = await getCustomWorkoutTemplateDetail(templateId);
    const sharerName = detail.creatorDisplayName ?? detail.creatorUsername;

    return buildWorkoutShareNotificationCopy({
      templateId,
      templateTitle: detail.title,
      sharerName,
    });
  } catch {
    return null;
  }
}

function getActiveWorkoutShareNotificationIds(
  sharedTemplates: Awaited<ReturnType<typeof getMyCustomWorkoutTemplates>>,
): Set<string> {
  return new Set(
    sharedTemplates
      .filter((template) => !template.isOwner)
      .map((template) => workoutShareNotificationId(template.templateId)),
  );
}

export async function syncWorkoutShareNotifications(
  existing: ChallengeNotification[],
  _currentUserId: string,
): Promise<ChallengeNotification[]> {
  try {
    const workoutExisting = existing.filter((notification) => notification.type === 'workout_shared');
    const otherExisting = existing.filter((notification) => notification.type !== 'workout_shared');

    const templates = await getMyCustomWorkoutTemplates();
    const sharedTemplates = templates.filter((template) => !template.isOwner);
    const activeIds = getActiveWorkoutShareNotificationIds(sharedTemplates);
    const keptExisting = workoutExisting.filter(
      (notification) => activeIds.has(notification.id) || notification.read,
    );
    const knownIds = new Set(keptExisting.map((notification) => notification.id));
    const mergedWorkout = [...keptExisting];

    for (const template of sharedTemplates) {
      const type = 'workout_shared' as WorkoutNotificationType;
      const stableId = workoutShareNotificationId(template.templateId);
      if (knownIds.has(stableId)) {
        continue;
      }

      const copy = buildWorkoutShareNotificationCopy({
        templateId: template.templateId,
        templateTitle: template.title,
        sharerName: getWorkoutSharerDisplayName(template),
      });

      mergedWorkout.push({
        id: stableId,
        type,
        participantId: null,
        friendshipId: null,
        templateId: template.templateId,
        messageId: null,
        title: copy.title,
        message: copy.message,
        createdAt: template.sharedAt ? new Date(template.sharedAt).getTime() : Date.now(),
        read: false,
      });
      knownIds.add(stableId);
    }

    return [...otherExisting, ...mergedWorkout]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  } catch {
    return existing;
  }
}
