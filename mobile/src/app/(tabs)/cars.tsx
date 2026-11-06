import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { CarCard } from '@/components/car-card';
import { AppText, Badge, Banner, Button, EmptyState, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDay, formatKRW, scheduleSummary } from '@/lib/format';

export default function CarsScreen() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Screen>
        <AppText variant="title">My cars</AppText>
        <EmptyState
          icon="car-sport-outline"
          title="Log in to manage your cars"
          action={
            <Button title="Log in" onPress={() => router.push({ pathname: '/login', params: { next: '/cars' } })} />
          }
        />
      </Screen>
    );
  }
  return <MyCars key={user.id} />;
}

function MyCars() {
  const { data, error, loading, refreshing, refresh } = useApi(
    useCallback(async () => {
      const [cars, subs] = await Promise.all([api.myCars(), api.mySubscriptions()]);
      return { cars, subs };
    }, []),
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">My cars</AppText>
        <Button title="Add car" icon="add" onPress={() => router.push('/car/new')} />
      </View>
      {error ? <Banner message={error} /> : null}
      {loading ? <Loading /> : null}
      {data && data.cars.length === 0 ? (
        <EmptyState
          icon="car-sport-outline"
          title="No cars yet"
          message="Add a car with its parking spot to choose a wash plan."
        />
      ) : null}

      {data?.cars.map((car) => {
        const sub = data.subs.find((s) => s.carId === car.id && s.status === 'active');
        return (
          <CarCard
            key={car.id}
            car={car}
            footer={
              <View style={{ gap: Spacing.sm, marginTop: Spacing.xs }}>
                {sub ? (
                  <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                      <Badge label={`${sub.tariffName} · ${sub.washesPerMonth}×/month`} tone="success" />
                      <AppText variant="label">{formatKRW(sub.monthlyPrice)} / month</AppText>
                    </View>
                    <AppText variant="caption">{scheduleSummary(sub.schedule)}</AppText>
                    {sub.extras.length ? (
                      <AppText variant="caption">Extras: {sub.extras.map((e) => e.name).join(', ')}</AppText>
                    ) : null}
                    {sub.upcoming[0] ? <AppText variant="caption">Next wash: {formatDay(sub.upcoming[0])}</AppText> : null}
                  </View>
                ) : (
                  <Badge label="No wash plan" tone="warning" />
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
                  <Button
                    title={sub ? 'Manage plan' : 'Choose plan'}
                    icon="calendar-outline"
                    onPress={() => router.push({ pathname: '/plan/[carId]', params: { carId: car.id } })}
                  />
                  <Button
                    title="Edit car"
                    variant="secondary"
                    icon="create-outline"
                    onPress={() => router.push({ pathname: '/car/[id]', params: { id: car.id } })}
                  />
                </View>
              </View>
            }
          />
        );
      })}
    </Screen>
  );
}
