import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';

import { AppText, Button, Card, SectionTitle } from './ui';

const SHOWN = 5;

/** Wash reminders (from the batch server) and "your car is washed" messages. */
export function Updates() {
  const theme = useTheme();
  const { data, setData } = useApi(useCallback(() => api.myNotifications(), []));
  const [busy, setBusy] = useState(false);

  if (!data || data.items.length === 0) return null;

  const markRead = async () => {
    setBusy(true);
    try {
      await api.markNotificationsRead();
      setData((d) => d && { unread: 0, items: d.items.map((n) => ({ ...n, read: true })) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.head}>
        <SectionTitle>{data.unread > 0 ? `Updates (${data.unread} new)` : 'Updates'}</SectionTitle>
        {data.unread > 0 ? <Button title="Mark all read" variant="ghost" loading={busy} onPress={markRead} /> : null}
      </View>
      <Card style={{ gap: 0, paddingVertical: Spacing.xs }}>
        {data.items.slice(0, SHOWN).map((n, i) => (
          <View
            key={n.id}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <Ionicons
              name={n.type === 'wash_done' ? 'checkmark-circle-outline' : 'notifications-outline'}
              size={20}
              color={n.type === 'wash_done' ? theme.success : theme.text}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="label">{n.title}</AppText>
              {n.body ? <AppText variant="caption">{n.body}</AppText> : null}
            </View>
            {!n.read ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
