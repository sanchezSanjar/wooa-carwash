import { Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { DaySheetPanel } from '@/components/admin/day-sheet';
import { MembersPanel } from '@/components/admin/members-panel';
import { ReviewsPanel } from '@/components/admin/reviews-panel';
import { AppText, Banner, Button, Card, Loading, Screen } from '@/components/ui';
import { Fonts, Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatKRW } from '@/lib/format';
import type { Extra, Tariff } from '@/lib/types';

type Tab = 'route' | 'members' | 'reviews' | 'prices';
const TAB_LABEL: Record<Tab, string> = {
  route: 'Day sheet',
  members: 'Members',
  reviews: 'Reviews',
  prices: 'Plans & prices',
};

export default function AdminScreen() {
  const { user } = useAuth();
  if (user?.role !== 'admin' && user?.role !== 'washer') return <Redirect href="/" />;
  return <Dashboard isAdmin={user.role === 'admin'} />;
}

function Dashboard({ isAdmin }: { isAdmin: boolean }) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('route');
  // washers only see the route; admins see everything
  const tabs: Tab[] = isAdmin ? ['route', 'members', 'reviews', 'prices'] : ['route'];
  return (
    <Screen>
      <AppText variant="title">Manage</AppText>
      {tabs.length > 1 ? (
        <View style={[styles.segment, { backgroundColor: theme.muted }]}>
          {tabs.map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segmentItem, tab === t && { backgroundColor: theme.card }]}>
              <AppText variant="label" color={tab === t ? theme.text : theme.textSecondary}>
                {TAB_LABEL[t]}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {tab === 'route' ? <DaySheetPanel isAdmin={isAdmin} /> : tab === 'members' ? <MembersPanel /> : tab === 'reviews' ? <ReviewsPanel /> : <Prices />}
    </Screen>
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
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  priceInput: { minHeight: 44, minWidth: 120, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, fontSize: 16 },
});
