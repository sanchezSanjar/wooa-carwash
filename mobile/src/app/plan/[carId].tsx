import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CarCard } from '@/components/car-card';
import { Stars } from '@/components/stars';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  DateStrip,
  EmptyState,
  Loading,
  Screen,
  SectionTitle,
} from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatDay, formatKRW, STATUS_LABEL, upcomingDates, WEEKDAYS, WEEKDAYS_LONG } from '@/lib/format';
import {
  emptyPicks,
  picksProblem,
  picksToSchedule,
  previewWashDates,
  scheduleToPicks,
  type DayPicks,
} from '@/lib/schedule';
import type { Car, Extra, Subscription, Tariff } from '@/lib/types';

/** Monday first, the way people plan their week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function PlanScreen() {
  const { carId } = useLocalSearchParams<{ carId: string }>();
  const load = useCallback(async () => {
    const [cars, subs, tariffs, extras] = await Promise.all([
      api.myCars(),
      api.mySubscriptions(),
      api.tariffs(),
      api.extras(),
    ]);
    return {
      car: cars.find((c) => c.id === carId) ?? null,
      sub: subs.find((s) => s.carId === carId && s.status === 'active') ?? null,
      tariffs,
      extras,
    };
  }, [carId]);
  const { data, error, loading } = useApi(load);

  if (loading) return <Loading />;
  if (error || !data?.car) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Car not found" message={error ?? undefined} />
      </Screen>
    );
  }
  return (
    <PlanEditor
      key={data.sub?.id ?? 'new'}
      car={data.car}
      sub={data.sub}
      tariffs={data.tariffs}
      extras={data.extras}
    />
  );
}

function PlanEditor({
  car,
  sub,
  tariffs,
  extras,
}: {
  car: Car;
  sub: Subscription | null;
  tariffs: Tariff[];
  extras: Extra[];
}) {
  const theme = useTheme();
  const isNew = !sub;
  const startDates = useMemo(() => upcomingDates(21), []);
  const [tariffId, setTariffId] = useState(sub?.tariffId ?? tariffs[1]?.id ?? tariffs[0]?.id);
  const [picks, setPicks] = useState<DayPicks>(sub ? scheduleToPicks(sub.schedule) : emptyPicks());
  const [startDate, setStartDate] = useState(sub?.startDate ?? startDates[0]);
  const [extraIds, setExtraIds] = useState<string[]>(sub?.extras.map((e) => e.id) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // An existing plan keeps the price it started with until the member switches to another tariff.
  const tariffChanged = !!sub && tariffId !== sub.tariffId;
  const tariff: Pick<Tariff, 'id' | 'name' | 'washesPerMonth' | 'price'> | undefined =
    sub && !tariffChanged
      ? { id: sub.tariffId, name: sub.tariffName, washesPerMonth: sub.washesPerMonth, price: sub.tariffPrice }
      : tariffs.find((t) => t.id === tariffId);
  const perMonth = tariff?.washesPerMonth ?? 0;
  const schedule = picksToSchedule(picks);
  const problem = tariff ? picksProblem(picks, perMonth) : 'Choose a plan';
  const preview = problem ? [] : previewWashDates(schedule, isNew ? startDate : startDates[0], 6);

  const extraPrice = (id: string) =>
    extras.find((e) => e.id === id)?.price ?? sub?.extras.find((e) => e.id === id)?.price ?? 0;
  const extrasPerWash = extraIds.reduce((sum, id) => sum + extraPrice(id), 0);
  const monthly = (tariff?.price ?? 0) + extrasPerWash * perMonth;

  const chooseTariff = (t: Tariff) => {
    if (t.id === tariffId) return;
    setTariffId(t.id);
    // back to the current plan: restore its days; another plan: pick new days
    setPicks(sub && t.id === sub.tariffId ? scheduleToPicks(sub.schedule) : emptyPicks());
  };

  const toggleExtra = (id: string) =>
    setExtraIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    if (!tariff || problem) return;
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await api.subscribe({ carId: car.id, tariffId: tariff.id, startDate, schedule, extraIds });
      } else if (tariffChanged) {
        await api.changeTariff(sub.id, { tariffId: tariff.id, schedule });
        await api.updateSubscription(sub.id, { extraIds });
      } else {
        await api.updateSubscription(sub.id, { schedule, extraIds });
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the plan');
    } finally {
      setBusy(false);
    }
  };

  const cancelPlan = async () => {
    if (!sub) return;
    const ok = await confirm('Cancel wash plan?', `Washes for ${car.plateNumber} will stop.`, 'Cancel plan');
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api.cancelSubscription(sub.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel the plan');
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={{ maxWidth: 720 }}>
      <Stack.Screen options={{ title: isNew ? 'Choose a wash plan' : 'Manage wash plan' }} />
      <CarCard car={car}>{sub ? <Badge label="Active" tone="success" /> : null}</CarCard>

      <SectionTitle hint={isNew ? 'Monthly price per car.' : 'Switch to another plan any time; the new price applies from the next bill.'}>
        1. Plan
      </SectionTitle>
      {sub ? (
        <AppText variant="caption">
          Current: {sub.tariffName} · {sub.washesPerMonth} washes a month · since {formatDay(sub.startDate)}
        </AppText>
      ) : null}
      {tariffs.length ? (
        <View style={styles.tariffs}>
          {tariffs.map((t) => {
            const selected = t.id === tariffId;
            return (
              <Pressable
                key={t.id}
                onPress={() => chooseTariff(t)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.tariff,
                  { backgroundColor: selected ? theme.primarySoft : theme.card, borderColor: selected ? theme.primary : theme.border },
                ]}>
                <AppText variant="heading">{t.name}</AppText>
                <AppText variant="label" color={theme.primary}>
                  {formatKRW(t.price)} / month
                </AppText>
                <AppText variant="caption">{t.washesPerMonth} washes per month</AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {tariff ? (
        <>
          <SectionTitle hint={scheduleHint(perMonth)}>2. Wash days</SectionTitle>
          <DayPicker perMonth={perMonth} picks={picks} onChange={setPicks} />
        </>
      ) : null}

      {isNew ? (
        <>
          <SectionTitle>3. Start date</SectionTitle>
          <DateStrip dates={startDates} value={startDate} onChange={setStartDate} />
        </>
      ) : null}

      <SectionTitle hint="Done with every wash of this car.">{isNew ? '4. Extra services' : '3. Extra services'}</SectionTitle>
      <Card style={{ gap: Spacing.sm }}>
        {extras.map((e) => {
          const on = extraIds.includes(e.id);
          return (
            <Pressable key={e.id} onPress={() => toggleExtra(e.id)} style={styles.extraRow} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? theme.primary : theme.textSecondary} />
              <View style={{ flex: 1 }}>
                <AppText variant="label">{e.name}</AppText>
                {e.description ? <AppText variant="caption">{e.description}</AppText> : null}
              </View>
              <AppText variant="caption">+{formatKRW(e.price)} / wash</AppText>
            </Pressable>
          );
        })}
      </Card>

      <Card style={{ gap: Spacing.sm, borderColor: theme.primary }}>
        <View style={styles.totalRow}>
          <AppText variant="label">{tariff?.name ?? 'Plan'}</AppText>
          <AppText variant="label">{formatKRW(tariff?.price ?? 0)}</AppText>
        </View>
        {extrasPerWash > 0 ? (
          <View style={styles.totalRow}>
            <AppText variant="caption">
              Extras {formatKRW(extrasPerWash)} × {perMonth} washes
            </AppText>
            <AppText variant="caption">{formatKRW(extrasPerWash * perMonth)}</AppText>
          </View>
        ) : null}
        <View style={[styles.totalRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: Spacing.sm }]}>
          <AppText variant="heading">Monthly total</AppText>
          <AppText variant="heading" color={theme.primary}>
            {formatKRW(monthly)}
          </AppText>
        </View>
        {preview.length > 0 ? (
          <AppText variant="caption">Next washes: {preview.map(formatDay).join(' · ')}</AppText>
        ) : null}
      </Card>

      {error ? <Banner message={error} /> : null}
      {problem ? <AppText variant="caption" style={{ textAlign: 'center' }}>{problem}</AppText> : null}
      <Button title={isNew ? 'Start wash plan' : tariffChanged ? `Switch to ${tariff?.name}` : 'Save changes'} disabled={!!problem} loading={busy} onPress={submit} />
      {sub ? <Button title="Cancel wash plan" variant="danger" disabled={busy} onPress={cancelPlan} /> : null}

      {sub && sub.history.length > 0 ? (
        <>
          <SectionTitle>Recent washes</SectionTitle>
          <Card style={{ gap: Spacing.sm }}>
            {sub.history.map((h) => (
              <Pressable
                key={h.date}
                style={styles.totalRow}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/wash/[subscriptionId]/[date]', params: { subscriptionId: sub.id, date: h.date } })}>
                <View style={{ flex: 1 }}>
                  <AppText variant="label">{formatDay(h.date)}</AppText>
                  <AppText variant="caption">
                    {h.photos ? `${h.photos} photo${h.photos > 1 ? 's' : ''}` : 'No photos'}
                    {h.status === 'done' && !h.rating ? ' · tap to rate' : ''}
                  </AppText>
                </View>
                {h.rating ? <Stars value={h.rating} size={14} /> : null}
                <Badge label={STATUS_LABEL[h.status]} tone={h.status === 'done' ? 'success' : 'neutral'} />
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function scheduleHint(perMonth: number) {
  if (perMonth === 2) return 'One day, every other week.';
  if (perMonth === 4) return 'One day, every week.';
  return 'Two days in weeks 1 & 3, one day in weeks 2 & 4.';
}

function DayPicker({
  perMonth,
  picks,
  onChange,
}: {
  perMonth: number;
  picks: DayPicks;
  onChange: (p: DayPicks) => void;
}) {
  if (perMonth === 4) {
    return (
      <Card>
        <AppText variant="label">Every week on</AppText>
        <WeekdayRow
          selected={picks.everyWeek}
          onToggle={(d) => onChange({ ...emptyPicks(), everyWeek: [d] })}
        />
        {picks.everyWeek[0] !== undefined ? (
          <AppText variant="caption">Every {WEEKDAYS_LONG[picks.everyWeek[0]]} (1st–4th of the month)</AppText>
        ) : null}
      </Card>
    );
  }

  if (perMonth === 2) {
    const day = picks.oddWeeks[0] ?? picks.evenWeeks[0];
    const even = picks.evenWeeks.length > 0;
    const set = (d: number | undefined, useEven: boolean) =>
      onChange({ ...emptyPicks(), ...(d === undefined ? {} : useEven ? { evenWeeks: [d] } : { oddWeeks: [d] }) });
    return (
      <Card>
        <AppText variant="label">Day</AppText>
        <WeekdayRow selected={day === undefined ? [] : [day]} onToggle={(d) => set(d, even)} />
        <AppText variant="label" style={{ marginTop: Spacing.sm }}>
          Weeks
        </AppText>
        <View style={styles.wrap}>
          <Chip label="1st & 3rd" selected={!even} onPress={() => set(day, false)} />
          <Chip label="2nd & 4th" selected={even} onPress={() => set(day, true)} />
        </View>
        {day !== undefined ? (
          <AppText variant="caption">
            {even ? '2nd and 4th' : '1st and 3rd'} {WEEKDAYS_LONG[day]} of every month
          </AppText>
        ) : null}
      </Card>
    );
  }

  // 6 per month: two days in weeks 1 & 3, one day in weeks 2 & 4
  const toggleOdd = (d: number) => {
    const has = picks.oddWeeks.includes(d);
    const next = has ? picks.oddWeeks.filter((x) => x !== d) : [...picks.oddWeeks, d].slice(-2);
    onChange({ ...picks, oddWeeks: next, everyWeek: [] });
  };
  return (
    <Card style={{ gap: Spacing.md }}>
      <View style={{ gap: Spacing.xs }}>
        <AppText variant="label">Weeks 1 & 3 · choose 2 days</AppText>
        <WeekdayRow selected={picks.oddWeeks} disabled={picks.evenWeeks} onToggle={toggleOdd} />
      </View>
      <View style={{ gap: Spacing.xs }}>
        <AppText variant="label">Weeks 2 & 4 · choose 1 day</AppText>
        <WeekdayRow
          selected={picks.evenWeeks}
          disabled={picks.oddWeeks}
          onToggle={(d) => onChange({ ...picks, evenWeeks: picks.evenWeeks.includes(d) ? [] : [d], everyWeek: [] })}
        />
      </View>
    </Card>
  );
}

function WeekdayRow({
  selected,
  disabled = [],
  onToggle,
}: {
  selected: number[];
  disabled?: number[];
  onToggle: (d: number) => void;
}) {
  return (
    <View style={styles.wrap}>
      {WEEK_ORDER.map((d) => (
        <Chip
          key={d}
          label={WEEKDAYS[d]}
          selected={selected.includes(d)}
          disabled={disabled.includes(d)}
          onPress={() => onToggle(d)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tariffs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tariff: { flexGrow: 1, flexBasis: 180, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1.5, gap: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
});
