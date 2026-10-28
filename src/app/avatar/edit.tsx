import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ColorSwatches,
  EditorSection,
  OptionTiles,
  SegmentedControl,
} from '@/components/avatar/AvatarEditorControls';
import { AvatarPortrait } from '@/components/avatar/AvatarPortrait';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  ACCESSORY_SLOTS,
  BACKGROUND_COLORS,
  BODY_TYPE_CHOICES,
  BROW_CHOICES,
  DEFAULT_APPEARANCE,
  EYE_CHOICES,
  EYE_COLORS,
  FACIAL_HAIR_CHOICES,
  HAIR_CHOICES,
  HAIR_COLORS,
  HEAD_SHAPE_CHOICES,
  MOUTH_CHOICES,
  NOSE_CHOICES,
  SKIN_COLORS,
  changeBodyType,
  choicesForBody,
  normalizeAccessories,
  randomizeAppearance,
  wearableFitsBody,
  type AvatarChoice,
} from '@/features/avatar/avatarOptions';
import { toAccessoryStyles } from '@/features/avatar/avatarWardrobe';
import { saveAvatarWithHeadshot } from '@/features/avatar/saveAvatarWithHeadshot';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { getMyAvatar, getMyWardrobe } from '@/services/avatarService';
import type { AccessorySlot, AvatarAccessories, AvatarAppearance, WearableItem } from '@/types/avatar';

type EditorTab = 'face' | 'eyes' | 'mouth' | 'hair' | 'beard' | 'outfit';

const TABS: { id: EditorTab; label: string; maleOnly?: boolean }[] = [
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'mouth', label: 'Mouth' },
  { id: 'beard', label: 'Beard', maleOnly: true },
  { id: 'outfit', label: 'Outfit' },
];

const PREVIEW_SIZE = 148;

