import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { formatExerciseLabel } from '@/constants/challenges';
import type { ExerciseType } from '@/constants/challenges';
import { getFriendChallengeByParticipantId, getMyFriendChallenges } from '@/services/friendChallengeService';
import {
  challengeNotificationId,
  type ChallengeNotification,
  type ChallengeNotificationType,
} from '@/features/notifications/types';
import { getCreatorDisplayName, getOpponentDisplayName, type FriendChallenge } from '@/types/friends';

interface NotificationCopy {
  title: string;
  message: string;
  participantId: string | null;
}

interface ChallengeSummary {
  participantId: string;
  targetReps: number;
  exerciseType: ExerciseType;
  creatorUsername: string;
  creatorDisplayName: string | null;
  opponentUsername: string;
  opponentDisplayName: string | null;
  isCreator: boolean;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadChallengeByParticipantId(participantId: string): Promise<FriendChallenge | null> {
  for (const delayMs of [0, 400, 900, 1500]) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const challenge = await getFriendChallengeByParticipantId(participantId);
    if (challenge) {
      return challenge;
    }
  }

  return null;
}

async function loadChallengeSummaryByChallengeId(
  challengeId: string,
  currentUserId: string,
): Promise<ChallengeSummary | null> {
  assertSupabaseConfigured();

  const { data: challenge, error: challengeError } = await supabase
    .from('friend_challenges')
    .select('id, creator_id, exercise_type, target_reps')
    .eq('id', challengeId)
    .maybeSingle();

  if (challengeError || !challenge) {
    return null;
  }

  const { data: participants, error: participantsError } = await supabase
    .from('friend_challenge_participants')
    .select('id, user_id')
    .eq('challenge_id', challengeId);

  if (participantsError || !participants || participants.length === 0) {
    return null;
  }

  const mine = participants.find((participant) => participant.user_id === currentUserId);
  const opponent = participants.find((participant) => participant.user_id !== currentUserId);

  if (!mine || !opponent) {
    return null;
  }

  const profileIds = [challenge.creator_id, opponent.user_id];
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', profileIds);

  if (profilesError || !profiles) {
    return null;
  }

  const creatorProfile = profiles.find((profile) => profile.id === challenge.creator_id);
  const opponentProfile = profiles.find((profile) => profile.id === opponent.user_id);

  if (!creatorProfile || !opponentProfile) {
    return null;
  }

  return {
    participantId: mine.id,
    targetReps: challenge.target_reps,
    exerciseType: challenge.exercise_type,
    creatorUsername: creatorProfile.username,
    creatorDisplayName: creatorProfile.display_name,
    opponentUsername: opponentProfile.username,
    opponentDisplayName: opponentProfile.display_name,
    isCreator: challenge.creator_id === currentUserId,
  };
}

function buildCopyFromChallenge(
  type: ChallengeNotificationType,
  challenge: FriendChallenge,
): NotificationCopy {
  const exerciseLabel = formatExerciseLabel(challenge.exerciseType, true);
  const repLabel = `${challenge.targetReps} ${exerciseLabel}`;

  switch (type) {
    case 'challenge_received': {
      const challenger = getCreatorDisplayName(challenge);
      return {
        participantId: challenge.participantId,
        title: 'New challenge!',
        message: `${challenger} challenged you to ${repLabel}`,
      };
    }
    case 'challenge_accepted': {
      const opponent = getOpponentDisplayName(challenge);
      return {
        participantId: challenge.participantId,
        title: 'Challenge accepted',
        message: `${opponent} accepted your ${repLabel} race`,
      };
    }
    case 'challenge_declined': {
      const opponent = getOpponentDisplayName(challenge);
      return {
        participantId: challenge.participantId,
        title: 'Challenge declined',
        message: `${opponent} declined your ${repLabel} race`,
      };
    }
  }
}

function buildCopyFromSummary(
  type: ChallengeNotificationType,
  summary: ChallengeSummary,
): NotificationCopy {
  const exerciseLabel = formatExerciseLabel(summary.exerciseType, true);
  const repLabel = `${summary.targetReps} ${exerciseLabel}`;
  const creatorName = summary.creatorDisplayName ?? summary.creatorUsername;
  const opponentName = summary.opponentDisplayName ?? summary.opponentUsername;

  switch (type) {
    case 'challenge_received':
      return {
        participantId: summary.participantId,
        title: 'New challenge!',
        message: `${creatorName} challenged you to ${repLabel}`,
      };
    case 'challenge_accepted':
      return {
        participantId: summary.participantId,
        title: 'Challenge accepted',
        message: `${opponentName} accepted your ${repLabel} race`,
      };
    case 'challenge_declined':
      return {
        participantId: summary.participantId,
        title: 'Challenge declined',
        message: `${opponentName} declined your ${repLabel} race`,
      };
  }
}

export async function buildChallengeNotificationCopy(
  type: ChallengeNotificationType,
  options: {
    participantId?: string;
    challengeId?: string;
    currentUserId: string;
  },
): Promise<NotificationCopy | null> {
  if (options.participantId) {
    const challenge = await loadChallengeByParticipantId(options.participantId);
    if (challenge) {
      return buildCopyFromChallenge(type, challenge);
    }
  }

  if (!options.challengeId) {
    return null;
  }

  const summary = await loadChallengeSummaryByChallengeId(options.challengeId, options.currentUserId);
  if (!summary) {
    return null;
  }

  return buildCopyFromSummary(type, summary);
}

function getSyncNotificationTypes(challenge: FriendChallenge): ChallengeNotificationType[] {
  const types: ChallengeNotificationType[] = [];

  if (!challenge.isCreator && challenge.status === 'pending') {
    types.push('challenge_received');
  }

  if (challenge.isCreator && challenge.opponentStatus === 'in_progress') {
    types.push('challenge_accepted');
  }

  if (
    challenge.isCreator &&
    (challenge.status === 'declined' || challenge.opponentStatus === 'declined')
  ) {
    types.push('challenge_declined');
  }

  return types;
}

function getActiveNotificationIds(challenges: FriendChallenge[]): Set<string> {
  const activeIds = new Set<string>();

  for (const challenge of challenges) {
    for (const type of getSyncNotificationTypes(challenge)) {
      activeIds.add(challengeNotificationId(type, challenge.challengeId));
    }
  }

  return activeIds;
}

export async function syncChallengeNotifications(
  existing: ChallengeNotification[],
): Promise<ChallengeNotification[]> {
  try {
    const challenges = await getMyFriendChallenges();
    const activeIds = getActiveNotificationIds(challenges);
    const keptExisting = existing.filter((notification) => activeIds.has(notification.id) || notification.read);
    const knownIds = new Set(keptExisting.map((notification) => notification.id));
    const merged = [...keptExisting];

    for (const challenge of challenges) {
      for (const type of getSyncNotificationTypes(challenge)) {
        const stableId = challengeNotificationId(type, challenge.challengeId);
        if (knownIds.has(stableId)) {
          continue;
        }

        const copy = buildCopyFromChallenge(type, challenge);
        merged.push({
          id: stableId,
          type,
          participantId: challenge.participantId,
          title: copy.title,
          message: copy.message,
          createdAt: challenge.createdAt ? new Date(challenge.createdAt).getTime() : Date.now(),
          read: false,
        });
        knownIds.add(stableId);
      }
    }

    return merged.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  } catch {
    return existing;
  }
}
