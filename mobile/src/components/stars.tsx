import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/constants/theme';

/** 1–5 stars; pass onChange to make it an input. */
export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const theme = useTheme();
  const color = '#E8A317';
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityRole={onChange ? 'adjustable' : 'text'} accessibilityLabel={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = (
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? color : theme.textSecondary} />
        );
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
            {icon}
          </Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
    </View>
  );
}
