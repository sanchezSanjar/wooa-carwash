import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { PhoneVerify } from '@/components/phone-verify';
import { AppText, Banner, Button, Screen, TextField } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
import { finishAuth } from '@/lib/navigation';

export default function RegisterScreen() {
  const theme = useTheme();
  const { register } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [phone, setPhone] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', apartmentName: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Enter your name';
    if (!form.apartmentName.trim()) e.apartmentName = 'Enter your apartment name';
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email or leave it empty';
    if (form.password.length < 8) e.password = 'Use at least 8 characters';
    setErrors(e);
    if (Object.keys(e).length || !phone) return;
    setBusy(true);
    setError(null);
    try {
      await register({
        name: form.name.trim(),
        phone,
        apartmentName: form.apartmentName.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
      });
      finishAuth(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ maxWidth: 440 }}>
        <View style={{ gap: Spacing.xs }}>
          <AppText variant="title">Create account</AppText>
          <AppText variant="caption">
            {phone ? `Step 2 of 2 · ${formatPhone(phone)} verified` : 'Step 1 of 2 · Verify your mobile number'}
          </AppText>
        </View>

        {!phone ? (
          <PhoneVerify purpose="signup" onVerified={(p) => setPhone(p)} />
        ) : (
          <>
            {error ? <Banner message={error} /> : null}
            <TextField label="Name" value={form.name} onChangeText={set('name')} autoComplete="name" error={errors.name} />
            <TextField
              label="Apartment name"
              value={form.apartmentName}
              onChangeText={set('apartmentName')}
              placeholder="e.g. Raemian Gwanggyo"
              error={errors.apartmentName}
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
            />
            <TextField
              label="Email (optional)"
              value={form.email}
              onChangeText={set('email')}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              error={errors.email}
              onSubmitEditing={submit}
            />
            <Button title="Create account" loading={busy} onPress={submit} />
          </>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <AppText variant="caption">Already have an account?</AppText>
          <Link href={{ pathname: '/login', params: next ? { next } : {} }} replace>
            <AppText variant="caption" color={theme.text} style={{ fontWeight: '600', textDecorationLine: 'underline' }}>
              Log in
            </AppText>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
