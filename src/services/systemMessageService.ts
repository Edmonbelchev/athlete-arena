import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  systemMessageNotificationId,
  type ChallengeNotification,
} from '@/features/notifications/types';

export interface SystemMessage {
  id: string;
  title: string;
  summary: string;
  body: string;
  publishedAt: string;
  read: boolean;
}

type SystemMessageRow = {
  id: string;
  title: string;
  summary: string;
  published_at: string;
  read: boolean;
};

type SystemMessageDetailRow = SystemMessageRow & {
  body: string;
};

function mapSystemMessage(row: SystemMessageDetailRow): SystemMessage {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    publishedAt: row.published_at,
    read: row.read,
  };
}

export async function fetchActiveSystemMessages(): Promise<SystemMessage[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_active_system_messages');

  if (error) {
    throw error;
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as SystemMessageRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: row.summary,
    publishedAt: row.published_at,
    read: row.read,
  }));
}

export async function fetchSystemMessage(messageId: string): Promise<SystemMessage | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_system_message', {
    p_message_id: messageId,
  });

  if (error) {
    throw error;
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as SystemMessageDetailRow[];
  const row = rows[0];

  if (!row) {
    return null;
  }

  return mapSystemMessage(row);
}

export async function markSystemMessageRead(messageId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('mark_system_message_read', {
    p_message_id: messageId,
  });

  if (error) {
    throw error;
  }
}

export async function syncSystemMessageNotifications(
  existing: ChallengeNotification[],
): Promise<ChallengeNotification[]> {
  try {
    const systemExisting = existing.filter((notification) => notification.type === 'system_message');
    const otherExisting = existing.filter((notification) => notification.type !== 'system_message');

    const messages = await fetchActiveSystemMessages();
    const activeIds = new Set(messages.map((message) => systemMessageNotificationId(message.id)));

    const keptExisting = systemExisting.filter(
      (notification) => activeIds.has(notification.id) || notification.read,
    );
    const readById = new Map(
      [...keptExisting, ...systemExisting].map((notification) => [notification.id, notification.read]),
    );
    const knownIds = new Set(keptExisting.map((notification) => notification.id));
    const mergedSystem = [...keptExisting];

    for (const message of messages) {
      const stableId = systemMessageNotificationId(message.id);
      const serverRead = message.read;
      const localRead = readById.get(stableId) ?? false;

      if (knownIds.has(stableId)) {
        const index = mergedSystem.findIndex((notification) => notification.id === stableId);
        if (index >= 0) {
          mergedSystem[index] = {
            ...mergedSystem[index],
            title: message.title,
            message: message.summary,
            read: serverRead || localRead,
            createdAt: new Date(message.publishedAt).getTime(),
          };
        }
        continue;
      }

      mergedSystem.push({
        id: stableId,
        type: 'system_message',
        participantId: null,
        friendshipId: null,
        templateId: null,
        messageId: message.id,
        title: message.title,
        message: message.summary,
        createdAt: new Date(message.publishedAt).getTime(),
        read: serverRead || localRead,
      });
      knownIds.add(stableId);
    }

    return [...otherExisting, ...mergedSystem]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  } catch {
    return existing;
  }
}

export function buildSystemMessageNotification(message: {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
}): ChallengeNotification {
  return {
    id: systemMessageNotificationId(message.id),
    type: 'system_message',
    participantId: null,
    friendshipId: null,
    templateId: null,
    messageId: message.id,
    title: message.title,
    message: message.summary,
    createdAt: new Date(message.publishedAt).getTime(),
    read: false,
  };
}
