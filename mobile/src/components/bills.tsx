import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import type { Invoice } from '@/lib/types';

import { AppText, Badge, Card, SectionTitle } from './ui';
import { useI18n } from '@/lib/i18n';

export function InvoiceStatusBadge({ invoice }: { invoice: Invoice }) {
  const { t } = useI18n();
  if (invoice.status === 'paid') return <Badge label={t('Paid')} tone="success" />;
  if (invoice.status === 'void') return <Badge label={t('Cancelled')} />;
  return <Badge label={invoice.overdue ? t('Overdue') : t('Unpaid')} tone="warning" />;
}

/** The member's monthly bills with how to pay. */
export function MyBills() {
  const theme = useTheme();
  const { t, fmt } = useI18n();
  const { data } = useApi(useCallback(() => api.myInvoices(), []));
  const [open, setOpen] = useState<string | null>(null);
  if (!data || data.invoices.length === 0) return null;

  const unpaid = data.invoices.filter((i) => i.status === 'unpaid');
  const owed = unpaid.reduce((s, i) => s + i.amount, 0);

  return (
    <View style={{ gap: Spacing.md }}>
      <SectionTitle hint={data.bankAccount ? t('Pay by bank transfer to {account}', { account: data.bankAccount }) : undefined}>{t('Bills')}</SectionTitle>
      {owed > 0 ? (
        <Card style={{ backgroundColor: theme.warningSoft, borderColor: theme.warningSoft }}>
          <AppText variant="label" color={theme.warning}>
            {fmt.count(unpaid.length, '{amount} to pay · {n} bill', '{amount} to pay · {n} bills').replace('{amount}', fmt.krw(owed))}
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
                  {fmt.month(inv.month)} · {inv.plateNumber}
                </AppText>
                <AppText variant="caption">
                  {inv.status === 'paid' && inv.paidAt ? t('Paid {date}', { date: fmt.day(inv.paidAt.slice(0, 10)) }) : t('Due {date}', { date: fmt.day(inv.dueDate) })}
                </AppText>
              </View>
              <AppText variant="label">{fmt.krw(inv.amount)}</AppText>
              <InvoiceStatusBadge invoice={inv} />
            </View>
            {open === inv.id ? (
              <View style={{ gap: 2, marginTop: Spacing.sm }}>
                {inv.lines.map((l) => (
                  <View key={l.label} style={styles.line}>
                    <AppText variant="caption" style={{ flex: 1 }}>
                      {fmt.billLine(l)}
                    </AppText>
                    <AppText variant="caption">{fmt.krw(l.amount)}</AppText>
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
