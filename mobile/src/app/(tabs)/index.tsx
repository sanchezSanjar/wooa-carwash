import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { ExtrasList, TariffCards } from '@/components/plans';
import { AppText, Banner, Button, Card, EmptyState, Loading, Screen, SectionTitle } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDay } from '@/lib/format';
import type { Car, Subscription } from '@/lib/types';

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const catalog = useApi(
    useCallback(async () => {
      const [tariffs, extras] = await Promise.all([api.tariffs(), api.extras()]);
      return { tariffs, extras };
    }, []),
  );

  return (
    <Screen refreshing={catalog.refreshing} onRefresh={catalog.refresh}>
      <View style={[styles.hero, { backgroundColor: theme.primary }]}>
        <View style={styles.heroBadge}>
          <Ionicons name="location" size={14} color="#fff" />
          <AppText variant="caption" color="#fff" style={{ fontWeight: '600' }}>
            {user ? user.apartmentName : 'We come to your apartment'}
          </AppText>
        </View>
        <AppText variant="title" color="#fff">
          {user ? `Hi ${user.name.split(' ')[0]}!` : 'Your car, washed in your own parking lot.'}
        </AppText>
        <AppText color="rgba(255,255,255,0.85)">
          Choose a monthly plan and your wash days. We wash while your car is parked at home.
        </AppText>
        {!user ? (
          <View style={styles.heroActions}>
            <Button title="Get started" variant="secondary" onPress={() => router.push('/register')} />
            <Button title="Log in" variant="ghost" onPress={() => router.push('/login')} style={{ borderColor: 'rgba(255,255,255,0.5)' }} />
          </View>
        ) : null}
      </View>

      {user ? <MyWashes key={user.id} /> : null}

      <SectionTitle hint="Prices are per car.">Monthly plans</SectionTitle>
      {catalog.error ? <Banner message={catalog.error} /> : null}
      {catalog.loading ? <Loading /> : null}
      {catalog.data ? <TariffCards tariffs={catalog.data.tariffs} /> : null}

      <SectionTitle hint="Added to every wash of the car you choose.">Extra services</SectionTitle>
      {catalog.data ? <ExtrasList extras={catalog.data.extras} /> : null}
    </Screen>
  );
}

function MyWashes() {
  const theme = useTheme();
  const { data, error, loading } = useApi(
    useCallback(async () => {
      const [cars, subs] = await Promise.all([api.myCars(), api.mySubscriptions()]);
      return { cars, subs };
    }, []),
  );

  if (loading) return <Loading />;
  if (error) return <Banner message={error} />;
  if (!data) return null;

  const active = data.subs.filter((s) => s.status === 'active');
  const next = active
    .flatMap((s) => s.upcoming.map((date) => ({ date, sub: s })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  if (data.cars.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="car-sport-outline"
          title="Add your first car"
          message="Tell us where it parks and when it's home, then pick a wash plan."
          action={<Button title="Add a car" icon="add" onPress={() => router.push('/car/new')} />}
        />
      </Card>
    );
  }

  const unplanned = data.cars.filter((c: Car) => !active.some((s: Subscription) => s.carId === c.id));

  return (
    <>
      <SectionTitle>Next washes</SectionTitle>
      {next.length === 0 ? (
        <AppText variant="caption">No washes scheduled yet.</AppText>
      ) : (
        <Card style={{ gap: Spacing.md }}>
          {next.map(({ date, sub }) => (
            <View key={`${sub.id}-${date}`} style={styles.washRow}>
              <View style={[styles.dateBox, { backgroundColor: theme.primarySoft }]}>
                <AppText variant="label" color={theme.primary}>
                  {formatDay(date)}
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="label">{sub.car?.plateNumber ?? 'Car'}</AppText>
                <AppText variant="caption">
                  {sub.tariffName}
                  {sub.extras.length ? ` + ${sub.extras.map((e) => e.name.toLowerCase()).join(', ')}` : ''}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      )}
      {unplanned.map((c) => (
        <Card key={c.id} style={styles.prompt}>
          <Ionicons name="calendar-outline" size={20} color={theme.primary} />
          <AppText style={{ flex: 1 }}>
            <AppText variant="label">{c.plateNumber}</AppText> has no wash plan yet.
          </AppText>
          <Button
            title="Choose plan"
            onPress={() => router.push({ pathname: '/plan/[carId]', params: { carId: c.id } })}
          />
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  washRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dateBox: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm, minWidth: 104 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
});
