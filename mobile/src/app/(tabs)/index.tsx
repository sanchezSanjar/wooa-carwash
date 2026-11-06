import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { Landing } from '@/components/landing';
import { TariffCards } from '@/components/plans';
import { AppText, Banner, Button, Card, EmptyState, Loading, Screen, SectionTitle } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDay } from '@/lib/format';
import type { User } from '@/lib/types';

export default function HomeScreen() {
  const { user } = useAuth();
  const catalog = useApi(
    useCallback(async () => {
      const [tariffs, extras] = await Promise.all([api.tariffs(), api.extras()]);
      return { tariffs, extras };
    }, []),
  );

  return (
    <Screen refreshing={catalog.refreshing} onRefresh={catalog.refresh}>
      {catalog.error ? <Banner message={catalog.error} /> : null}
      {catalog.loading ? <Loading /> : null}
      {user ? (
        <MemberHome key={user.id} user={user} tariffs={catalog.data?.tariffs ?? []} />
      ) : catalog.data ? (
        <Landing tariffs={catalog.data.tariffs} extras={catalog.data.extras} />
      ) : null}
    </Screen>
  );
}

function MemberHome({ user, tariffs }: { user: User; tariffs: Parameters<typeof TariffCards>[0]['tariffs'] }) {
  const theme = useTheme();
  const { data, error, loading } = useApi(
    useCallback(async () => {
      const [cars, subs] = await Promise.all([api.myCars(), api.mySubscriptions()]);
      return { cars, subs };
    }, []),
  );

  const active = data?.subs.filter((s) => s.status === 'active') ?? [];
  const next = active
    .flatMap((s) => s.upcoming.map((date) => ({ date, sub: s })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const unplanned = data?.cars.filter((c) => !active.some((s) => s.carId === c.id)) ?? [];

  return (
    <View style={{ gap: Spacing.xl }}>
      <View style={{ gap: Spacing.xs }}>
        <View style={styles.place}>
          <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
          <AppText variant="caption">{user.apartmentName}</AppText>
        </View>
        <AppText variant="display" style={{ fontSize: 36, lineHeight: 42 }}>
          Hello, {user.name.split(' ')[0]}.
        </AppText>
      </View>

      {error ? <Banner message={error} /> : null}
      {loading ? <Loading /> : null}

      {data && data.cars.length === 0 ? (
        <Card>
          <EmptyState
            icon="car-sport-outline"
            title="Add your first car"
            message="Tell us where it parks and when it is home, then pick a plan."
            action={<Button title="Add a car" icon="add" onPress={() => router.push('/car/new')} />}
          />
        </Card>
      ) : null}

      {next.length > 0 ? (
        <View style={{ gap: Spacing.md }}>
          <SectionTitle>Next washes</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
            {next.map(({ date, sub }, i) => (
              <View
                key={`${sub.id}-${date}`}
                style={[styles.washRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <View style={[styles.dateBox, { backgroundColor: theme.surface }]}>
                  <AppText variant="label">{formatDay(date)}</AppText>
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
        </View>
      ) : null}

      {unplanned.map((c) => (
        <Card key={c.id} style={styles.prompt}>
          <Ionicons name="calendar-outline" size={20} color={theme.text} />
          <AppText style={{ flex: 1 }}>
            <AppText variant="label">{c.plateNumber}</AppText> has no wash plan yet.
          </AppText>
          <Button title="Choose plan" onPress={() => router.push({ pathname: '/plan/[carId]', params: { carId: c.id } })} />
        </Card>
      ))}

      {data && data.cars.length > 0 && active.length === 0 ? (
        <View style={{ gap: Spacing.md }}>
          <SectionTitle hint="Prices are per car.">Plans</SectionTitle>
          <TariffCards tariffs={tariffs} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  place: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  washRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  dateBox: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.sm, minWidth: 112 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
});
