import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { formatPhone, isMobile } from '@/lib/format';

import { AppText, Banner, Button, TextField } from './ui';

const RESEND_AFTER = 60;

/**
 * Step 1: phone number → SMS code. Step 2: enter the code.
 * Calls onVerified with the phone (and, for a reset, the one-time reset token).
 */
export function PhoneVerify({
  purpose,
  onVerified,
}: {
  purpose: 'signup' | 'reset';
  onVerified: (phone: string, resetToken?: string) => void;
}) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    if (!isMobile(phone)) {
      setError('Enter a mobile number like 010-1234-5678');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.requestOtp(phone, purpose);
      setSent(true);
      setInfo(res.message);
      setWait(RESEND_AFTER);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the SMS');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyOtp(phone, purpose, code);
      onVerified(phone, res.resetToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify the code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Spacing.lg }}>
      {error ? <Banner message={error} /> : null}
      <TextField
        label="Mobile number"
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          setSent(false);
          setCode('');
        }}
        onBlur={() => phone && setPhone(formatPhone(phone))}
        placeholder="010-1234-5678"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        editable={!busy}
      />
      {sent ? (
        <>
          {info ? <AppText variant="caption">{info}. It is valid for 3 minutes.</AppText> : null}
          <TextField
            label="Code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 digits"
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            onSubmitEditing={verify}
          />
          <Button title="Verify" loading={busy} onPress={verify} />
          <Button
            title={wait > 0 ? `Send again in ${wait}s` : 'Send a new code'}
            variant="ghost"
            disabled={wait > 0 || busy}
            onPress={send}
          />
        </>
      ) : (
        <Button title="Send code" loading={busy} onPress={send} />
      )}
    </View>
  );
}
