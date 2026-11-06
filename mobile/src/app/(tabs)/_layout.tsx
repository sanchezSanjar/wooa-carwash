import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, useWindowDimensions, type ColorValue } from 'react-native';

import { TopNav } from '@/components/top-nav';
import { useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  const theme = useTheme();
  const { user } = useAuth();
  const { t } = useI18n();
  const isStaff = user?.role === 'admin' || user?.role === 'washer';
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 768;

  return (
    <Tabs
      tabBar={wide ? (props) => <TopNav {...(props as unknown as Parameters<typeof TopNav>[0])} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'top' : 'bottom',
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      }}>
      <Tabs.Screen name="index" options={{ title: t('Home'), tabBarIcon: icon('water') }} />
      <Tabs.Screen name="cars" options={{ title: t('My cars'), tabBarIcon: icon('car') }} />
      <Tabs.Screen
        name="admin"
        options={{ title: t('Manage'), tabBarIcon: icon('briefcase'), href: isStaff ? undefined : null }}
      />
      <Tabs.Screen name="account" options={{ title: t('Account'), tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
