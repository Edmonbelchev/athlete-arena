import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { FriendChallengeCard } from '@/components/ui/FriendChallengeCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { useFriends } from '@/features/friends/useFriends';
import type { FriendChallenge } from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengesCarouselProps {
  challenges: FriendChallenge[];
  busyChallengeId: string | null;
  onAccept: (participantId: string) => void;
  onDecline: (participantId: string) => void;
}

export function FriendChallengesCarousel({
  challenges,
  busyChallengeId,
  onAccept,
  onDecline,
}: FriendChallengesCarouselProps) {
  const theme = useTheme();
  const { friends, isLoading: isFriendsLoading } = useFriends();
  const scrollRef = useRef<ScrollView>(null);
  const slideWidthRef = useRef(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const snapOffsets = useMemo(
    () => challenges.map((_, index) => index * slideWidth),
    [challenges, slideWidth],
  );

  useEffect(() => {
    setActiveIndex(0);
    if (slideWidth > 0) {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [challenges.length, slideWidth]);

  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      const width = slideWidthRef.current;
      if (width <= 0) {
        return;
      }

      const clampedIndex = Math.min(Math.max(index, 0), challenges.length - 1);
      setActiveIndex(clampedIndex);
      scrollRef.current?.scrollTo({ x: clampedIndex * width, animated });
    },
    [challenges.length],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const width = slideWidthRef.current;
      if (width <= 0) {
        return;
      }

      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      const clampedIndex = Math.min(Math.max(index, 0), challenges.length - 1);

      setActiveIndex((current) => (current === clampedIndex ? current : clampedIndex));
    },
    [challenges.length],
  );

  function handleChallengeFriendPress() {
    if (friends.length === 0) {
      router.push('/friends/add');
      return;
    }

    router.push('/friends/challenge/create');
  }

  if (challenges.length === 0) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.emptyCard,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <View style={StyleSheet.flatten([styles.emptyIcon, { backgroundColor: theme.backgroundSelected }])}>
          <AppIcon name="friends" size={28} color={theme.primary} />
        </View>
        <Text style={StyleSheet.flatten([styles.emptyTitle, { color: theme.text }])}>No friend races yet</Text>
        <Text style={StyleSheet.flatten([styles.emptyCopy, { color: theme.textSecondary }])}>
          Challenge a friend to a speed race and compete for XP.
        </Text>
        <PrimaryButton
          label={friends.length === 0 ? 'Add a Friend' : 'Challenge a Friend'}
          loading={isFriendsLoading}
          disabled={isFriendsLoading}
          onPress={handleChallengeFriendPress}
        />
      </View>
    );
  }

  return (
    <View
      style={styles.carousel}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== slideWidthRef.current) {
          slideWidthRef.current = nextWidth;
          setSlideWidth(nextWidth);
        }
      }}>
      {slideWidth > 0 ? (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            bounces={false}
            scrollEventThrottle={16}
            snapToOffsets={snapOffsets}
            snapToAlignment="start"
            disableIntervalMomentum
            onScroll={handleScroll}
            style={{ width: slideWidth }}
            contentContainerStyle={{ width: slideWidth * challenges.length }}>
            {challenges.map((challenge) => (
              <View key={challenge.participantId} style={{ width: slideWidth }}>
                <FriendChallengeCard
                  challenge={challenge}
                  loading={busyChallengeId === challenge.participantId}
                  onAccept={() => onAccept(challenge.participantId)}
                  onDecline={() => onDecline(challenge.participantId)}
                  onStart={() =>
                    router.push({
                      pathname: '/challenge/friend/[participantId]',
                      params: { participantId: challenge.participantId },
                    })
                  }
                />
              </View>
            ))}
          </ScrollView>

          {challenges.length > 1 ? (
            <View style={styles.footer}>
              <View style={styles.dots}>
                {challenges.map((challenge, index) => (
                  <Pressable
                    key={challenge.participantId}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to challenge ${index + 1}`}
                    onPress={() => scrollToIndex(index)}
                    style={StyleSheet.flatten([
                      styles.dot,
                      {
                        backgroundColor: index === activeIndex ? theme.primary : theme.backgroundSelected,
                        width: index === activeIndex ? 18 : 8,
                      },
                    ])}
                  />
                ))}
              </View>
              <Text style={StyleSheet.flatten([styles.pageLabel, { color: theme.textSecondary }])}>
                {activeIndex + 1} / {challenges.length}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    gap: Spacing.two,
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  pageLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
