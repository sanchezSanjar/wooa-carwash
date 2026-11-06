import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

/** 1–5 stars; pass onChange to make it an input. */
export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const theme = useTheme();
  const { t, fmt } = useI18n();
  const color = '#E8A317';
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityRole={onChange ? 'adjustable' : 'text'} accessibilityLabel={t('{n} of 5 stars', { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = (
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? color : theme.textSecondary} />
        );
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={fmt.count(n, '{n} star', '{n} stars')}>
            {icon}
          </Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}
