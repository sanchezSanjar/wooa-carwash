import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { CarMeta } from '@/components/car-card';
import { AppText, Badge, Banner, Button, Card, DateStrip, EmptyState, Loading, Screen } from '@/components/ui';
import { Fonts, Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatKRW, STATUS_LABEL, upcomingDates } from '@/lib/format';
import type { DayPlanItem, Extra, Tariff, WashStatus } from '@/lib/types';

export default function AdminScreen() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Redirect href="/" />;
  return <Dashboard />;
}

function Dashboard() {
  const theme = useTheme();
  const [tab, setTab] = useState<'route' | 'prices'>('route');
  return (
    <Screen>
      <AppText variant="title">Manage</AppText>
      <View style={[styles.segment, { backgroundColor: theme.muted }]}>
        {(['route', 'prices'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentItem, tab === t && { backgroundColor: theme.card }]}>
            <AppText variant="label" color={tab === t ? theme.text : theme.textSecondary}>
              {t === 'route' ? 'Wash route' : 'Plans & prices'}
            </AppText>
          </Pressable>
        ))}
      </View>
      {tab === 'route' ? <Route /> : <Prices />}
    </Screen>
  );
}

function Route() {
  const dates = useMemo(() => upcomingDates(14), []);
  const [date, setDate] = useState(dates[0]);
  return (
    <>
      <DateStrip dates={dates} value={date} onChange={setDate} compact />
      <DayRoute key={date} date={date} />
    </>
  );
}

