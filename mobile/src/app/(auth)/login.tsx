import { Link, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';

import { AppText, Banner, Button, Screen, TextField } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { formatPhone, isMobile } from '@/lib/format';
import { finishAuth } from '@/lib/navigation';

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!isMobile(phone) || !password) {
      setError('Enter your mobile number and password');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(phone, password);
      finishAuth(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log in');
    } finally {
      setBusy(false);
    }
  };

  const link = { color: theme.text, fontWeight: '600' as const, textDecorationLine: 'underline' as const };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ maxWidth: 440 }}>
        <View style={{ gap: Spacing.xs }}>
          <AppText variant="title">Welcome back</AppText>
          <AppText variant="caption">Log in with your mobile number.</AppText>
        </View>
        {error ? <Banner message={error} /> : null}
        <TextField
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          onBlur={() => phone && setPhone(formatPhone(phone))}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder="010-1234-5678"
        />
        <TextField
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Log in" loading={busy} onPress={submit} />
        <View style={{ alignItems: 'center' }}>
          <Link href="/forgot" replace>
            <AppText variant="caption" style={link}>
              Forgot password?
            </AppText>
          </Link>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <AppText variant="caption">New here?</AppText>
          <Link href={{ pathname: '/register', params: next ? { next } : {} }} replace>
            <AppText variant="caption" style={link}>
              Create an account
            </AppText>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
