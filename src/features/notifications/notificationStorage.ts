import { getAppStorageItem, setAppStorageItem } from '@/lib/appStorage';
import type { ChallengeNotification } from '@/features/notifications/types';

const INBOX_KEY_PREFIX = 'notifications-inbox.';

function getStorageKey(userId: string): string {
  return `${INBOX_KEY_PREFIX}${userId}`;
}

export async function loadNotificationInbox(userId: string): Promise<ChallengeNotification[]> {
  const raw = await getAppStorageItem(getStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ChallengeNotification[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item) =>
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.message === 'string' &&
          typeof item.createdAt === 'number',
      )
      .map((item) => ({
        id: item.id,
        type: item.type,
        participantId: typeof item.participantId === 'string' ? item.participantId : null,
        friendshipId: typeof item.friendshipId === 'string' ? item.friendshipId : null,
        templateId: typeof item.templateId === 'string' ? item.templateId : null,
        messageId: typeof item.messageId === 'string' ? item.messageId : null,
        title: item.title,
        message: item.message,
        createdAt: item.createdAt,
        read: Boolean(item.read),
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function saveNotificationInbox(
  userId: string,
  notifications: ChallengeNotification[],
): Promise<void> {
  await setAppStorageItem(getStorageKey(userId), JSON.stringify(notifications.slice(0, 50)));
}