function DayRoute({ date }: { date: string }) {
  const theme = useTheme();
  const load = useCallback(() => api.dayPlan(date), [date]);
  const { data, setData, error, loading, refresh } = useApi(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setStatus = async (item: DayPlanItem, status: WashStatus) => {
    setBusy(item.subscriptionId);
    setActionError(null);
    try {
      await api.setWashStatus({ subscriptionId: item.subscriptionId, date, status });
      setData((list) => list?.map((x) => (x.subscriptionId === item.subscriptionId ? { ...x, status } : x)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(null);
    }
  };

  const items = data ?? [];
  const done = items.filter((i) => i.status === 'done').length;
  const skipped = items.filter((i) => i.status === 'skipped').length;

  // apartment → building → items (the API already sorts by apartment, building, floor)
  const groups: { apartment: string; buildings: { building: string; items: DayPlanItem[] }[] }[] = [];
  for (const item of items) {
    let apt = groups.find((g) => g.apartment === item.member.apartmentName);
    if (!apt) groups.push((apt = { apartment: item.member.apartmentName, buildings: [] }));
    let bldg = apt.buildings.find((b) => b.building === item.car.buildingNumber);
    if (!bldg) apt.buildings.push((bldg = { building: item.car.buildingNumber, items: [] }));
    bldg.items.push(item);
  }

  return (
    <>
      <View style={styles.stats}>
        <Stat label="Cars to wash" value={String(items.length)} />
        <Stat label="Washed" value={String(done)} />
        <Stat label="Remaining" value={String(items.length - done - skipped)} />
      </View>
      {error ? <Banner message={error} /> : null}
      {actionError ? <Banner message={actionError} /> : null}
      {loading ? <Loading /> : null}
      {!loading && items.length === 0 ? <EmptyState icon="sunny-outline" title="No washes scheduled for this day" /> : null}

      {groups.map((g) => (
        <View key={g.apartment} style={{ gap: Spacing.md }}>
          <View style={styles.aptHeader}>
            <Ionicons name="business" size={18} color={theme.primary} />
            <AppText variant="heading">{g.apartment}</AppText>
          </View>
          {g.buildings.map((b) => (
            <View key={b.building} style={{ gap: Spacing.sm }}>
              <AppText variant="label">Building {b.building}</AppText>
              {b.items.map((item) => (
                <RouteItem key={item.subscriptionId} item={item} busy={busy === item.subscriptionId} onStatus={(s) => setStatus(item, s)} />
              ))}
            </View>
          ))}
        </View>
      ))}
      {items.length > 0 ? <Button title="Refresh" variant="ghost" icon="refresh" onPress={refresh} /> : null}
    </>
  );
}

function RouteItem({ item, busy, onStatus }: { item: DayPlanItem; busy: boolean; onStatus: (s: WashStatus) => void }) {
  const theme = useTheme();
  const tone = item.status === 'done' ? 'success' : item.status === 'skipped' ? 'neutral' : 'warning';
  return (
    <Card style={item.status !== 'planned' && { opacity: 0.75 }}>
      <View style={styles.itemHead}>
        <View style={[styles.floor, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="label" color={theme.primary}>
            {item.car.parkingFloor}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{item.car.plateNumber}</AppText>
          <AppText variant="caption">
            {item.car.color} {item.car.brand} {item.car.model}
          </AppText>
        </View>
        <Badge label={STATUS_LABEL[item.status]} tone={tone} />
      </View>
      <View style={styles.meta}>
        <CarMeta icon="time-outline" text={`Parked ${item.car.arrivesHomeAt} → ${item.car.leavesForWorkAt}`} />
        <Pressable onPress={() => Linking.openURL(`tel:${item.member.phone.replace(/[^\d+]/g, '')}`)}>
          <CarMeta icon="call-outline" text={`${item.member.name} · ${item.member.phone}`} />
        </Pressable>
      </View>
      <View style={styles.extras}>
        <Badge label={item.tariffName} tone="primary" />
        {item.extras.map((e) => (
          <Badge key={e} label={e} />
        ))}
      </View>
      <View style={styles.actions}>
        {item.status === 'planned' ? (
          <>
            <Button title="Washed" icon="checkmark" loading={busy} onPress={() => onStatus('done')} />
            <Button title="Skip" variant="secondary" disabled={busy} onPress={() => onStatus('skipped')} />
          </>
        ) : (
          <Button title="Undo" variant="ghost" icon="arrow-undo" loading={busy} onPress={() => onStatus('planned')} />
        )}
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flexGrow: 1, flexBasis: 140, gap: 2 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </Card>
  );
}

function Prices() {
  const load = useCallback(async () => {
    const [tariffs, extras] = await Promise.all([api.allTariffs(), api.allExtras()]);
    return { tariffs, extras };
  }, []);
  const { data, error, loading } = useApi(load);
  if (loading) return <Loading />;
  if (error) return <Banner message={error} />;
  return (
    <>
      <AppText variant="heading">Plans (per month)</AppText>
      {data?.tariffs.map((t) => (
        <PriceRow key={t.id} item={t} subtitle={`${t.washesPerMonth} washes per month`} save={(body) => api.updateTariff(t.id, body)} />
      ))}
      <AppText variant="heading">Extra services (per wash)</AppText>
      {data?.extras.map((e) => (
        <PriceRow key={e.id} item={e} subtitle={e.description} save={(body) => api.updateExtra(e.id, body)} />
      ))}
      <AppText variant="caption">Price changes apply to new plans. Existing plans keep the price they started with.</AppText>
    </>
  );
}

function PriceRow({
  item,
  subtitle,
  save,
}: {
  item: Tariff | Extra;
  subtitle: string;
  save: (body: { price?: number; active?: boolean }) => Promise<unknown>;
}) {
  const theme = useTheme();
  const [price, setPrice] = useState(String(item.price));
  const [savedPrice, setSavedPrice] = useState(item.price);
  const [active, setActive] = useState(item.active);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = Number(price.replace(/[^\d]/g, ''));
  const dirty = price.trim() !== '' && parsed !== savedPrice;

  const run = async (body: { price?: number; active?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      await save(body);
      if (body.price !== undefined) setSavedPrice(body.price);
      if (body.active !== undefined) setActive(body.active);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.itemHead}>
        <View style={{ flex: 1 }}>
          <AppText variant="label" color={active ? theme.text : theme.textSecondary}>
            {item.name}
          </AppText>
          <AppText variant="caption">
            {subtitle} · {active ? 'Offered' : 'Hidden'}
          </AppText>
        </View>
        <Switch value={active} disabled={busy} onValueChange={(v) => run({ active: v })} trackColor={{ true: theme.primary, false: theme.border }} />
      </View>
      <View style={styles.priceRow}>
        <AppText variant="label">₩</AppText>
        <TextInput
          value={price}
          onChangeText={setPrice}
          keyboardType="number-pad"
          style={[styles.priceInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background, fontFamily: Fonts.sans }]}
        />
        <Button title="Save" disabled={!dirty} loading={busy} onPress={() => run({ price: parsed })} />
        <AppText variant="caption">{formatKRW(savedPrice)} now</AppText>
      </View>
      {error ? <Banner message={error} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: Radius.md, alignSelf: 'flex-start' },
  segmentItem: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  aptHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  floor: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.xs },
  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  priceInput: { minHeight: 44, minWidth: 120, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, fontSize: 16 },
});
