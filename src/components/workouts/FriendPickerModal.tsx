import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FriendSummary } from '@/types/friends';

interface FriendPickerModalProps {
  visible: boolean;
  friends: FriendSummary[];
  isSubmitting?: boolean;
  onClose: () => void;
  onShare: (friendIds: string[]) => void;
}

export function FriendPickerModal({
  visible,
  friends,
  isSubmitting = false,
  onClose,
  onShare,
}: FriendPickerModalProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const filteredFriends = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return friends;
    }

    return friends.filter((friend) => {
      const displayName = (friend.displayName ?? friend.username).toLowerCase();
      return displayName.includes(normalized) || friend.username.toLowerCase().includes(normalized);
    });
  }, [friends, query]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setQuery('');
    setSelectedFriendIds([]);
  }, [visible]);

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    setQuery('');
    setSelectedFriendIds([]);
    onClose();
  }

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((current) =>
      current.includes(friendId)
        ? current.filter((id) => id !== friendId)
        : [...current, friendId],
    );
  }

  function handleShare() {
    if (selectedFriendIds.length === 0 || isSubmitting) {
      return;
    }

    onShare(selectedFriendIds);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>Share with friends</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select friends to share this workout template with.
          </Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search friends"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {friends.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>
                Add friends first to share this workout.
              </Text>
            ) : filteredFriends.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>No friends match your search.</Text>
            ) : (
              filteredFriends.map((friend) => {
                const isSelected = selectedFriendIds.includes(friend.friendId);
                const displayName = friend.displayName ?? friend.username;

                return (
                  <Pressable
                    key={friend.friendId}
                    disabled={isSubmitting}
                    onPress={() => toggleFriend(friend.friendId)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? theme.primary : theme.border,
                          backgroundColor: isSelected ? theme.primary : 'transparent',
                        },
                      ]}>
                      {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <ProfileAvatar
                      uri={friend.avatarUrl}
                      name={displayName}
                      size={40}
                      shopAvatar={friend.avatar}
                      frame={friend.frame}
                    />
                    <View style={styles.copy}>
                      <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
                      <Text style={[styles.meta, { color: theme.textSecondary }]}>@{friend.username}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton
              label={
                selectedFriendIds.length > 0
                  ? `Share with ${selectedFriendIds.length} friend${selectedFriendIds.length === 1 ? '' : 's'}`
                  : 'Share with friends'
              }
              onPress={handleShare}
              loading={isSubmitting}
              disabled={selectedFriendIds.length === 0 || friends.length === 0}
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={handleClose} disabled={isSubmitting} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    maxHeight: '82%',
    gap: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.two,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: -Spacing.one,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontWeight: '600',
  },
  listScroll: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 14,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
  },
  empty: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  footer: {
    gap: Spacing.two,
  },
});
