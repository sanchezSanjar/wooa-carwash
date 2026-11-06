import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, EmptyState, Loading, Screen, TextField } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateChip, formatDate, formatDuration, formatKRW, formatTime, upcomingDates } from '@/lib/format';
import type { Booking, Slot } from '@/lib/types';

const DAYS_SHOWN = 14;

export default function BookScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const loadService = useCallback(() => api.service(serviceId), [serviceId]);
  const service = useApi(loadService);

  const dates = useMemo(() => upcomingDates(DAYS_SHOWN), []);
  const [date, setDateState] = useState(dates[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [notes, setNotes] = useState('');
  const [plateError, setPlateError] = useState<string>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [now] = useState(() => Date.now());

  // Results are tagged with the request they belong to, so a stale response never shows.
  const slotKey = `${serviceId}|${date}|${reloadKey}`;
  const [loaded, setLoaded] = useState<{ key: string; slots?: Slot[]; error?: string }>({ key: '' });
  const slots = loaded.key === slotKey ? (loaded.slots ?? null) : null;
  const slotsError = loaded.key === slotKey ? (loaded.error ?? null) : null;

  useEffect(() => {
    let cancelled = false;
    api
      .availability(date, serviceId)
      .then((s) => !cancelled && setLoaded({ key: slotKey, slots: s }))
      .catch(
        (e) =>
          !cancelled &&
          setLoaded({ key: slotKey, error: e instanceof Error ? e.message : 'Could not load times' }),
      );
    return () => {
      cancelled = true;
    };
  }, [date, serviceId, slotKey]);

  const setDate = (d: string) => {
    setDateState(d);
    setSelected(null);
  };

  const submit = async () => {
    if (!user) {
      router.push({ pathname: '/login', params: { next: `/book/${serviceId}` } });
      return;
    }
    if (!plate.trim()) {
      setPlateError('Enter your plate number');
      return;
    }
    if (!selected) return;
    setPlateError(undefined);
    setSubmitError(null);
    setBusy(true);
    try {
      setDone(
        await api.createBooking({
          serviceId,
          startsAt: selected,
          vehicle: { plate: plate.trim(), model: model.trim() || undefined },
          notes: notes.trim() || undefined,
        }),
      );
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not book this slot');
      setSelected(null);
      setReloadKey((k) => k + 1); // the slot may have just been taken
    } finally {
      setBusy(false);
    }
  };

  if (service.loading) return <Loading />;
  if (service.error || !service.data) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Package not found" message={service.error ?? undefined} />
      </Screen>
    );
  }
  const s = service.data;

  if (done) {
    return (
      <Screen contentStyle={{ maxWidth: 520 }}>
        <Stack.Screen options={{ title: 'Booked', headerBackVisible: false }} />
        <EmptyState
          icon="checkmark-circle"
          title="You're booked!"
          message={`${done.serviceName} on ${formatDate(done.startsAt)} at ${formatTime(done.startsAt)}. We'll confirm it shortly.`}
        />
        <Button title="View my bookings" onPress={() => router.replace('/bookings')} />
        <Button title="Back to packages" variant="ghost" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const openSlots = slots?.filter((x) => x.available) ?? [];

  return (
    <Screen contentStyle={{ maxWidth: 720 }}>
      <Stack.Screen options={{ title: s.name }} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="water" size={22} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{s.name}</AppText>
          <AppText variant="caption">
            {formatDuration(s.durationMinutes)} · {formatKRW(s.price)}
          </AppText>
        </View>
      </Card>

      <AppText variant="heading">1. Pick a day</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
        {dates.map((d, i) => {
          const chip = dateChip(d);
          const active = d === date;
          return (
            <Pressable
              key={d}
              onPress={() => setDate(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.dateChip,
                {
                  backgroundColor: active ? theme.primary : theme.card,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}>
              <AppText variant="caption" color={active ? '#fff' : theme.textSecondary}>
                {i === 0 ? 'Today' : chip.weekday}
              </AppText>
              <AppText variant="heading" color={active ? '#fff' : theme.text}>
                {chip.day}
              </AppText>
              <AppText variant="caption" color={active ? '#fff' : theme.textSecondary}>
                {chip.month}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <AppText variant="heading">2. Pick a time</AppText>
      {slotsError ? <Banner message={slotsError} /> : null}
      {!slots && !slotsError ? <Loading /> : null}
      {slots && openSlots.length === 0 ? (
        <AppText variant="caption">No free times on this day. Try another day.</AppText>
      ) : null}
      <View style={styles.slots}>
        {slots
          ?.filter((x) => Date.parse(x.startsAt) > now)
          .map((slot) => {
            const active = slot.startsAt === selected;
            return (
              <Pressable
                key={slot.startsAt}
                disabled={!slot.available}
                onPress={() => setSelected(slot.startsAt)}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !slot.available }}
                style={[
                  styles.slot,
                  {
                    backgroundColor: active ? theme.primary : slot.available ? theme.card : theme.muted,
                    borderColor: active ? theme.primary : theme.border,
                  },
                ]}>
                <AppText
                  variant="label"
                  color={active ? '#fff' : slot.available ? theme.text : theme.textSecondary}
                  style={!slot.available && { textDecorationLine: 'line-through' }}>
                  {formatTime(slot.startsAt)}
                </AppText>
              </Pressable>
            );
          })}
      </View>

      <AppText variant="heading">3. Your car</AppText>
      <View style={styles.fields}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <TextField
            label="Plate number"
            value={plate}
            onChangeText={setPlate}
            placeholder="12가 3456"
            autoCapitalize="characters"
            error={plateError}
          />
        </View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <TextField label="Model (optional)" value={model} onChangeText={setModel} placeholder="Hyundai Avante" />
        </View>
      </View>
      <TextField
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything we should know?"
        multiline
        style={{ minHeight: 80, paddingTop: Spacing.md, textAlignVertical: 'top' }}
      />

      {submitError ? <Banner message={submitError} /> : null}
      <Button
        title={
          !user
            ? 'Log in to book'
            : selected
              ? `Book ${formatDate(selected)} at ${formatTime(selected)}`
              : 'Choose a time'
        }
        disabled={!!user && !selected}
        loading={busy}
        onPress={submit}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dateChip: {
    width: 64,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slot: {
    width: 76,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
});
