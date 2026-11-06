import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { AppText, Banner, Button, Screen, TextField } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { finishAuth } from '@/lib/navigation';

export default function RegisterScreen() {
  const theme = useTheme();
  const { register } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (form.phone.trim() && !/^[0-9+\-\s]{7,20}$/.test(form.phone.trim())) e.phone = 'Enter a valid phone number';
    if (form.password.length < 8) e.password = 'Use at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    setError(null);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });
      finishAuth(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ maxWidth: 440 }}>
        <View style={{ gap: Spacing.xs }}>
          <AppText variant="title">Create account</AppText>
          <AppText variant="caption">It takes less than a minute.</AppText>
        </View>
        {error ? <Banner message={error} /> : null}
        <TextField label="Name" value={form.name} onChangeText={set('name')} autoComplete="name" error={errors.name} />
        <TextField
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          error={errors.email}
        />
        <TextField
          label="Phone (optional)"
          value={form.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="010-1234-5678"
          error={errors.phone}
        />
        <TextField
          label="Password"
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="At least 8 characters"
          error={errors.password}
          onSubmitEditing={submit}
        />
        <Button title="Create account" loading={busy} onPress={submit} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <AppText variant="caption">Already have an account?</AppText>
          <Link href={{ pathname: '/login', params: next ? { next } : {} }} replace>
            <AppText variant="caption" color={theme.primary} style={{ fontWeight: '600' }}>
              Log in
            </AppText>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
