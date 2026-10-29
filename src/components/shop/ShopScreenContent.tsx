import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AvatarPortrait } from '@/components/avatar/AvatarPortrait';
import { FriendChallengeRequestQuotaBar } from '@/components/friends/FriendChallengeRequestQuotaBar';
import { CoinEarnInfo } from '@/components/rewards/CoinEarnInfo';
import {
  TIER_COLORS,
  TIER_LABELS,
  WEARABLE_TILE_PREVIEW,
  WearableShopCard,
  getItemTier,
} from '@/components/shop/WearableShopCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { toAccessoryStyles } from '@/features/avatar/avatarWardrobe';
import { saveAvatarWithHeadshot } from '@/features/avatar/saveAvatarWithHeadshot';
import { useMyAvatar } from '@/features/avatar/useMyAvatar';
import { useProfile } from '@/features/profile/useProfile';
import { useFriendChallengeRequestQuota } from '@/features/friends/useFriendChallengeRequestQuota';
import { useShop } from '@/features/shop/ShopProvider';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import type { AccessorySlot, AvatarAccessories, WearableTier } from '@/types/avatar';
import type { ShopItemRecord } from '@/types/shop';

/** Sections other screens can link to (`/(tabs)/shop?section=slots`). */
export type ShopSection = 'outfits' | 'slots' | 'emotes';

type ShopCategory = AccessorySlot | 'frames' | 'emotes' | 'slots';

const CATEGORY_LABELS: Record<ShopCategory, string> = {
  top: 'Tops',
  headwear: 'Hats',
  glasses: 'Glasses',
  earrings: 'Earrings',
  background: 'Backgrounds',
  frames: 'Frames',
  emotes: 'Emotes',
  slots: 'Challenge Slots',
};

const TIERS: WearableTier[] = ['basic', 'rare', 'legendary'];
const GRID_COLUMNS = 3;

function toRows<T>(values: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    rows.push(values.slice(index, index + size));
  }
  return rows;
}
const FITTING_ROOM_SIZE = 148;

interface ShopScreenContentProps {
  initialSection?: ShopSection;
}

