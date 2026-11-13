import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import type { Car } from '@/lib/types';

import { AppText, Card } from './ui';
import { useI18n } from '@/lib/i18n';

/** Plate, model and where/when the car is parked. */
export function CarCard({ car, children, footer }: { car: Car; children?: React.ReactNode; footer?: React.ReactNode }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
          <Ionicons name="car-sport" size={22} color={theme.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{car.plateNumber}</AppText>
          <AppText variant="caption">
            {t(car.color)} {car.brand} {car.model}
          </AppText>
        </View>
        {children}
      </View>
      <View style={styles.meta}>
        <CarMeta icon="business-outline" text={t('Bldg {building} · Floor {floor}', { building: car.buildingNumber, floor: car.parkingFloor })} />
        <CarMeta icon="home-outline" text={t('Home from {time}', { time: car.arrivesHomeAt })} />
        <CarMeta icon="briefcase-outline" text={t('Leaves {time}', { time: car.leavesForWorkAt })} />
      </View>
      {footer}
    </Card>
  );
}

export function CarMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={15} color={theme.textSecondary} />
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
