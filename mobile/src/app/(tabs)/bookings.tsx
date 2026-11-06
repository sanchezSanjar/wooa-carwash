import { router } from 'expo-router';
import { useState } from 'react';

import { BookingCard } from '@/components/booking-card';
import { AppText, Banner, Button, EmptyState, Loading, Screen } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import type { Booking } from '@/lib/types';

export default function BookingsScreen() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Screen>
        <AppText variant="title">My bookings</AppText>
        <EmptyState
          icon="calendar-outline"
          title="Log in to see your bookings"
          message="Your upcoming and past washes will show up here."
          action={
            <Button
              title="Log in"
              onPress={() => router.push({ pathname: '/login', params: { next: '/bookings' } })}
            />
          }
        />
      </Screen>
    );
  }

  return <MyBookings key={user.id} />;
}

function MyBookings() {
  const { data, setData, error, loading, refreshing, refresh } = useApi(api.myBookings);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const upcoming = (data ?? [])
    .filter((b) => b.status !== 'cancelled' && b.status !== 'completed' && Date.parse(b.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = (data ?? []).filter((b) => !upcoming.includes(b));

  const cancel = async (b: Booking) => {
    const ok = await confirm('Cancel booking?', `${b.serviceName} will be cancelled.`, 'Cancel booking');
    if (!ok) return;
    setBusyId(b.id);
    setActionError(null);
    try {
      const updated = await api.cancelBooking(b.id);
      setData((list) => list?.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not cancel');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <AppText variant="title">My bookings</AppText>
      {error ? <Banner message={error} /> : null}
      {actionError ? <Banner message={actionError} /> : null}
      {loading ? <Loading /> : null}

      {!loading && data?.length === 0 ? (
        <EmptyState
          icon="water-outline"
          title="No bookings yet"
          message="Choose a wash package to book your first slot."
          action={<Button title="Browse packages" onPress={() => router.navigate('/')} />}
        />
      ) : null}

      {upcoming.length > 0 ? <AppText variant="heading">Upcoming</AppText> : null}
      {upcoming.map((b) => (
        <BookingCard key={b.id} booking={b}>
          {(b.status === 'pending' || b.status === 'confirmed') && Date.parse(b.startsAt) > now ? (
            <Button
              title="Cancel"
              variant="danger"
              icon="close-circle-outline"
              loading={busyId === b.id}
              onPress={() => cancel(b)}
            />
          ) : null}
        </BookingCard>
      ))}

      {past.length > 0 ? <AppText variant="heading">History</AppText> : null}
      {past.map((b) => (
        <BookingCard key={b.id} booking={b} />
      ))}
    </Screen>
  );
}
