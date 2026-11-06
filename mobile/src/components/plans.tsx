import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { formatKRW } from '@/lib/format';
import type { Extra, Tariff } from '@/lib/types';

import { AppText, Card } from './ui';

export function TariffCards({ tariffs }: { tariffs: Tariff[] }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {tariffs.map((t) => (
        <Card key={t.id} style={styles.card}>
          <AppText variant="heading">{t.name}</AppText>
          <AppText variant="title" color={theme.primary} style={{ fontSize: 24, lineHeight: 30 }}>
            {formatKRW(t.price)}
            <AppText variant="caption"> / month</AppText>
          </AppText>
          <View style={styles.line}>
            <Ionicons name="water-outline" size={15} color={theme.textSecondary} />
            <AppText variant="label">{t.washesPerMonth} washes per month</AppText>
          </View>
          <AppText variant="caption">{t.description}</AppText>
        </Card>
      ))}
    </View>
  );
}

export function ExtrasList({ extras }: { extras: Extra[] }) {
  return (
    <Card style={{ gap: Spacing.md }}>
      {extras.map((e) => (
        <View key={e.id} style={styles.extra}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">{e.name}</AppText>
            {e.description ? <AppText variant="caption">{e.description}</AppText> : null}
          </View>
          <AppText variant="label">+{formatKRW(e.price)} / wash</AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  card: { flexGrow: 1, flexBasis: 240 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  extra: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
