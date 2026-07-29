import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { getProfileErrorMessage } from '@/features/profile/profileErrors';
import { removeProfileAvatar, uploadProfileAvatar } from '@/services/avatarService';
import { useTheme } from '@/hooks/use-theme';

interface ProfileAvatarUploadProps {
  userId: string;
  avatarUrl?: string | null;
  displayName: string;
  onAvatarChange: (avatarUrl: string | null) => void;
}

export function ProfileAvatarUpload({
  userId,
  avatarUrl,
  displayName,
  onAvatarChange,
}: ProfileAvatarUploadProps) {
  const theme = useTheme();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const shownUri = previewUri ?? avatarUrl ?? null;

  async function requestLibraryPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo access needed',
        'Allow photo library access to choose a profile picture.',
      );
      return false;
    }

    return true;
  }

  async function handlePickImage() {
    setAvatarError(null);

    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      ...(Platform.OS === 'ios'
        ? {
            allowsEditing: true,
            aspect: [1, 1] as [number, number],
            presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
          }
        : Platform.OS === 'android'
          ? {
              allowsEditing: true,
              aspect: [1, 1] as [number, number],
            }
          : {
              allowsEditing: false,
            }),
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setPreviewUri(asset.uri);
    setIsUploading(true);

    try {
      const nextUrl = await uploadProfileAvatar(userId, asset.uri);
      setPreviewUri(null);
      onAvatarChange(nextUrl);
    } catch (err) {
      setPreviewUri(null);
      setAvatarError(getProfileErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemoveImage() {
    setAvatarError(null);
    setIsUploading(true);

    try {
      await removeProfileAvatar(userId);
      setPreviewUri(null);
      onAvatarChange(null);
    } catch (err) {
      setAvatarError(getProfileErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        disabled={isUploading}
        onPress={() => void handlePickImage()}
        style={styles.avatarButton}>
        <ProfileAvatar uri={shownUri} name={displayName} size={112} />

        <View style={StyleSheet.flatten([styles.cameraBadge, { backgroundColor: theme.primary, borderColor: theme.background }])}>
          {isUploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <AppIcon name="camera" size={16} color="#FFFFFF" />
          )}
        </View>
      </Pressable>

      <Text style={StyleSheet.flatten([styles.hint, { color: theme.textSecondary }])}>
        Tap your photo to upload a new profile image.
      </Text>

      {shownUri ? (
        <PrimaryButton
          label="Remove Photo"
          variant="secondary"
          disabled={isUploading}
          onPress={() => void handleRemoveImage()}
        />
      ) : null}

      {avatarError ? (
        <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{avatarError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarButton: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
