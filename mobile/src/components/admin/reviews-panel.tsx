import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Stars } from '@/components/stars';
import { AppText, Banner, Card, EmptyState, Loading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/** Newest member ratings and comments. */
export function ReviewsPanel() {
  const { data, error, loading } = useApi(api.reviews);
  const { t, fmt } = useI18n();
  if (loading) return <Loading />;
  if (error) return <Banner message={error} />;
  if (!data?.length) return <EmptyState icon="star-outline" title={t('No ratings yet')} message={t('Members can rate each finished wash.')} />;

  const rated = data.filter((r) => r.review);
  const average = rated.reduce((s, r) => s + (r.review?.rating ?? 0), 0) / (rated.length || 1);

  return (
    <>
      <Card style={styles.summary}>
        <AppText variant="title">{average.toFixed(1)}</AppText>
        <View style={{ gap: 2 }}>
          <Stars value={Math.round(average)} />
          <AppText variant="caption">{t('Average of the latest {n} ratings', { n: rated.length })}</AppText>
        </View>
      </Card>
      {data.map((r) => (
        <Pressable
          key={`${r.subscriptionId}-${r.date}`}
          onPress={() => router.push({ pathname: '/wash/[subscriptionId]/[date]', params: { subscriptionId: r.subscriptionId, date: r.date } })}>
          <Card style={{ gap: Spacing.xs }}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <AppText variant="label">
                  {r.plateNumber} · {r.memberName}
                </AppText>
                <AppText variant="caption">
                  {t('{apartment} · wash of {date}', { apartment: r.apartmentName, date: fmt.day(r.date) })}
                </AppText>
              </View>
              {r.review ? <Stars value={r.review.rating} size={16} /> : null}
            </View>
            {r.review?.comment ? <AppText>“{r.review.comment}”</AppText> : null}
          </Card>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
