import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsToggleRow } from '@/components/settings/SettingsToggleRow';
import { LegalLinksSection } from '@/components/legal/LegalLinks';
import { ThemeToggle } from '@/components/sidebar/ThemeToggle';
import { BetaBadge } from '@/components/ui/BetaBadge';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { APP_VERSION_LABEL } from '@/constants/app';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { leaveScreen } from '@/lib/navigation';
import { useTheme } from '@/hooks/use-theme';

type SettingsTab = 'appearance';

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const {
    preferences,
    setTheme,
    setShowPoseSkeleton,
    setShowRepProgressBar,
    setRepSoundEnabled,
    isSaving,
    saveError,
  } = useUserSettings();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => leaveScreen(router)}
              style={styles.headerBack}>
              <AppIcon name="chevronBack" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
            Customize how Athlete Arena looks and how the camera behaves during challenges.
          </Text>

          <View style={StyleSheet.flatten([styles.tabRow, { backgroundColor: theme.backgroundSelected }])}>
            {SETTINGS_TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={StyleSheet.flatten([
                    styles.tab,
                    active && { backgroundColor: theme.backgroundElement },
                  ])}>
                  <Text
                    style={StyleSheet.flatten([
                      styles.tabLabel,
                      { color: active ? theme.text : theme.textSecondary },
                    ])}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {activeTab === 'appearance' ? (
            <View style={styles.section}>
              <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.text }])}>
                Theme
              </Text>
              <ThemeToggle preference={preferences.theme} onChange={setTheme} />

              <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.text }])}>
                Camera
              </Text>
              <SettingsToggleRow
                label="Show pose skeleton"
                description="Overlay body tracking lines on the camera preview while you work out."
                value={preferences.showPoseSkeleton}
                onValueChange={setShowPoseSkeleton}
                disabled={isSaving}
              />
              <SettingsToggleRow
                label="Show rep progress bar"
                description="Red-to-green bar on the camera preview while you move through each rep."
                value={preferences.showRepProgressBar}
                onValueChange={setShowRepProgressBar}
                disabled={isSaving}
              />
              <SettingsToggleRow
                label="Rep sound"
                description="Play a soft ding when a rep is counted during workouts."
                value={preferences.repSoundEnabled}
                onValueChange={setRepSoundEnabled}
                disabled={isSaving}
              />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.text }])}>
              Getting started
            </Text>
            <Text style={StyleSheet.flatten([styles.supportCopy, { color: theme.textSecondary }])}>
              Walk through the app intro, exercise tips, and camera practice again.
            </Text>
            <PrimaryButton
              label="Review onboarding"
              variant="secondary"
              onPress={() => router.push('/onboarding?source=settings')}
            />
          </View>

          {saveError ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{saveError}</Text>
          ) : null}

          <View style={styles.section}>
            <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.text }])}>Support</Text>
            <Text style={StyleSheet.flatten([styles.supportCopy, { color: theme.textSecondary }])}>
              Running {APP_VERSION_LABEL}. Report bugs or send feedback through a support ticket.
            </Text>
            <BetaBadge showVersion />
            <PrimaryButton
              label="Open Support"
              variant="secondary"
              onPress={() => router.push('/profile/support')}
            />
          </View>

          <LegalLinksSection />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  supportCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
