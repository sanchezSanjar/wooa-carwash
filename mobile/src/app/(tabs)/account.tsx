import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MyBills } from '@/components/bills';
import { AppText, Banner, Button, Card, EmptyState, Screen, SectionTitle, TextField } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
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
  const [form, setForm] = useState({ name: user.name, apartmentName: user.apartmentName, email: user.email ?? '' });
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty =
    form.name.trim() !== user.name ||
    form.apartmentName.trim() !== user.apartmentName ||
    form.email.trim() !== (user.email ?? '');

  const set = (key: keyof typeof form) => (value: string) => {
    setMessage(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.apartmentName.trim()) {
      setMessage({ text: 'Enter your name and your apartment', tone: 'danger' });
      return;
    }
    if (form.email.trim() && !/^S+@S+.S+$/.test(form.email.trim())) {
      setMessage({ text: 'Enter a valid email or leave it empty', tone: 'danger' });
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ name: form.name.trim(), apartmentName: form.apartmentName.trim(), email: form.email.trim() });
      setMessage({ text: 'Profile saved', tone: 'success' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not save', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'washer' ? 'Washer' : null;

  return (
    <Screen contentStyle={{ maxWidth: 640 }}>
      <AppText variant="title">Account</AppText>
      <Card>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
            <AppText variant="heading">{user.name.charAt(0).toUpperCase()}</AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="heading">{user.name}</AppText>
            <AppText variant="caption">{formatPhone(user.phone)}</AppText>
          </View>
          {roleLabel ? (
            <View style={[styles.role, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="shield-checkmark" size={14} color={theme.accent} />
              <AppText variant="caption" color={theme.accent} style={{ fontWeight: '600' }}>
                {roleLabel}
              </AppText>
            </View>
          ) : null}
        </View>
      </Card>

      <MyBills />

      <SectionTitle hint="Your mobile number is your login. Ask us to change it.">Profile</SectionTitle>
      <TextField label="Name" value={form.name} onChangeText={set('name')} autoComplete="name" />
      <TextField label="Apartment name" value={form.apartmentName} onChangeText={set('apartmentName')} />
      <TextField
        label="Email (optional)"
        value={form.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      {message ? <Banner message={message.text} tone={message.tone} /> : null}
      <Button title="Save profile" disabled={!dirty} loading={busy} onPress={save} />

      <ChangePassword />
      <Button title="Log out" variant="secondary" icon="log-out-outline" onPress={logout} />
    </Screen>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (next.length < 8) return setMessage({ text: 'Use at least 8 characters', tone: 'danger' });
    setBusy(true);
    setMessage(null);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setMessage({ text: 'Password changed. Other devices are logged out.', tone: 'success' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not change the password', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Password</SectionTitle>
      <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
      <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" />
      {message ? <Banner message={message.text} tone={message.tone} /> : null}
      <Button title="Change password" variant="secondary" disabled={!current || !next} loading={busy} onPress={save} />
    </>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  role: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 999 },
});
