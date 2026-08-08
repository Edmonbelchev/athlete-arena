import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/app';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

async function openLegalPage(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  await openBrowserAsync(url, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
}

interface LegalLinkProps {
  label: string;
  url: string;
}

function LegalLink({ label, url }: LegalLinkProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void openLegalPage(url)}>
      <Text style={StyleSheet.flatten([styles.link, { color: theme.primary }])}>{label}</Text>
    </Pressable>
  );
}

export function LegalAgreementNotice() {
  const theme = useTheme();

  return (
    <View style={styles.agreementRow}>
      <Text style={StyleSheet.flatten([styles.agreementText, { color: theme.textSecondary }])}>
        By creating an account, you agree to our{' '}
      </Text>
      <LegalLink label="Terms of Service" url={TERMS_OF_SERVICE_URL} />
      <Text style={StyleSheet.flatten([styles.agreementText, { color: theme.textSecondary }])}> and </Text>
      <LegalLink label="Privacy Policy" url={PRIVACY_POLICY_URL} />
      <Text style={StyleSheet.flatten([styles.agreementText, { color: theme.textSecondary }])}>.</Text>
    </View>
  );
}

export function LegalLinksFooter() {
  const theme = useTheme();

  return (
    <View style={styles.footerRow}>
      <LegalLink label="Terms of Service" url={TERMS_OF_SERVICE_URL} />
      <Text style={StyleSheet.flatten([styles.footerDivider, { color: theme.textSecondary }])}>·</Text>
      <LegalLink label="Privacy Policy" url={PRIVACY_POLICY_URL} />
    </View>
  );
}

export function LegalLinksSection() {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.text }])}>Legal</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Terms of Service"
        onPress={() => void openLegalPage(TERMS_OF_SERVICE_URL)}
        style={StyleSheet.flatten([
          styles.sectionLink,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.sectionLinkLabel, { color: theme.text }])}>
          Terms of Service
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
        onPress={() => void openLegalPage(PRIVACY_POLICY_URL)}
        style={StyleSheet.flatten([
          styles.sectionLink,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.sectionLinkLabel, { color: theme.text }])}>
          Privacy Policy
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  agreementRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreementText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  link: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  footerDivider: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionLink: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  sectionLinkLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
