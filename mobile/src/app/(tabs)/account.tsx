import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, EmptyState, Screen, SectionTitle, TextField } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';

export default function AccountScreen() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Screen>
        <AppText variant="title">Account</AppText>
        <EmptyState
          icon="person-circle-outline"
          title="Welcome to Wooa Carwash"
          message="Create an account to add your cars and choose a wash plan."
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
  return <Profile key={user.id} user={user} />;
}

function Profile({ user }: { user: User }) {
  const theme = useTheme();
  const { updateProfile, logout } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone, apartmentName: user.apartmentName });
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty =
    form.name.trim() !== user.name || form.phone.trim() !== user.phone || form.apartmentName.trim() !== user.apartmentName;

  const set = (key: keyof typeof form) => (value: string) => {
    setMessage(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.apartmentName.trim() || !/^[0-9+\-\s]{7,20}$/.test(form.phone.trim())) {
      setMessage({ text: 'Enter your name, a valid phone number and your apartment', tone: 'danger' });
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ name: form.name.trim(), phone: form.phone.trim(), apartmentName: form.apartmentName.trim() });
      setMessage({ text: 'Profile saved', tone: 'success' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not save', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={{ maxWidth: 640 }}>
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

      <SectionTitle>Profile</SectionTitle>
      <TextField label="Name" value={form.name} onChangeText={set('name')} autoComplete="name" />
      <TextField label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
      <TextField label="Apartment name" value={form.apartmentName} onChangeText={set('apartmentName')} />
      {message ? <Banner message={message.text} tone={message.tone} /> : null}
      <Button title="Save profile" disabled={!dirty} loading={busy} onPress={save} />
      <Button title="Log out" variant="secondary" icon="log-out-outline" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  role: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 999 },
});
