import { Redirect, useLocalSearchParams } from 'expo-router';

export default function CreateWorkoutRedirect() {
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();

  return (
    <Redirect
      href={
        templateId
          ? { pathname: '/(tabs)/workouts/library', params: { editTemplateId: templateId } }
          : '/(tabs)/workouts/library'
      }
    />
  );
}
