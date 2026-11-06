import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { formatDate, formatKRW, formatTime } from '@/lib/format';
import type { Booking } from '@/lib/types';

import { AppText, Card, StatusBadge } from './ui';

export function BookingCard({
  booking,
  showCustomer,
  children,
}: {
  booking: Booking;
  showCustomer?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{booking.serviceName}</AppText>
          <AppText variant="caption">
            {formatDate(booking.startsAt)} · {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
          </AppText>
        </View>
        <StatusBadge status={booking.status} />
      </View>

      <View style={styles.meta}>
        <Meta icon="car-outline" text={[booking.vehicle.plate, booking.vehicle.model].filter(Boolean).join(' · ')} />
        <Meta icon="pricetag-outline" text={formatKRW(booking.price)} />
        {showCustomer && booking.customer ? (
          <Meta
            icon="person-outline"
            text={[booking.customer.name, booking.customer.phone ?? booking.customer.email].join(' · ')}
          />
        ) : null}
      </View>

      {booking.notes ? (
        <AppText variant="caption" style={{ fontStyle: 'italic' }} color={theme.textSecondary}>
          “{booking.notes}”
        </AppText>
      ) : null}

      {children ? <View style={styles.actions}>{children}</View> : null}
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={15} color={theme.textSecondary} />
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
});
