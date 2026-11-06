import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { PhoneVerify } from '@/components/phone-verify';
import { AppText, Banner, Button, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';

/** Forgot password: verify the phone by SMS, then choose a new password. */
export default function ForgotScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (password.length < 8) return setError('Use at least 8 characters');
    if (password !== confirm) return setError('The passwords do not match');
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ maxWidth: 440 }}>
        <View style={{ gap: Spacing.xs }}>
          <AppText variant="title">Reset password</AppText>
          <AppText variant="caption">
            {done
              ? 'Your password was changed.'
              : token
                ? 'Choose a new password.'
                : 'We send a code to the mobile number on your account.'}
          </AppText>
        </View>
        {error ? <Banner message={error} /> : null}

        {done ? (
          <>
            <Banner tone="success" message="Password changed. Log in with your new password." />
            <Button title="Log in" onPress={() => router.replace('/login')} />
          </>
        ) : token ? (
          <>
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="At least 8 characters"
            />
            <TextField label="Repeat new password" value={confirm} onChangeText={setConfirm} secureTextEntry onSubmitEditing={save} />
            <Button title="Save new password" loading={busy} onPress={save} />
          </>
        ) : (
          <PhoneVerify
            purpose="reset"
            onVerified={(_phone, resetToken) =>
              resetToken ? setToken(resetToken) : setError('Something went wrong. Request a new code.')
            }
          />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