export function ShopScreenContent({ initialSection = 'outfits' }: ShopScreenContentProps) {
  const theme = useTheme();
  const [category, setCategory] = useState<ShopCategory>(initialSection === 'outfits' ? 'top' : initialSection);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<ShopItemRecord | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const { items, summary, isLoading, isUpdating, error, refresh, purchaseItem, equipItem, removeFrame, equippedFrame } =
    useShop();
  const avatar = useMyAvatar();
  const { profile, refresh: refreshProfile } = useProfile();
  const userId = profile?.id;
  // Equipping or removing an outfit item from the shop: the new look is rendered
  // off-screen, saved, and captured as the profile picture.
  const lookCaptureRef = useRef<View>(null);
  const [savingLook, setSavingLook] = useState<AvatarAccessories | null>(null);
  const [lookError, setLookError] = useState<string | null>(null);

  useEffect(() => {
    if (!savingLook || !userId) {
      return;
    }

    // Give the off-screen portrait a moment to render before capturing it.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          await saveAvatarWithHeadshot({
            userId,
            appearance: avatar.appearance,
            accessories: savingLook,
            portraitRef: lookCaptureRef,
          });
          await Promise.all([refreshProfile(), avatar.refresh()]);
        } catch (err) {
          setLookError(formatUserError(err, 'Could not update your avatar'));
        } finally {
          setSavingLook(null);
        }
      })();
    }, 150);

    return () => clearTimeout(timer);
    // Runs once per requested look; avatar data is read at that moment.
  }, [savingLook, userId]);

  /** Whether an outfit item is part of the saved avatar. */
  function isWorn(item: ShopItemRecord): boolean {
    return Boolean(item.wearable && avatar.accessories[item.wearable.slot] === item.id);
  }

  function wearOrRemove(item: ShopItemRecord) {
    const wearable = item.wearable;
    if (!wearable) {
      return;
    }
    setLookError(null);
    const next = { ...avatar.accessories };
    if (isWorn(item)) {
      delete next[wearable.slot];
    } else {
      next[wearable.slot] = wearable.id;
    }
    setSavingLook(next);
  }
  const { quota, refresh: refreshQuota } = useFriendChallengeRequestQuota();

  const bodyType = avatar.appearance.bodyType;
  const coinBalance = summary.coinBalance;

  // Starter items are free and already owned, so they are not sold here.
  const wearables = useMemo(
    () =>
      items.filter(
        (item) =>
          item.wearable &&
          !item.wearable.starter &&
          (item.wearable.bodyType === 'unisex' || item.wearable.bodyType === bodyType),
      ),
    [bodyType, items],
  );
  const categories = useMemo<ShopCategory[]>(() => {
    const slots: AccessorySlot[] = ['top', 'headwear', 'glasses', 'earrings', 'background'];
    const withItems = slots.filter((slot) => wearables.some((item) => item.wearable?.slot === slot));
    return [...withItems, 'frames', 'emotes', 'slots'];
  }, [wearables]);
  const activeCategory = categories.includes(category) ? category : 'top';

  const frames = items.filter((item) => item.itemType === 'frame');
  const emotes = items.filter((item) => item.itemType === 'emote' && item.id !== 'emote_trophy');
  const slotPacks = items.filter((item) => item.slotPack);
  const selected = [...wearables, ...frames, ...emotes].find((item) => item.id === selectedId) ?? null;
  // The fitting room shows the selected frame, or the one currently equipped.
  const previewFrame =
    selected?.itemType === 'frame'
      ? { borderColor: selected.metadata.borderColor ?? '#CBD5E1', borderWidth: selected.metadata.borderWidth ?? 3 }
      : equippedFrame;

  /** Current look, optionally with one item swapped in. */
  function lookWith(item: ShopItemRecord | null) {
    const wearable = item?.wearable;
    if (!wearable) {
      return toAccessoryStyles(avatar.accessories, avatar.wardrobe);
    }
    return toAccessoryStyles({ ...avatar.accessories, [wearable.slot]: wearable.id }, [...avatar.wardrobe, wearable]);
  }

  function startPurchase(item: ShopItemRecord) {
    setPurchaseError(null);
    setPending(item);
  }

  async function handleConfirmPurchase() {
    if (!pending) {
      return;
    }

    setPurchaseError(null);
    try {
      await purchaseItem(pending.id);
      if (pending.wearable) {
        await avatar.refresh();
      }
      if (pending.slotPack) {
        await refreshQuota();
      }
      setPending(null);
    } catch (err) {
      setPurchaseError(formatUserError(err, 'Purchase failed'));
    }
  }

  function renderTilePreview(item: ShopItemRecord) {
    if (item.itemType === 'emote') {
      return <Text style={styles.tileEmoji}>{item.metadata.emoji}</Text>;
    }

    if (item.itemType === 'frame') {
      return (
        <View
          style={StyleSheet.flatten([
            styles.tileFrame,
            { borderColor: item.metadata.borderColor ?? '#CBD5E1', borderWidth: (item.metadata.borderWidth ?? 3) + 1 },
          ])}>
          <AvatarPortrait appearance={avatar.appearance} accessories={lookWith(null)} size={68} showBackground />
        </View>
      );
    }

    // Avatar background behind the item, so dark items stay visible on dark tiles.
    return (
      <AvatarPortrait
        appearance={avatar.appearance}
        accessories={lookWith(item)}
        size={WEARABLE_TILE_PREVIEW}
        showBackground
        crop={item.wearable?.slot === 'glasses' || item.wearable?.slot === 'earrings' ? 'face' : 'portrait'}
      />
    );
  }

  /** Primary action for the selected item in the bottom bar. */
  function renderAction(item: ShopItemRecord) {
    if (!item.owned) {
      return (
        <PrimaryButton
          label="Buy"
          disabled={isUpdating || coinBalance < item.priceCoins}
          onPress={() => startPurchase(item)}
          style={styles.actionButton}
        />
      );
    }

    if (item.wearable) {
      const worn = isWorn(item);
      // Every avatar wears a top, so a worn top can only be swapped, not taken off.
      if (worn && item.wearable.slot === 'top') {
        return <PrimaryButton label="Wearing" variant="secondary" disabled style={styles.actionButton} />;
      }
      return (
        <PrimaryButton
          label={worn ? 'Take off' : 'Equip'}
          variant={worn ? 'secondary' : 'primary'}
          loading={savingLook !== null}
          onPress={() => wearOrRemove(item)}
          style={styles.actionButton}
        />
      );
    }

    if (item.equipped) {
      return item.itemType === 'frame' ? (
        <PrimaryButton
          label="Remove"
          variant="secondary"
          loading={isUpdating}
          onPress={() => void removeFrame()}
          style={styles.actionButton}
        />
      ) : (
        <PrimaryButton label="Equipped" variant="secondary" disabled style={styles.actionButton} />
      );
    }

    return (
      <PrimaryButton
        label="Equip"
        loading={isUpdating}
        onPress={() => void equipItem(item.id)}
        style={styles.actionButton}
      />
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const categoryItems =
    activeCategory === 'frames'
      ? frames
      : activeCategory === 'emotes'
        ? emotes
        : wearables.filter((item) => item.wearable?.slot === activeCategory);
  const shortBy = selected ? Math.max(selected.priceCoins - coinBalance, 0) : 0;

  return (
    <View style={styles.root}>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void Promise.all([refresh(), avatar.refresh(), refreshQuota()])}
            tintColor={theme.primary}
          />
        }>
        {/* Fitting room: the user's avatar wearing whatever item is selected. */}
        <View style={styles.inner}>
          <View
            style={StyleSheet.flatten([
              styles.fittingRoom,
              { backgroundColor: theme.card, borderColor: theme.border },
            ])}>
            <View style={styles.fittingTop}>
              <Text style={StyleSheet.flatten([styles.fittingTitle, { color: theme.text }])}>Fitting Room</Text>
              <View style={StyleSheet.flatten([styles.balancePill, { backgroundColor: theme.backgroundSelected }])}>
                <CoinIcon size={16} />
                <Text style={StyleSheet.flatten([styles.balanceText, { color: theme.text }])}>
                  {coinBalance.toLocaleString()}
                </Text>
              </View>
            </View>
            <View>
              <View
                style={StyleSheet.flatten([
                  styles.portrait,
                  // The border sits outside the portrait, so it never covers the avatar.
                  previewFrame
                    ? {
                        borderColor: previewFrame.borderColor,
                        borderWidth: previewFrame.borderWidth * 2,
                        width: FITTING_ROOM_SIZE + previewFrame.borderWidth * 4,
                        height: FITTING_ROOM_SIZE + previewFrame.borderWidth * 4,
                        borderRadius: (FITTING_ROOM_SIZE + previewFrame.borderWidth * 4) / 2,
                      }
                    : null,
                ])}>
                <AvatarPortrait
                  appearance={avatar.appearance}
                  accessories={lookWith(selected)}
                  size={FITTING_ROOM_SIZE}
                  showBackground
                />
              </View>
              {selected?.itemType === 'emote' ? (
                <View style={StyleSheet.flatten([styles.emoteBubble, { backgroundColor: theme.card, borderColor: theme.border }])}>
                  <Text style={styles.emoteBubbleText}>{selected.metadata.emoji}</Text>
                </View>
              ) : null}
            </View>
            {selected ? (
              <View style={styles.fittingInfo}>
                <Text style={StyleSheet.flatten([styles.selectedTitle, { color: theme.text }])}>{selected.title}</Text>
                <Text style={StyleSheet.flatten([styles.selectedTier, { color: TIER_COLORS[getItemTier(selected)] }])}>
                  {TIER_LABELS[getItemTier(selected)]}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => setSelectedId(null)}>
                  <Text style={StyleSheet.flatten([styles.resetLink, { color: theme.textSecondary }])}>
                    Back to my look
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text style={StyleSheet.flatten([styles.fittingHint, { color: theme.textSecondary }])}>
                Tap any item to try it on before you buy.
              </Text>
            )}
          </View>
        </View>

        <View style={StyleSheet.flatten([styles.categoryBar, { backgroundColor: theme.background }])}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
            {categories.map((entry) => {
              const active = activeCategory === entry;
              return (
                <Pressable
                  key={entry}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setCategory(entry)}
                  style={StyleSheet.flatten([
                    styles.categoryChip,
                    active
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.card, borderColor: theme.border },
                  ])}>
                  <Text style={StyleSheet.flatten([styles.categoryLabel, { color: active ? '#FFFFFF' : theme.text }])}>
                    {CATEGORY_LABELS[entry]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={StyleSheet.flatten([styles.inner, styles.sections])}>
          {error ? (
            <View style={styles.errorBlock}>
              <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
              <PrimaryButton label="Try Again" variant="secondary" onPress={() => void refresh()} />
            </View>
          ) : null}

          {activeCategory !== 'slots'
            ? TIERS.map((tier) => {
                const tierItems = categoryItems.filter((item) => getItemTier(item) === tier);
                if (tierItems.length === 0) {
                  return null;
                }
                return (
                  <View key={tier} style={styles.tierSection}>
                    <View style={styles.tierHeader}>
                      <View style={StyleSheet.flatten([styles.tierDot, { backgroundColor: TIER_COLORS[tier] }])} />
                      <Text style={StyleSheet.flatten([styles.tierTitle, { color: theme.text }])}>
                        {TIER_LABELS[tier]}
                      </Text>
                    </View>
                    {toRows(tierItems, GRID_COLUMNS).map((row) => (
                      <View key={row[0].id} style={styles.gridRow}>
                        {row.map((item) => (
                          <WearableShopCard
                            key={item.id}
                            item={isWorn(item) ? { ...item, equipped: true } : item}
                            selected={item.id === selectedId}
                            canAfford={coinBalance >= item.priceCoins}
                            onPress={() => setSelectedId(item.id === selectedId ? null : item.id)}
                            preview={renderTilePreview(item)}
                          />
                        ))}
                        {/* Keep a short last row aligned to the columns. */}
                        {Array.from({ length: GRID_COLUMNS - row.length }, (_, index) => (
                          <View key={`filler-${index}`} style={styles.gridFiller} />
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })
            : null}

          {activeCategory === 'slots' ? (
            <>
              <FriendChallengeRequestQuotaBar quota={quota} />
              {quota.isPremium ? (
                <View
                  style={StyleSheet.flatten([
                    styles.premiumCard,
                    { backgroundColor: theme.card, borderColor: theme.primary },
                  ])}>
                  <AppIcon name="crown" size={28} color={theme.streak} />
                  <Text style={StyleSheet.flatten([styles.premiumTitle, { color: theme.text }])}>
                    You have unlimited challenges
                  </Text>
                  <Text style={StyleSheet.flatten([styles.premiumCopy, { color: theme.textSecondary }])}>
                    Premium members can send as many friend challenges as they like, so there is no need for slots.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={StyleSheet.flatten([styles.slotIntro, { color: theme.textSecondary }])}>
                    Free accounts can send 10 friend challenges a month. Slots add extra requests once those are
                    used - they never expire.
                  </Text>
                  {slotPacks.map((item) => {
                    const best = item.slotPack?.slots === 10;
                    return (
                      <View
                        key={item.id}
                        style={StyleSheet.flatten([
                          styles.packCard,
                          { backgroundColor: theme.card, borderColor: best ? theme.accent : theme.border },
                        ])}>
                        <View style={StyleSheet.flatten([styles.packIcon, { backgroundColor: theme.backgroundSelected }])}>
                          <AppIcon name="swords" size={22} color={theme.primary} />
                          <Text style={StyleSheet.flatten([styles.packCount, { color: theme.primary }])}>
                            x{item.slotPack?.slots}
                          </Text>
                        </View>
                        <View style={styles.packText}>
                          <Text style={StyleSheet.flatten([styles.packTitle, { color: theme.text }])}>{item.title}</Text>
                          {item.slotPack?.savings ? (
                            <Text style={StyleSheet.flatten([styles.packSavings, { color: theme.success }])}>
                              {best ? 'Best value - ' : ''}Save {item.slotPack.savings} coins
                            </Text>
                          ) : (
                            <Text style={StyleSheet.flatten([styles.packDescription, { color: theme.textSecondary }])}>
                              {item.description}
                            </Text>
                          )}
                        </View>
                        <PrimaryButton
                          label={`${item.priceCoins}`}
                          disabled={isUpdating || coinBalance < item.priceCoins}
                          onPress={() => startPurchase(item)}
                          style={styles.packButton}
                        />
                      </View>
                    );
                  })}
                </>
              )}
            </>
          ) : null}

          <CoinEarnInfo />
        </View>
      </ScrollView>

      {/* Purchase bar for the item being tried on. */}
      {selected && activeCategory !== 'slots' ? (
        <View style={StyleSheet.flatten([styles.actionBar, { backgroundColor: theme.card, borderColor: theme.border }])}>
          <View style={styles.actionText}>
            <Text style={StyleSheet.flatten([styles.actionTitle, { color: theme.text }])} numberOfLines={1}>
              {selected.title}
            </Text>
            {selected.owned ? (
              <Text style={StyleSheet.flatten([styles.actionMeta, { color: theme.success }])}>
                {selected.equipped || isWorn(selected) ? 'Equipped' : 'Owned'}
              </Text>
            ) : (
              <View style={styles.priceRow}>
                <CoinIcon size={14} />
                <Text style={StyleSheet.flatten([styles.actionMeta, { color: theme.text }])}>
                  {selected.priceCoins.toLocaleString()}
                </Text>
                {shortBy > 0 ? (
                  <Text style={StyleSheet.flatten([styles.actionMeta, { color: theme.textSecondary }])}>
                    {' '}
                    · need {shortBy.toLocaleString()} more
                  </Text>
                ) : null}
              </View>
            )}
          </View>
          {renderAction(selected)}
        </View>
      ) : null}

      {lookError ? (
        <Text style={StyleSheet.flatten([styles.lookError, { color: theme.danger, backgroundColor: theme.card }])}>
          {lookError}
        </Text>
      ) : null}

      {savingLook ? (
        <View pointerEvents="none" style={styles.offscreen}>
          <View ref={lookCaptureRef} collapsable={false}>
            <AvatarPortrait
              appearance={avatar.appearance}
              accessories={toAccessoryStyles(savingLook, [
                ...avatar.wardrobe,
                ...wearables.flatMap((item) => (item.wearable ? [item.wearable] : [])),
              ])}
              size={FITTING_ROOM_SIZE}
              showBackground
            />
          </View>
        </View>
      ) : null}

      <ConfirmDialog
        visible={pending !== null}
        title={pending ? `Buy ${pending.title}?` : ''}
        message={
          pending
            ? `This costs ${pending.priceCoins.toLocaleString()} coins. You have ${coinBalance.toLocaleString()}.`
            : ''
        }
        confirmLabel="Buy"
        loading={isUpdating}
        error={purchaseError}
        onConfirm={() => void handleConfirmPurchase()}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  inner: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  fittingRoom: {
    marginTop: Spacing.three,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  fittingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  fittingTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '900',
  },
  portrait: {
    width: FITTING_ROOM_SIZE,
    height: FITTING_ROOM_SIZE,
    borderRadius: FITTING_ROOM_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoteBubble: {
    position: 'absolute',
    top: -4,
    right: -14,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoteBubbleText: {
    fontSize: 28,
  },
  tileEmoji: {
    fontSize: 40,
  },
  tileFrame: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fittingInfo: {
    alignItems: 'center',
    gap: 2,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  selectedTier: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  resetLink: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  fittingHint: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryBar: {
    zIndex: 1,
  },
  categories: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  categoryChip: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  sections: {
    gap: Spacing.four,
  },
  tierSection: {
    gap: Spacing.two,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tierDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  gridFiller: {
    flex: 1,
  },
  premiumCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  premiumTitle: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  premiumCopy: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  slotIntro: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.three,
  },
  packIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packCount: {
    fontSize: 12,
    fontWeight: '900',
  },
  packText: {
    flex: 1,
    gap: 2,
  },
  packTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  packSavings: {
    fontSize: 13,
    fontWeight: '800',
  },
  packDescription: {
    fontSize: 13,
  },
  packButton: {
    minHeight: 42,
    paddingHorizontal: Spacing.three,
  },
  list: {
    gap: Spacing.three,
  },
  errorBlock: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  lookError: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -10000,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionText: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionMeta: {
    fontSize: 13,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.five,
  },
});
