import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { LANG_NAMES, LANGS } from '@/lib/lang';

import { AppText } from './ui';

/** 한국어 / English switch. Compact shows KO / EN for headers. */
export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const theme = useTheme();
  const { lang, setLang, t } = useI18n();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('Language')}
      style={[styles.group, { borderColor: theme.border, backgroundColor: theme.card }]}>
      {LANGS.map((l) => {
        const active = l === lang;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={LANG_NAMES[l]}
            onPress={() => setLang(l)}
            style={[compact ? styles.compact : styles.option, active && { backgroundColor: theme.primary }]}>
            <AppText variant="label" color={active ? theme.primaryText : theme.text}>
              {compact ? l.toUpperCase() : LANG_NAMES[l]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.md, padding: 3, gap: 3, alignSelf: 'flex-start' },
  option: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.sm },
  compact: { paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
});
