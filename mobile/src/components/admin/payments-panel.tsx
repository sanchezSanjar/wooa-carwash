import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { InvoiceStatusBadge } from '@/components/bills';
import { AppText, Banner, Button, Card, Chip, EmptyState, Loading } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatPhone, PAYMENT_METHOD_LABEL, shiftMonth, todayShopDate } from '@/lib/format';
import type { Invoice, InvoiceMonth, PaymentMethod } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

type Filter = 'all' | 'unpaid' | 'paid' | 'overdue';

/** Admin: monthly bills, totals and unpaid customers. Payments are received outside the app. */
export function PaymentsPanel() {
  const theme = useTheme();
  const { t, fmt } = useI18n();
  const [month, setMonth] = useState(() => todayShopDate().slice(0, 7));
  const [filter, setFilter] = useState<Filter>('unpaid');

  const load = useCallback(async (): Promise<{ month: InvoiceMonth; overdue: Invoice[] }> => {
    const [m, overdue] = await Promise.all([api.invoices(month), api.overdueInvoices()]);
    return { month: m, overdue };
  }, [month]);
  const { data, setData, error, loading } = useApi(load);

  const replace = (inv: Invoice) =>
    setData((d) => {
      if (!d) return d;
      const swap = (list: Invoice[]) => list.map((x) => (x.id === inv.id ? inv : x));
      const invoices = swap(d.month.invoices);
      const live = invoices.filter((i) => i.status !== 'void');
      const sum = (s?: string) => live.filter((i) => !s || i.status === s).reduce((s2, i) => s2 + i.amount, 0);
      return {
        month: {
          ...d.month,
          invoices,
          totals: { billed: sum(), paid: sum('paid'), unpaid: sum('unpaid'), count: live.length, unpaidCount: live.filter((i) => i.status === 'unpaid').length },
        },
        overdue: swap(d.overdue).filter((i) => i.status === 'unpaid'),
      };
    });

  const rows =
    filter === 'overdue'
      ? (data?.overdue ?? [])
      : (data?.month.invoices ?? []).filter((i) => filter === 'all' || i.status === filter);

  return (
    <>
      <View style={styles.monthBar}>
        <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} accessibilityLabel={t('Previous month')} style={styles.arrow}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </Pressable>
        <AppText variant="heading">{fmt.month(month)}</AppText>
        <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))} accessibilityLabel={t('Next month')} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={20} color={theme.text} />
        </Pressable>
      </View>

      {error ? <Banner message={error} /> : null}
      {loading ? <Loading /> : null}
      {data ? (
        <View style={styles.stats}>
          <Stat label={t('Billed')} value={fmt.krw(data.month.totals.billed)} sub={fmt.count(data.month.totals.count, '{n} bill', '{n} bills')} />
          <Stat label={t('Received')} value={fmt.krw(data.month.totals.paid)} />
          <Stat label={t('Unpaid')} value={fmt.krw(data.month.totals.unpaid)} sub={fmt.count(data.month.totals.unpaidCount, '{n} bill', '{n} bills')} warn={data.month.totals.unpaid > 0} />
          <Stat label={t('Overdue (all months)')} value={String(data.overdue.length)} warn={data.overdue.length > 0} />
        </View>
      ) : null}

      <View style={styles.chips}>
        {(['unpaid', 'overdue', 'paid', 'all'] as const).map((f) => (
          <Chip key={f} label={t({ unpaid: 'Unpaid', overdue: 'Overdue', paid: 'Paid', all: 'All' }[f])} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      {data && rows.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title={filter === 'unpaid' || filter === 'overdue' ? t('Nothing outstanding') : t('No bills')} />
      ) : null}
      {rows.map((inv) => (
        <BillRow key={inv.id} invoice={inv} onChange={replace} />
      ))}
    </>
  );
}

function BillRow({ invoice, onChange }: { invoice: Invoice; onChange: (i: Invoice) => void }) {
  const { t, fmt } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');

  const set = async (status: 'paid' | 'unpaid') => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.setInvoiceStatus(invoice.id, { status, method: status === 'paid' ? method : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not update the bill'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: Spacing.sm }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <AppText variant="label">
            {invoice.member?.name ?? t('Member')} · {invoice.plateNumber}
          </AppText>
          <AppText variant="caption">
            {t('{apartment} · {month} · due {date}', { apartment: invoice.member?.apartmentName ?? '', month: fmt.month(invoice.month), date: fmt.day(invoice.dueDate) })}
          </AppText>
          {invoice.member?.phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${invoice.member!.phone}`)}>
              <AppText variant="caption">{formatPhone(invoice.member.phone)}</AppText>
            </Pressable>
          ) : null}
        </View>
        <AppText variant="heading">{fmt.krw(invoice.amount)}</AppText>
        <InvoiceStatusBadge invoice={invoice} />
      </View>
      {error ? <Banner message={error} /> : null}
      {invoice.status === 'unpaid' ? (
        <View style={styles.chips}>
          {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
            <Chip key={m} label={fmt.method(m)} selected={method === m} onPress={() => setMethod(m)} />
          ))}
          <Button title={t('Mark paid')} icon="checkmark" loading={busy} onPress={() => set('paid')} />
        </View>
      ) : invoice.status === 'paid' ? (
        <View style={styles.chips}>
          <AppText variant="caption" style={{ flex: 1 }}>
            {invoice.method ? fmt.method(invoice.method) : t('Paid')}
            {invoice.paidAt ? ` · ${fmt.day(invoice.paidAt.slice(0, 10))}` : ''}
          </AppText>
          <Button title={t('Mark unpaid')} variant="ghost" loading={busy} onPress={() => set('unpaid')} />
        </View>
      ) : null}
    </Card>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  const theme = useTheme();
  return (
    <Card style={{ flexGrow: 1, flexBasis: 160, gap: 2 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="heading" color={warn ? theme.warning : theme.text}>
        {value}
      </AppText>
      {sub ? <AppText variant="caption">{sub}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  arrow: { padding: Spacing.xs },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