export default function AvatarEditorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, refresh: refreshProfile } = useProfile();
  // `equip` comes from the shop's "Wear" button: open the outfit tab already wearing the item.
  const { source, equip } = useLocalSearchParams<{ source?: string; equip?: string }>();
  const isOnboarding = source === 'onboarding';
  const portraitRef = useRef<View>(null);

  const [tab, setTab] = useState<EditorTab>('face');
  const [appearance, setAppearance] = useState<AvatarAppearance>(DEFAULT_APPEARANCE.male);
  const [accessories, setAccessories] = useState<AvatarAccessories>({});
  const [wardrobe, setWardrobe] = useState<WearableItem[]>([]);
  const [isNew, setIsNew] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Frames are shop items equipped separately from the avatar; applied on Save.
  const { items: shopItems, summary: shopSummary, equipItem, removeFrame } = useShop();
  const equippedFrameId = shopSummary.equipped.frame ?? null;
  const [frameId, setFrameId] = useState<string | null>(equippedFrameId);
  const ownedFrames = shopItems.filter((item) => item.itemType === 'frame' && item.owned);
  const selectedFrame = ownedFrames.find((item) => item.id === frameId) ?? null;

  // The shop summary may finish loading after this screen opens.
  useEffect(() => {
    setFrameId(equippedFrameId);
  }, [equippedFrameId]);

  const userId = profile?.id;

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    async function load(id: string) {
      try {
        const [saved, items] = await Promise.all([getMyAvatar(id), getMyWardrobe()]);
        if (cancelled) {
          return;
        }

        const initialAppearance = saved?.appearance ?? DEFAULT_APPEARANCE.male;
        const equipItem = items.find((item) => item.id === equip);
        const initialAccessories = equipItem
          ? { ...saved?.accessories, [equipItem.slot]: equipItem.id }
          : (saved?.accessories ?? {});
        setWardrobe(items);
        setAppearance(initialAppearance);
        setAccessories(normalizeAccessories(initialAccessories, items, initialAppearance.bodyType));
        if (equipItem) {
          setTab('outfit');
        }
        setIsNew(!saved);
      } catch (err) {
        if (!cancelled) {
          setError(formatUserError(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load(userId);

    return () => {
      cancelled = true;
    };
  }, [equip, userId]);

  const accessoryStyles = useMemo(() => toAccessoryStyles(accessories, wardrobe), [accessories, wardrobe]);

  const update = useCallback(<K extends keyof AvatarAppearance>(key: K, value: AvatarAppearance[K]) => {
    setAppearance((current) => ({ ...current, [key]: value }));
  }, []);

  const bodyType = appearance.bodyType;
  const tabs = TABS.filter((entry) => !entry.maleOnly || bodyType === 'male');
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : 'face';
  const fittingWardrobe = wardrobe.filter((item) => item.owned && wearableFitsBody(item, bodyType));

  function handleBodyType(nextBodyType: AvatarAppearance['bodyType']) {
    if (nextBodyType === bodyType) {
      return;
    }
    setAppearance(changeBodyType(appearance, nextBodyType));
    setAccessories(normalizeAccessories(accessories, wardrobe, nextBodyType));
  }

  function handleAccessory(slot: AccessorySlot, itemId: string | undefined) {
    setAccessories((current) => {
      const next = { ...current };
      if (itemId) {
        next[slot] = itemId;
      } else {
        delete next[slot];
      }
      return next;
    });
  }

  /** Tiles for an appearance attribute, each previewing the avatar with that option. */
  function renderAppearanceTiles<K extends keyof AvatarAppearance>(
    key: K,
    choices: AvatarChoice<Extract<AvatarAppearance[K], string>>[],
    crop: 'portrait' | 'face'
  ) {
    return (
      <OptionTiles
        options={choicesForBody(choices, bodyType)}
        value={appearance[key] as Extract<AvatarAppearance[K], string>}
        onChange={(value) => update(key, value as AvatarAppearance[K])}
        renderPreview={(id, size) => (
          <AvatarPortrait
            appearance={{ ...appearance, [key]: id }}
            accessories={accessoryStyles}
            size={size}
            crop={crop}
          />
        )}
      />
    );
  }

  async function handleSave() {
    if (!userId) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await saveAvatarWithHeadshot({ userId, appearance, accessories, portraitRef });
      if (frameId !== equippedFrameId) {
        await (frameId ? equipItem(frameId) : removeFrame());
      }
      await refreshProfile();
      leaveScreen(router, '/(tabs)');
    } catch (err) {
      setError(formatUserError(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isOnboarding || isNew ? 'Create Your Avatar' : 'Edit Avatar',
          headerShown: true,
          headerBackVisible: false,
          gestureEnabled: !isOnboarding,
          headerLeft: isOnboarding
            ? () => null
            : () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close avatar editor"
                  onPress={() => leaveScreen(router)}
                  style={styles.headerBack}>
                  <AppIcon name="chevronBack" size={22} color={theme.text} />
                </Pressable>
              ),
          headerRight: isOnboarding
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Skip avatar creation"
                  onPress={() => leaveScreen(router, '/(tabs)')}
                  style={styles.headerBack}>
                  <Text style={StyleSheet.flatten([styles.skipLabel, { color: theme.textSecondary }])}>Skip</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <>
            {/* One scrolling page: the portrait scrolls away and the tab bar sticks to the top,
                so the options always get the full screen height. */}
            <ScrollView style={styles.scroll} stickyHeaderIndices={[1]}>
              <View style={StyleSheet.flatten([styles.hero, { backgroundColor: theme.card, borderColor: theme.border }])}>
                {isOnboarding ? (
                  <View style={styles.welcome}>
                    <Text style={StyleSheet.flatten([styles.welcomeTitle, { color: theme.text }])}>
                      Welcome to the Arena!
                    </Text>
                    <Text style={StyleSheet.flatten([styles.welcomeText, { color: theme.textSecondary }])}>
                      Pick male or female, then make the avatar your own.
                    </Text>
                  </View>
                ) : null}
                <View style={styles.portraitWrap}>
                  <View
                    style={StyleSheet.flatten([
                      styles.portrait,
                      { borderColor: selectedFrame?.metadata.borderColor ?? theme.card },
                    ])}>
                    {/* The square inside the round frame is what gets saved as the profile picture. */}
                    <View ref={portraitRef} collapsable={false}>
                      <AvatarPortrait
                        appearance={appearance}
                        accessories={accessoryStyles}
                        size={PREVIEW_SIZE}
                        showBackground
                      />
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Randomize avatar"
                    onPress={() => setAppearance(randomizeAppearance(bodyType))}
                    style={StyleSheet.flatten([
                      styles.shuffle,
                      { backgroundColor: theme.primary, borderColor: theme.card },
                    ])}>
                    <AppIcon name="shuffle" size={18} color="#FFFFFF" weight="bold" />
                  </Pressable>
                </View>
                <View style={styles.heroControls}>
                  <SegmentedControl options={BODY_TYPE_CHOICES} value={bodyType} onChange={handleBodyType} />
                </View>
              </View>

              <View style={StyleSheet.flatten([styles.tabsBar, { backgroundColor: theme.background }])}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                  {tabs.map((entry) => {
                    const selected = entry.id === activeTab;
                    return (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        onPress={() => setTab(entry.id)}
                        style={StyleSheet.flatten([
                          styles.tab,
                          selected
                            ? { backgroundColor: theme.primary, borderColor: theme.primary }
                            : { backgroundColor: theme.card, borderColor: theme.border },
                        ])}>
                        <Text style={StyleSheet.flatten([styles.tabLabel, { color: selected ? '#FFFFFF' : theme.text }])}>
                          {entry.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.content}>
                {activeTab === 'face' ? (
                  <>
                    <EditorSection title="Skin tone">
                      <ColorSwatches
                        colors={SKIN_COLORS}
                        value={appearance.skinColor}
                        onChange={(value) => update('skinColor', value)}
                      />
                    </EditorSection>
                    <EditorSection title="Head shape">
                      {renderAppearanceTiles('headShape', HEAD_SHAPE_CHOICES, 'portrait')}
                    </EditorSection>
                    <EditorSection title="Nose">{renderAppearanceTiles('nose', NOSE_CHOICES, 'face')}</EditorSection>
                  </>
                ) : null}

                {activeTab === 'hair' ? (
                  <>
                    <EditorSection title="Hair color">
                      <ColorSwatches
                        colors={HAIR_COLORS}
                        value={appearance.hairColor}
                        onChange={(value) => update('hairColor', value)}
                      />
                    </EditorSection>
                    <EditorSection title="Hairstyle">{renderAppearanceTiles('hair', HAIR_CHOICES, 'portrait')}</EditorSection>
                  </>
                ) : null}

                {activeTab === 'eyes' ? (
                  <>
                    <EditorSection title="Eye color">
                      <ColorSwatches
                        colors={EYE_COLORS}
                        value={appearance.eyeColor}
                        onChange={(value) => update('eyeColor', value)}
                      />
                    </EditorSection>
                    <EditorSection title="Eyes">{renderAppearanceTiles('eyes', EYE_CHOICES, 'face')}</EditorSection>
                    <EditorSection title="Eyebrows">{renderAppearanceTiles('brows', BROW_CHOICES, 'face')}</EditorSection>
                  </>
                ) : null}

                {activeTab === 'mouth' ? (
                  <EditorSection title="Mouth">{renderAppearanceTiles('mouth', MOUTH_CHOICES, 'face')}</EditorSection>
                ) : null}

                {activeTab === 'beard' ? (
                  <EditorSection title="Facial hair">
                    {renderAppearanceTiles('facialHair', FACIAL_HAIR_CHOICES, 'face')}
                  </EditorSection>
                ) : null}

                {activeTab === 'outfit' ? (
                  <>
                    {ACCESSORY_SLOTS.map(({ slot, label, required }) => {
                      const items = fittingWardrobe.filter((item) => item.slot === slot);
                      if (items.length === 0) {
                        return null;
                      }
                      const options: { id: string | undefined; label: string }[] = [
                        ...(required ? [] : [{ id: undefined, label: 'None' }]),
                        ...items.map((item) => ({ id: item.id, label: item.title })),
                      ];
                      return (
                        <EditorSection key={slot} title={label}>
                          <OptionTiles
                            options={options}
                            value={accessories[slot]}
                            onChange={(itemId) => handleAccessory(slot, itemId)}
                            renderPreview={(itemId, size) => {
                              const preview = { ...accessories };
                              if (itemId) {
                                preview[slot] = itemId;
                              } else {
                                delete preview[slot];
                              }
                              return (
                                <AvatarPortrait
                                  appearance={appearance}
                                  accessories={toAccessoryStyles(preview, wardrobe)}
                                  size={size}
                                  crop={slot === 'earrings' || slot === 'glasses' ? 'face' : 'portrait'}
                                />
                              );
                            }}
                          />
                        </EditorSection>
                      );
                    })}
                    {ownedFrames.length > 0 ? (
                      <EditorSection title="Frame">
                        <OptionTiles
                          options={[
                            { id: undefined, label: 'None' },
                            ...ownedFrames.map((item) => ({ id: item.id, label: item.title.replace(' Frame', '') })),
                          ]}
                          value={frameId ?? undefined}
                          onChange={(id) => setFrameId(id ?? null)}
                          renderPreview={(id, size) => {
                            const frame = ownedFrames.find((item) => item.id === id);
                            return (
                              <View
                                style={StyleSheet.flatten([
                                  styles.framePreview,
                                  {
                                    width: size - 8,
                                    height: size - 8,
                                    borderRadius: (size - 8) / 2,
                                    borderColor: frame?.metadata.borderColor ?? 'transparent',
                                    borderWidth: frame ? (frame.metadata.borderWidth ?? 3) + 1 : 0,
                                  },
                                ])}>
                                <AvatarPortrait
                                  appearance={appearance}
                                  accessories={accessoryStyles}
                                  size={size - 14}
                                  showBackground
                                />
                              </View>
                            );
                          }}
                        />
                      </EditorSection>
                    ) : null}
                    <EditorSection title="Background">
                      <ColorSwatches
                        colors={BACKGROUND_COLORS}
                        value={appearance.background}
                        onChange={(value) => update('background', value)}
                      />
                    </EditorSection>
                  </>
                ) : null}
              </View>
            </ScrollView>

            <View style={StyleSheet.flatten([styles.footer, { borderColor: theme.border, backgroundColor: theme.card }])}>
              {error ? (
                <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
              ) : null}
              <PrimaryButton
                label={isNew ? 'Create Avatar' : 'Save Avatar'}
                loading={isSaving}
                onPress={() => void handleSave()}
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  skipLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  welcome: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  welcomeText: {
    fontSize: 15,
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  portraitWrap: {
    width: PREVIEW_SIZE + 8,
    height: PREVIEW_SIZE + 8,
  },
  framePreview: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portrait: {
    width: PREVIEW_SIZE + 8,
    height: PREVIEW_SIZE + 8,
    borderRadius: (PREVIEW_SIZE + 8) / 2,
    borderWidth: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  shuffle: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroControls: {
    width: '100%',
    maxWidth: 280,
  },
  scroll: {
    flex: 1,
  },
  tabsBar: {
    zIndex: 1,
  },
  tabs: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  tab: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.five,
    gap: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
