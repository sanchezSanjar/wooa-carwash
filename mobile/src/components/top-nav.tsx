import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

import { LanguageSwitch } from './language-switch';
import { AppText, Button } from './ui';

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<
    string,
    { options: { title?: string; href?: unknown; tabBarItemStyle?: unknown; tabBarButton?: unknown } }
  >;
  navigation: { navigate: (name: string) => void };
}

/** Website-style header used instead of bottom tabs on wide screens. */
export function TopNav({ state, descriptors, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <View style={styles.inner}>
        <Pressable onPress={() => navigation.navigate('index')} accessibilityRole="link">
          <AppText variant="title" style={{ fontSize: 22, lineHeight: 28 }}>
            Wooa Carwash
          </AppText>
        </Pressable>
        <View style={styles.links}>
          {state.routes.map((route, i) => {
            const { options } = descriptors[route.key];
            // Tabs hidden with href: null (e.g. Manage for non-admins)
            const itemStyle = options.tabBarItemStyle as { display?: string } | undefined;
            if (options.href === null || itemStyle?.display === 'none') return null;
            const focused = state.index === i;
            return (
              <Pressable
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                accessibilityRole="link"
                accessibilityState={{ selected: focused }}
                style={styles.link}>
                <AppText variant="label" color={focused ? theme.text : theme.textSecondary}>
                  {options.title ?? route.name}
                </AppText>
                <View style={[styles.underline, { backgroundColor: focused ? theme.text : 'transparent' }]} />
              </Pressable>
            );
          })}
          <LanguageSwitch compact />
          {!user ? <Button title={t('Get started')} onPress={() => router.push('/register')} style={styles.cta} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.lg,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  links: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl },
  link: { paddingVertical: Spacing.sm, alignItems: 'center' },
  underline: { height: 2, width: '100%', marginTop: 4, borderRadius: 1 },
  cta: { minHeight: 40 },
});
