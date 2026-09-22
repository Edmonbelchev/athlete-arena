import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { getCustomWorkoutSessionPath } from '@/constants/customWorkouts';
import { usePremium } from '@/features/subscription/usePremium';
import { setPendingCustomWorkoutLaunch } from '@/features/workouts/customWorkoutLaunchStore';
import { useCustomWorkoutTemplates } from '@/features/workouts/useCustomWorkoutTemplates';
import { cloneCustomWorkoutExercises } from '@/features/workouts/useAmrapWorkout';
import { formatUserError } from '@/lib/errors';
import {
  dismissSharedWorkoutTemplate,
  getCustomWorkoutTemplateDetail,
  softDeleteCustomWorkoutTemplate,
} from '@/services/customWorkoutService';
import type { CustomWorkoutTemplateDetail } from '@/types/customWorkouts';

export type WorkoutLibraryConfirmAction = 'remove-shared' | 'delete-owned';

interface UseWorkoutLibrarySessionOptions {
  deepLinkTemplateId?: string;
  editTemplateId?: string;
}

export function useWorkoutLibrarySession(options: UseWorkoutLibrarySessionOptions = {}) {
  const { deepLinkTemplateId, editTemplateId } = options;
  const { isPremium, showPremiumPaywall } = usePremium();
  const { templates, setTemplates, isLoading, isRefreshing, error, setError, refresh } =
    useCustomWorkoutTemplates();

  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewDetail, setPreviewDetail] = useState<CustomWorkoutTemplateDetail | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [actionTemplateId, setActionTemplateId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    action: WorkoutLibraryConfirmAction;
    templateId: string;
  } | null>(null);
  const [handledDeepLinkTemplateId, setHandledDeepLinkTemplateId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalTemplateId, setCreateModalTemplateId] = useState<string | null>(null);
  const [createModalEpoch, setCreateModalEpoch] = useState(0);
  const [handledEditTemplateId, setHandledEditTemplateId] = useState<string | null>(null);

  const openCreateModal = useCallback(
    async (templateId?: string | null) => {
      if (!isPremium) {
        const unlocked = await showPremiumPaywall({
          context: templateId ? 'edit_workout' : 'create_workout',
        });
        if (!unlocked) {
          return;
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setCreateModalTemplateId(templateId ?? null);
      setCreateModalEpoch((epoch) => epoch + 1);
      setShowCreateModal(true);
    },
    [isPremium, showPremiumPaywall],
  );

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setCreateModalTemplateId(null);
  }, []);

  const openPreview = useCallback(async (templateId: string) => {
    setPreviewTemplateId(templateId);
    setPreviewDetail(null);
    setIsPreviewLoading(true);
    setError(null);

    try {
      const detail = await getCustomWorkoutTemplateDetail(templateId);
      setPreviewDetail(detail);
    } catch (err) {
      setPreviewTemplateId(null);
      setError(formatUserError(err, 'Failed to load workout'));
    } finally {
      setIsPreviewLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    if (!deepLinkTemplateId || deepLinkTemplateId === handledDeepLinkTemplateId) {
      return;
    }

    setHandledDeepLinkTemplateId(deepLinkTemplateId);
    void openPreview(deepLinkTemplateId);
  }, [deepLinkTemplateId, handledDeepLinkTemplateId, openPreview]);

  useEffect(() => {
    if (!editTemplateId || editTemplateId === handledEditTemplateId) {
      return;
    }

    setHandledEditTemplateId(editTemplateId);
    void openCreateModal(editTemplateId);
  }, [editTemplateId, handledEditTemplateId, openCreateModal]);

  const closePreview = useCallback(() => {
    if (startingTemplateId || actionTemplateId) {
      return;
    }

    setPreviewTemplateId(null);
    setPreviewDetail(null);
    setConfirmDialog(null);
  }, [actionTemplateId, startingTemplateId]);

  const handleStartTemplate = useCallback(
    async (
      templateId: string,
      detail?: CustomWorkoutTemplateDetail | null,
      isOwner = detail?.isOwner ?? false,
    ) => {
      if (isOwner && !isPremium) {
        const unlocked = await showPremiumPaywall({ context: 'start_workout' });
        if (!unlocked) {
          return;
        }
      }

      setStartingTemplateId(templateId);
      setError(null);

      try {
        const workoutDetail = detail ?? (await getCustomWorkoutTemplateDetail(templateId));

        setPendingCustomWorkoutLaunch({
          workoutType: workoutDetail.workoutType,
          title: workoutDetail.title,
          templateId: workoutDetail.templateId,
          catalogWorkoutId: null,
          timeLimitSeconds: workoutDetail.timeLimitSeconds,
          exercises: cloneCustomWorkoutExercises(workoutDetail.exercises),
          structureConfig: workoutDetail.structureConfig,
        });
        setPreviewTemplateId(null);
        setPreviewDetail(null);
        setConfirmDialog(null);
        router.push(getCustomWorkoutSessionPath(workoutDetail.workoutType));
      } catch (err) {
        setError(formatUserError(err, 'Failed to start workout'));
      } finally {
        setStartingTemplateId(null);
      }
    },
    [isPremium, setError, showPremiumPaywall],
  );

  const handleRemoveSharedTemplate = useCallback(
    async (templateId: string) => {
      setActionTemplateId(templateId);
      setError(null);

      try {
        await dismissSharedWorkoutTemplate(templateId);
        setTemplates((current) => current.filter((template) => template.templateId !== templateId));
        setPreviewTemplateId(null);
        setPreviewDetail(null);
        setConfirmDialog(null);
      } catch (err) {
        setError(formatUserError(err, 'Failed to remove workout'));
      } finally {
        setActionTemplateId(null);
        setConfirmDialog(null);
      }
    },
    [setError, setTemplates],
  );

  const handleDeleteOwnedTemplate = useCallback(
    async (templateId: string) => {
      setActionTemplateId(templateId);
      setError(null);

      try {
        await softDeleteCustomWorkoutTemplate(templateId);
        setTemplates((current) => current.filter((template) => template.templateId !== templateId));
      } catch (err) {
        setError(formatUserError(err, 'Failed to delete workout'));
      } finally {
        setActionTemplateId(null);
        setConfirmDialog(null);
      }
    },
    [setError, setTemplates],
  );

  const confirmDeleteOrRemove = useCallback(() => {
    if (!confirmDialog) {
      return;
    }

    if (confirmDialog.action === 'delete-owned') {
      void handleDeleteOwnedTemplate(confirmDialog.templateId);
      return;
    }

    void handleRemoveSharedTemplate(confirmDialog.templateId);
  }, [confirmDialog, handleDeleteOwnedTemplate, handleRemoveSharedTemplate]);

  return {
    templates,
    isLoading,
    isRefreshing,
    error,
    refresh,
    isPremium,
    startingTemplateId,
    previewTemplateId,
    previewDetail,
    isPreviewLoading,
    actionTemplateId,
    confirmDialog,
    setConfirmDialog,
    showCreateModal,
    createModalTemplateId,
    createModalEpoch,
    openCreateModal,
    closeCreateModal,
    openPreview,
    closePreview,
    handleStartTemplate,
    confirmDeleteOrRemove,
  };
}
