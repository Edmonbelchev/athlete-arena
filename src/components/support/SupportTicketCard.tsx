import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  SUPPORT_TICKET_STATUS_LABELS,
  type SupportTicket,
} from '@/types/support';
import { useTheme } from '@/hooks/use-theme';

interface SupportTicketCardProps {
  ticket: SupportTicket;
}

export function SupportTicketCard({ ticket }: SupportTicketCardProps) {
  const theme = useTheme();
  const createdLabel = new Date(ticket.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <View style={styles.header}>
        <Text style={StyleSheet.flatten([styles.category, { color: theme.primary }])}>
          {SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}
        </Text>
        <Text style={StyleSheet.flatten([styles.status, { color: theme.textSecondary }])}>
          {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
        </Text>
      </View>

      <Text style={StyleSheet.flatten([styles.subject, { color: theme.text }])}>{ticket.subject}</Text>
      <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])} numberOfLines={3}>
        {ticket.message}
      </Text>
      <Text style={StyleSheet.flatten([styles.meta, { color: theme.textSecondary }])}>{createdLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  category: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
  },
  subject: {
    fontSize: 16,
    fontWeight: '800',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
  },
});
