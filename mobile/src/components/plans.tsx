import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import type { Extra, Tariff } from '@/lib/types';

import { AppText, Badge, Button, Card } from './ui';
import { useI18n } from '@/lib/i18n';

/** The plan most customers pick gets a tag. */
const POPULAR_WASHES = 4;

export function TariffCards({
  tariffs,
  actionLabel,
  onChoose,
}: {
  tariffs: Tariff[];
  actionLabel?: string;
  onChoose?: (t: Tariff) => void;
}) {
  const theme = useTheme();
  const { t: tr, fmt } = useI18n();
  return (
    <View style={styles.grid}>
      {tariffs.map((t) => (
        <Card key={t.id} style={styles.card}>
          <View style={styles.head}>
            <View style={{ flex: 1, gap: Spacing.xs }}>
              <AppText variant="heading">{fmt.name(t.name)}</AppText>
              {t.washesPerMonth === POPULAR_WASHES ? <Badge label={tr('Most popular')} tone="success" /> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="heading" style={{ fontSize: 22, lineHeight: 28 }}>
                {fmt.krw(t.price)}
              </AppText>
              <AppText variant="caption">{tr('per month')}</AppText>
            </View>
          </View>
          <View style={styles.line}>
            <Ionicons name="water-outline" size={15} color={theme.textSecondary} />
            <AppText variant="label">{tr('{n} washes a month', { n: t.washesPerMonth })}</AppText>
          </View>
          <AppText variant="caption" style={{ flex: 1 }}>
            {tr(t.description)}
          </AppText>
          {onChoose ? <Button title={actionLabel ?? tr('Choose this plan')} onPress={() => onChoose(t)} style={{ marginTop: Spacing.sm }} /> : null}
        </Card>
      ))}
    </View>
  );
}

export function ExtrasList({ extras }: { extras: Extra[] }) {
  const theme = useTheme();
  const { t, fmt } = useI18n();
  return (
    <Card style={{ gap: 0, paddingVertical: Spacing.sm }}>
      {extras.map((e, i) => (
        <View
          key={e.id}
          style={[
            styles.extra,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
          ]}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">{fmt.name(e.name)}</AppText>
            {e.description ? <AppText variant="caption">{t(e.description)}</AppText> : null}
          </View>
          <AppText variant="label">+{fmt.krw(e.price)}</AppText>
          <AppText variant="caption">{t('/ wash')}</AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  card: { flexGrow: 1, flexBasis: 260, gap: Spacing.sm, padding: Spacing.xl },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  extra: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
});
