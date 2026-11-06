import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  const theme = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('water') }} />
      <Tabs.Screen name="cars" options={{ title: 'My cars', tabBarIcon: icon('car') }} />
      <Tabs.Screen
        name="admin"
        options={{ title: 'Manage', tabBarIcon: icon('briefcase'), href: isAdmin ? undefined : null }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
