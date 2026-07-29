export type ChallengeNotificationType =
  | 'challenge_received'
  | 'challenge_accepted'
  | 'challenge_declined';

export interface ChallengeNotification {
  id: string;
  type: ChallengeNotificationType;
  participantId: string | null;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
}

interface ParticipantRow {
  id: string;
  challenge_id: string;
  user_id: string;
  status: string;
}

export function isParticipantRow(value: unknown): value is ParticipantRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.challenge_id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.status === 'string'
  );
}

export function getChallengeNotificationTypeFromChange(
  eventType: string,
  row: ParticipantRow,
  oldRow: ParticipantRow | null,
  currentUserId: string,
): ChallengeNotificationType | null {
  if (eventType === 'INSERT') {
    if (row.user_id === currentUserId && row.status === 'pending') {
      return 'challenge_received';
    }
    return null;
  }

  if (eventType !== 'UPDATE') {
    return null;
  }

  if (!oldRow) {
    if (row.user_id !== currentUserId && row.status === 'in_progress') {
      return 'challenge_accepted';
    }

    if (row.status === 'declined') {
      return 'challenge_declined';
    }

    return null;
  }

  if (row.user_id !== currentUserId && oldRow.status === 'pending' && row.status === 'in_progress') {
    return 'challenge_accepted';
  }

  if (row.status === 'declined' && oldRow.status !== 'declined') {
    if (row.user_id === currentUserId && oldRow.status === 'in_progress') {
      return 'challenge_declined';
    }

    if (row.user_id !== currentUserId && oldRow.status === 'pending') {
      return 'challenge_declined';
    }
  }

  return null;
}

export function challengeNotificationId(
  type: ChallengeNotificationType,
  challengeId: string,
): string {
  return `${type}-${challengeId}`;
}
