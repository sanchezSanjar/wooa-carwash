import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import type { Extra, Tariff } from '@/lib/types';

import { ExtrasList, TariffCards } from './plans';
import { AppText, Button, Card } from './ui';
import { useI18n } from '@/lib/i18n';

const STEPS = [
  {
    title: 'Add your car',
    text: 'Plate, model and color, the building and parking floor it lives on, and roughly when it gets home and leaves in the morning.',
  },
  {
    title: 'Pick a plan and your days',
    text: 'Two, four or six washes a month on the weekdays that suit you. You see every upcoming wash date before you confirm.',
  },
  {
    title: 'We wash it where it is parked',
    text: 'Our washer comes to your apartment parking on your days and cleans the car while it is at home. You do not need to be there.',
  },
];

const FAQ = [
  {
    q: 'Do I need to be home?',
    a: 'No. We wash the car in your apartment parking while it is parked, using the hours you gave us for when it is home.',
  },
  {
    q: 'What do "weeks 1 & 3" mean?',
    a: 'The first and third time that weekday comes up in the month, for example the 1st and 3rd Monday. If a month has a 5th Monday, it is skipped, so every month has the same number of washes.',
  },
  {
    q: 'Can I change my wash days or extras?',
    a: 'Yes. Open the car in My cars and choose Manage plan. Changes apply to the next washes.',
  },
  {
    q: 'I have more than one car.',
    a: 'Add each car to your account. Every car gets its own plan, days and extras.',
  },
  {
    q: 'How do I cancel?',
    a: 'Choose Manage plan on the car and cancel. There is no contract.',
  },
];

export function Landing({ tariffs, extras }: { tariffs: Tariff[]; extras: Extra[] }) {
  const theme = useTheme();
  const { t, fmt } = useI18n();
  const from = tariffs.length ? Math.min(...tariffs.map((x) => x.price)) : null;

  return (
    <View style={{ gap: Spacing.xxl * 1.5 }}>
      {/* Hero */}
      <View style={{ gap: Spacing.lg, paddingTop: Spacing.lg }}>
        <AppText variant="display" style={styles.headline}>
          {t('Your car washed in your own apartment parking.')}
        </AppText>
        <AppText style={styles.lead} color={theme.textSecondary}>
          {from !== null
            ? t('A monthly plan on the days you choose. We clean the car while it is parked at home, from {price} a month.', { price: fmt.krw(from) })
            : t('A monthly plan on the days you choose. We clean the car while it is parked at home.')}
        </AppText>
        <View style={styles.row}>
          <Button title={t('Get started')} onPress={() => router.push('/register')} />
          <Button title={t('Log in')} variant="secondary" onPress={() => router.push('/login')} />
        </View>
      </View>

      {/* Plans */}
      <View style={{ gap: Spacing.lg }}>
        <TariffCards tariffs={tariffs} onChoose={() => router.push('/register')} />
        <AppText variant="caption">{t('Prices are per car. Extras are added to every wash of the car you choose.')}</AppText>
      </View>

      {/* Promise strip */}
      <View style={[styles.strip, { borderColor: theme.border }]}>
        {[
          ['home-outline', 'No need to be home'],
          ['calendar-outline', 'Same days every month'],
          ['car-sport-outline', 'One plan per car'],
          ['close-circle-outline', 'Cancel any time'],
        ].map(([icon, label]) => (
          <View key={label} style={styles.promise}>
            <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={theme.text} />
            <AppText variant="label">{t(label)}</AppText>
          </View>
        ))}
      </View>

      {/* How it works */}
      <View style={{ gap: Spacing.xl }}>
        <View style={{ gap: Spacing.xs }}>
          <AppText variant="caption">{t('How it works')}</AppText>
          <AppText variant="title">{t('Set it up once. Clean car every week.')}</AppText>
        </View>
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <View style={[styles.stepNum, { borderColor: theme.text }]}>
                <AppText variant="label">{i + 1}</AppText>
              </View>
              <AppText variant="heading">{t(s.title)}</AppText>
              <AppText color={theme.textSecondary}>{t(s.text)}</AppText>
            </View>
          ))}
        </View>
      </View>

      {/* Extras */}
      <View style={{ gap: Spacing.lg }}>
        <View style={{ gap: Spacing.xs }}>
          <AppText variant="caption">{t('Extras')}</AppText>
          <AppText variant="title">{t('Add more to every wash.')}</AppText>
        </View>
        <ExtrasList extras={extras} />
      </View>

      {/* FAQ */}
      <View style={{ gap: Spacing.lg }}>
        <AppText variant="title">{t('Quick answers')}</AppText>
        <View style={[styles.faq, { borderTopColor: theme.border }]}>
          {FAQ.map((f) => (
            <FaqItem key={f.q} q={t(f.q)} a={t(f.a)} />
          ))}
        </View>
      </View>

      {/* Closing CTA */}
      <Card style={[styles.cta, { backgroundColor: theme.surface, borderColor: theme.surface }]}>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {from !== null ? t('Start your plan, from {price} a month', { price: fmt.krw(from) }) : t('Start your plan')}
        </AppText>
        <AppText variant="caption" style={{ textAlign: 'center' }}>
          {t('Add your car and choose your days in a couple of minutes.')}
        </AppText>
        <Button title={t('Get started')} onPress={() => router.push('/register')} style={{ alignSelf: 'center', minWidth: 200 }} />
      </Card>
    </View>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.faqItem, { borderBottomColor: theme.border }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.faqHead}>
        <AppText variant="heading" style={{ flex: 1, fontWeight: '600' }}>
          {q}
        </AppText>
        <Ionicons name={open ? 'remove' : 'add'} size={22} color={theme.text} />
      </Pressable>
      {open ? <AppText color={theme.textSecondary}>{a}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headline: { maxWidth: 720 },
  lead: { fontSize: 18, lineHeight: 28, maxWidth: 600 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.xl,
    rowGap: Spacing.lg,
  },
  promise: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexBasis: 220, flexGrow: 1 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xl },
  step: { flexBasis: 260, flexGrow: 1, gap: Spacing.sm },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  faq: { borderTopWidth: StyleSheet.hairlineWidth },
  faqItem: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.lg, gap: Spacing.sm },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cta: { alignItems: 'stretch', gap: Spacing.md, padding: Spacing.xxl, borderRadius: Radius.lg },
});
