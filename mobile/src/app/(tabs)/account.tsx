import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, Screen } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function AccountScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Screen>
        <AppText variant="title">Account</AppText>
        <EmptyState
          icon="person-circle-outline"
          title="Welcome to Wooa Carwash"
          message="Create an account to book washes and track them in one place."
          action={
            <View style={{ gap: Spacing.sm, width: '100%', maxWidth: 320 }}>
              <Button title="Log in" onPress={() => router.push('/login')} />
              <Button title="Create account" variant="secondary" onPress={() => router.push('/register')} />
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">Account</AppText>
      <Card>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
            <AppText variant="heading" color={theme.primary}>
              {user.name.charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="heading">{user.name}</AppText>
            <AppText variant="caption">{user.email}</AppText>
            {user.phone ? <AppText variant="caption">{user.phone}</AppText> : null}
          </View>
          {user.role === 'admin' ? (
            <View style={[styles.role, { backgroundColor: theme.primarySoft }]}>
              <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
              <AppText variant="caption" color={theme.primary} style={{ fontWeight: '600' }}>
                Admin
              </AppText>
            </View>
          ) : null}
        </View>
      </Card>
      <Button title="Log out" variant="secondary" icon="log-out-outline" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
});
