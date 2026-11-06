import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, Loading, Screen } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDuration, formatKRW } from '@/lib/format';

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { data: services, error, loading, refreshing, refresh } = useApi(api.services);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={[styles.hero, { backgroundColor: theme.primary }]}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <AppText variant="caption" color="#fff" style={{ fontWeight: '600' }}>
            Open daily 09:00 – 19:00
          </AppText>
        </View>
        <AppText variant="title" color="#fff">
          {user ? `Hi ${user.name.split(' ')[0]}, ready for a shine?` : 'A spotless car, on your schedule.'}
        </AppText>
        <AppText color="rgba(255,255,255,0.85)">
          Pick a package, choose a time slot, and drive in. No waiting in line.
        </AppText>
      </View>

      <AppText variant="heading">Wash packages</AppText>

      {error ? <Banner message={error} /> : null}
      {loading ? <Loading /> : null}

      <View style={styles.grid}>
        {services?.map((s) => (
          <Card key={s.id} style={styles.serviceCard}>
            <View style={{ gap: Spacing.xs, flex: 1 }}>
              <AppText variant="heading">{s.name}</AppText>
              <AppText variant="caption">{s.description}</AppText>
            </View>
            <View style={styles.serviceFooter}>
              <View>
                <AppText variant="heading" color={theme.primary}>
                  {formatKRW(s.price)}
                </AppText>
                <View style={styles.duration}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <AppText variant="caption">{formatDuration(s.durationMinutes)}</AppText>
                </View>
              </View>
              <Button
                title="Book"
                icon="calendar-outline"
                onPress={() => router.push({ pathname: '/book/[serviceId]', params: { serviceId: s.id } })}
              />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  serviceCard: { flexGrow: 1, flexBasis: 260, gap: Spacing.lg },
  serviceFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
