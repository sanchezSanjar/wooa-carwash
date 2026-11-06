import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CarCard } from '@/components/car-card';
import { AppText, Badge, Banner, Button, Card, Chip, Loading, SectionTitle, TextField } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatPhone, isMobile } from '@/lib/format';
import type { Car, Role, User } from '@/lib/types';

const ROLES: { value: Role; label: string }[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'washer', label: 'Washer' },
  { value: 'admin', label: 'Admin' },
];

export function MembersPanel() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(() => api.members(query), [query]);
  const { data, setData, error, loading } = useApi(load);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const replace = (u: User) => setData((list) => list?.map((x) => (x.id === u.id ? u : x)));

  return (
    <>
      <View style={styles.toolbar}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <TextField
            label="Search"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => setQuery(search.trim())}
            placeholder="Name, phone or apartment"
            returnKeyType="search"
          />
        </View>
        <Button title="Search" variant="secondary" onPress={() => setQuery(search.trim())} style={{ alignSelf: 'flex-end' }} />
        <Button title="Add member" icon="person-add-outline" onPress={() => setAdding((a) => !a)} style={{ alignSelf: 'flex-end' }} />
      </View>

      {adding ? (
        <AddMember
          onCreated={(u) => {
            setData((list) => [u, ...(list ?? [])]);
            setAdding(false);
            setOpen(u.id);
          }}
        />
      ) : null}

      {error ? <Banner message={error} /> : null}
      {loading ? <Loading /> : null}
      {data?.length === 0 ? <AppText variant="caption">No members found.</AppText> : null}
      {data?.map((m) => (
        <MemberRow key={m.id} member={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} onChange={replace} />
      ))}
    </>
  );
}

function AddMember({ onCreated }: { onCreated: (u: User) => void }) {
  const [form, setForm] = useState({ name: '', phone: '', apartmentName: '' });
  const [role, setRole] = useState<Role>('customer');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim() || !form.apartmentName.trim() || !isMobile(form.phone)) {
      setError('Enter a name, a mobile number like 010-1234-5678 and an apartment');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCreated(await api.createMember({ ...form, name: form.name.trim(), apartmentName: form.apartmentName.trim(), role }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the member');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: Spacing.md }}>
      <SectionTitle hint="They get an SMS and set their own password with “Forgot password”.">New member</SectionTitle>
      {error ? <Banner message={error} /> : null}
      <View style={styles.fields}>
        <View style={styles.field}>
          <TextField label="Name" value={form.name} onChangeText={set('name')} />
        </View>
        <View style={styles.field}>
          <TextField label="Mobile number" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="010-1234-5678" />
        </View>
        <View style={styles.field}>
          <TextField label="Apartment name" value={form.apartmentName} onChangeText={set('apartmentName')} />
        </View>
      </View>
      <View style={styles.chips}>
        {ROLES.map((r) => (
          <Chip key={r.value} label={r.label} selected={role === r.value} onPress={() => setRole(r.value)} />
        ))}
      </View>
      <Button title="Create account" loading={busy} onPress={save} />
    </Card>
  );
}

function MemberRow({
  member,
  open,
  onToggle,
  onChange,
}: {
  member: User;
  open: boolean;
  onToggle: () => void;
  onChange: (u: User) => void;
}) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = async (body: Parameters<typeof api.updateMember>[1]) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.updateMember(member.id, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: Spacing.sm }}>
      <Pressable onPress={onToggle} style={styles.rowHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <AppText variant="label">{member.name}</AppText>
          <AppText variant="caption">
            {formatPhone(member.phone)} · {member.apartmentName}
          </AppText>
        </View>
        <View style={styles.badges}>
          {member.role !== 'customer' ? <Badge label={member.role === 'admin' ? 'Admin' : 'Washer'} tone="primary" /> : null}
          {member.status === 'blocked' ? <Badge label="Blocked" tone="warning" /> : null}
          {member.hasPassword === false ? <Badge label="No password yet" /> : null}
        </View>
      </Pressable>
      {open ? (
        <View style={{ gap: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: Spacing.md }}>
          {error ? <Banner message={error} /> : null}
          <AppText variant="caption">Role</AppText>
          <View style={styles.chips}>
            {ROLES.map((r) => (
              <Chip key={r.value} label={r.label} selected={member.role === r.value} disabled={busy} onPress={() => update({ role: r.value })} />
            ))}
          </View>
          <Button
            title={member.status === 'blocked' ? 'Unblock account' : 'Block account'}
            variant={member.status === 'blocked' ? 'secondary' : 'danger'}
            loading={busy}
            onPress={() => update({ status: member.status === 'blocked' ? 'active' : 'blocked' })}
          />
          <MemberCars memberId={member.id} />
        </View>
      ) : null}
    </Card>
  );
}

function MemberCars({ memberId }: { memberId: string }) {
  const { data, loading } = useApi(useCallback(() => api.carsForMember(memberId), [memberId]));
  if (loading) return <Loading />;
  if (!data?.length) return <AppText variant="caption">No cars yet.</AppText>;
  return (
    <View style={{ gap: Spacing.sm }}>
      <AppText variant="caption">Cars</AppText>
      {data.map((c: Car) => (
        <CarCard key={c.id} car={c} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'flex-end' },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  field: { flex: 1, minWidth: 200 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'flex-end' },
});
