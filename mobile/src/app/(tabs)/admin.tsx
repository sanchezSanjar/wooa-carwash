import { Redirect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { BookingCard } from '@/components/booking-card';
import { AppText, Banner, Button, Card, EmptyState, Loading, Screen } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { dateChip, formatDuration, formatKRW, upcomingDates } from '@/lib/format';
import type { Booking, BookingStatus } from '@/lib/types';

const NEXT_ACTION: Partial<Record<BookingStatus, { status: BookingStatus; label: string }>> = {
  pending: { status: 'confirmed', label: 'Confirm' },
  confirmed: { status: 'in_progress', label: 'Start wash' },
  in_progress: { status: 'completed', label: 'Complete' },
};

export default function AdminScreen() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Redirect href="/" />;
  return <Dashboard />;
}

function Dashboard() {
  const theme = useTheme();
  const dates = useMemo(() => upcomingDates(14), []);
  const [date, setDate] = useState(dates[0]);
  const [tab, setTab] = useState<'bookings' | 'packages'>('bookings');

  return (
    <Screen>
      <AppText variant="title">Manage</AppText>
      <View style={[styles.segment, { backgroundColor: theme.muted }]}>
        {(['bookings', 'packages'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.segmentItem, tab === t && { backgroundColor: theme.card }]}>
            <AppText variant="label" color={tab === t ? theme.text : theme.textSecondary}>
              {t === 'bookings' ? 'Bookings' : 'Packages'}
            </AppText>
          </Pressable>
        ))}
      </View>

      {tab === 'bookings' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
            {dates.map((d, i) => {
              const chip = dateChip(d);
              const active = d === date;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDate(d)}
                  style={[
                    styles.dateChip,
                    { backgroundColor: active ? theme.primary : theme.card, borderColor: active ? theme.primary : theme.border },
                  ]}>
                  <AppText variant="caption" color={active ? '#fff' : theme.textSecondary}>
                    {i === 0 ? 'Today' : chip.weekday}
                  </AppText>
                  <AppText variant="label" color={active ? '#fff' : theme.text}>
                    {chip.month} {chip.day}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          <DayBookings key={date} date={date} />
        </>
      ) : (
        <Packages />
      )}
    </Screen>
  );
}

function DayBookings({ date }: { date: string }) {
  const load = useCallback(() => api.allBookings({ date }), [date]);
  const { data, setData, error, loading, refresh } = useApi(load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const replace = (b: Booking) => setData((list) => list?.map((x) => (x.id === b.id ? { ...x, status: b.status } : x)));

  const act = async (b: Booking, fn: () => Promise<Booking>) => {
    setBusyId(b.id);
    setActionError(null);
    try {
      replace(await fn());
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const active = data?.filter((b) => b.status !== 'cancelled') ?? [];
  const revenue = active.reduce((sum, b) => sum + b.price, 0);

  return (
    <>
      <View style={styles.stats}>
        <Stat label="Bookings" value={String(active.length)} />
        <Stat label="Waiting to confirm" value={String(active.filter((b) => b.status === 'pending').length)} />
        <Stat label="Expected revenue" value={formatKRW(revenue)} />
      </View>
      {error ? <Banner message={error} /> : null}
      {actionError ? <Banner message={actionError} /> : null}
      {loading ? <Loading /> : null}
      {!loading && data?.length === 0 ? <EmptyState icon="calendar-clear-outline" title="No bookings on this day" /> : null}
      {data?.map((b) => {
        const next = NEXT_ACTION[b.status];
        const canCancel = b.status === 'pending' || b.status === 'confirmed';
        return (
          <BookingCard key={b.id} booking={b} showCustomer>
            {next ? (
              <Button
                title={next.label}
                loading={busyId === b.id}
                onPress={() => act(b, () => api.setBookingStatus(b.id, next.status))}
              />
            ) : null}
            {canCancel ? (
              <Button
                title="Cancel"
                variant="danger"
                disabled={busyId === b.id}
                onPress={async () => {
                  if (await confirm('Cancel booking?', `Cancel ${b.customer?.name ?? 'this customer'}'s ${b.serviceName}?`, 'Cancel booking')) {
                    await act(b, () => api.cancelBooking(b.id));
                  }
                }}
              />
            ) : null}
          </BookingCard>
        );
      })}
      {data && data.length > 0 ? <Button title="Refresh" variant="ghost" icon="refresh" onPress={refresh} /> : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 160, gap: 2 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </Card>
  );
}

function Packages() {
  const theme = useTheme();
  const { data, setData, error, loading } = useApi(api.allServices);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggle = async (id: string, active: boolean) => {
    setActionError(null);
    setData((list) => list?.map((s) => (s.id === id ? { ...s, active } : s)));
    try {
      await api.updateService(id, { active });
    } catch (e) {
      setData((list) => list?.map((s) => (s.id === id ? { ...s, active: !active } : s)));
      setActionError(e instanceof Error ? e.message : 'Could not update');
    }
  };

  return (
    <>
      {error ? <Banner message={error} /> : null}
      {actionError ? <Banner message={actionError} /> : null}
      {loading ? <Loading /> : null}
      {data?.map((s) => (
        <Card key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="heading" color={s.active ? theme.text : theme.textSecondary}>
              {s.name}
            </AppText>
            <AppText variant="caption">
              {formatKRW(s.price)} · {formatDuration(s.durationMinutes)} · {s.active ? 'Visible to customers' : 'Hidden'}
            </AppText>
          </View>
          <Switch
            value={s.active}
            onValueChange={(v) => toggle(s.id, v)}
            trackColor={{ true: theme.primary, false: theme.border }}
          />
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: Radius.md, alignSelf: 'flex-start' },
  segmentItem: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.sm },
  dateChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
});
