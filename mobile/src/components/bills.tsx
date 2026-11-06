import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatDay, formatKRW, formatMonth } from '@/lib/format';
import type { Invoice } from '@/lib/types';

import { AppText, Badge, Card, SectionTitle } from './ui';

export function InvoiceStatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.status === 'paid') return <Badge label="Paid" tone="success" />;
  if (invoice.status === 'void') return <Badge label="Cancelled" />;
  return <Badge label={invoice.overdue ? 'Overdue' : 'Unpaid'} tone="warning" />;
}

/** The member's monthly bills with how to pay. */
export function MyBills() {
  const theme = useTheme();
  const { data } = useApi(useCallback(() => api.myInvoices(), []));
  const [open, setOpen] = useState<string | null>(null);
  if (!data || data.invoices.length === 0) return null;

  const unpaid = data.invoices.filter((i) => i.status === 'unpaid');
  const owed = unpaid.reduce((s, i) => s + i.amount, 0);

  return (
    <View style={{ gap: Spacing.md }}>
      <SectionTitle hint={data.bankAccount ? `Pay by bank transfer to ${data.bankAccount}` : undefined}>Bills</SectionTitle>
      {owed > 0 ? (
        <Card style={{ backgroundColor: theme.warningSoft, borderColor: theme.warningSoft }}>
          <AppText variant="label" color={theme.warning}>
            {formatKRW(owed)} to pay · {unpaid.length} bill{unpaid.length > 1 ? 's' : ''}
          </AppText>
        </Card>
      ) : null}
      <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
        {data.invoices.map((inv, i) => (
          <Pressable
            key={inv.id}
            onPress={() => setOpen(open === inv.id ? null : inv.id)}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <AppText variant="label">
                  {formatMonth(inv.month)} · {inv.plateNumber}
                </AppText>
                <AppText variant="caption">
                  {inv.status === 'paid' && inv.paidAt ? `Paid ${formatDay(inv.paidAt.slice(0, 10))}` : `Due ${formatDay(inv.dueDate)}`}
                </AppText>
              </View>
              <AppText variant="label">{formatKRW(inv.amount)}</AppText>
              <InvoiceStatusBadge invoice={inv} />
            </View>
            {open === inv.id ? (
              <View style={{ gap: 2, marginTop: Spacing.sm }}>
                {inv.lines.map((l) => (
                  <View key={l.label} style={styles.line}>
                    <AppText variant="caption" style={{ flex: 1 }}>
                      {l.label}
                    </AppText>
                    <AppText variant="caption">{formatKRW(l.amount)}</AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flexDirection: 'row', gap: Spacing.md },
});
