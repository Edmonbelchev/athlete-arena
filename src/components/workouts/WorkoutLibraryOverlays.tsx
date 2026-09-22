import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CreateWorkoutModal } from '@/components/workouts/CreateWorkoutModal';
import { SharedWorkoutPreviewModal } from '@/components/workouts/SharedWorkoutPreviewModal';
import type { WorkoutLibraryConfirmAction } from '@/features/workouts/useWorkoutLibrarySession';
import type { CustomWorkoutTemplateDetail } from '@/types/customWorkouts';

interface WorkoutLibraryOverlaysProps {
  showCreateModal: boolean;
  createModalTemplateId: string | null;
  createModalEpoch: number;
  onCloseCreateModal: () => void;
  onWorkoutSaved: () => void;
  previewTemplateId: string | null;
  previewDetail: CustomWorkoutTemplateDetail | null;
  isPreviewLoading: boolean;
  startingTemplateId: string | null;
  actionTemplateId: string | null;
  onClosePreview: () => void;
  onStartPreview: () => void;
  onRemovePreview: () => void;
  confirmDialog: { action: WorkoutLibraryConfirmAction; templateId: string } | null;
  onConfirmDialog: () => void;
  onCancelDialog: () => void;
}

export function WorkoutLibraryOverlays({
  showCreateModal,
  createModalTemplateId,
  createModalEpoch,
  onCloseCreateModal,
  onWorkoutSaved,
  previewTemplateId,
  previewDetail,
  isPreviewLoading,
  startingTemplateId,
  actionTemplateId,
  onClosePreview,
  onStartPreview,
  onRemovePreview,
  confirmDialog,
  onConfirmDialog,
  onCancelDialog,
}: WorkoutLibraryOverlaysProps) {
  return (
    <>
      <CreateWorkoutModal
        key={`create-workout-${createModalEpoch}`}
        visible={showCreateModal}
        templateId={createModalTemplateId}
        onClose={onCloseCreateModal}
        onSaved={onWorkoutSaved}
      />

      <SharedWorkoutPreviewModal
        visible={previewTemplateId !== null}
        detail={previewDetail}
        loading={isPreviewLoading}
        starting={previewTemplateId !== null && startingTemplateId === previewTemplateId}
        removing={previewTemplateId !== null && actionTemplateId === previewTemplateId}
        onClose={onClosePreview}
        onStart={onStartPreview}
        onRemove={onRemovePreview}
      />

      <ConfirmDialog
        visible={confirmDialog !== null}
        title={confirmDialog?.action === 'delete-owned' ? 'Delete workout?' : 'Remove shared workout?'}
        message={
          confirmDialog?.action === 'delete-owned'
            ? 'This workout will be removed from your list. Friends you shared it with can still use their copy.'
            : 'This workout will be removed from your list. Your friend can share it with you again later.'
        }
        confirmLabel={confirmDialog?.action === 'delete-owned' ? 'Delete' : 'Remove'}
        destructive
        loading={actionTemplateId !== null}
        onConfirm={onConfirmDialog}
        onCancel={onCancelDialog}
      />
    </>
  );
}
