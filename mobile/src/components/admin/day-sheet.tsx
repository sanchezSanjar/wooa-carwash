import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, Banner, Button, Card, DateStrip, EmptyState, Loading } from '@/components/ui';
import { Fonts, Radius, Spacing, useTheme } from '@/constants/theme';
import { api } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatDay, formatPhone, STATUS_LABEL, upcomingDates } from '@/lib/format';
import type { DaySheet as Sheet, DaySheetRow, SheetCandidate, StaffMember, WashStatus } from '@/lib/types';

const DAY_MS = 86_400_000;
const keyOf = (r: { subscriptionId: string; scheduledDate: string }) => `${r.subscriptionId}|${r.scheduledDate}`;
const toSave = (rows: DaySheetRow[]) =>
  rows.map((r) => ({ subscriptionId: r.subscriptionId, scheduledDate: r.scheduledDate, washerId: r.washerId ?? undefined, note: r.note }));

/**
 * The day's workbook. Staff mark washes and add photos; admins reorder, assign washers, add notes,
 * pull in cars from other days or move cars away, then save. Only the day sheet is saved:
 * cars, members and plans never change.
 */
export function DaySheetPanel({ isAdmin }: { isAdmin: boolean }) {
  // three days back (to fix up yesterday) and two weeks ahead
  const [dates] = useState(() => upcomingDates(17, new Date(Date.now() - 3 * DAY_MS)));
  const [date, setDate] = useState(dates[3]); // today
  return (
    <>
      <DateStrip dates={dates} value={date} onChange={setDate} compact />
      <SheetForDay key={date} date={date} isAdmin={isAdmin} moveDates={dates.slice(3)} />
    </>
  );
}

function SheetForDay({ date, isAdmin, moveDates }: { date: string; isAdmin: boolean; moveDates: string[] }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [rows, setRows] = useState<DaySheetRow[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<DaySheetRow | null>(null);
  const [assigning, setAssigning] = useState<DaySheetRow | null>(null);

  const accept = useCallback((s: Sheet) => {
    setSheet(s);
    setRows(s.rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .daySheet(date)
      .then((s) => {
        if (cancelled) return;
        accept(s);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the day sheet'));
    if (isAdmin) api.sheetStaff().then((s) => !cancelled && setStaff(s)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [date, isAdmin, accept]);

  const dirty = !!sheet && JSON.stringify(toSave(rows)) !== JSON.stringify(toSave(sheet.rows));
  const done = rows.filter((r) => r.status === 'done').length;
  const skipped = rows.filter((r) => r.status === 'skipped').length;

  const patch = (key: string, change: Partial<DaySheetRow>) =>
    setRows((list) => list.map((r) => (keyOf(r) === key ? { ...r, ...change } : r)));

  const moveBy = (index: number, delta: number) =>
    setRows((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      accept(await api.saveDaySheet(date, toSave(rows)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the sheet');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (row: DaySheetRow, status: WashStatus) => {
    setBusyKey(keyOf(row));
    setError(null);
    try {
      await api.setWashStatus({ subscriptionId: row.subscriptionId, date: row.scheduledDate, status, washedOn: date });
      const change = { status, washedOn: status === 'planned' ? null : date };
      patch(keyOf(row), change);
      setSheet((s) => s && { ...s, rows: s.rows.map((r) => (keyOf(r) === keyOf(row) ? { ...r, ...change } : r)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the wash');
    } finally {
      setBusyKey(null);
    }
  };

  const moveTo = async (row: DaySheetRow, toDate: string) => {
    if (dirty && !(await confirm('Unsaved changes', 'Moving saves this sheet first. Save and move?', 'Save and move'))) return;
    setMoving(null);
    setBusyKey(keyOf(row));
    setError(null);
    try {
      if (dirty) await api.saveDaySheet(date, toSave(rows));
      const res = await api.moveWash(date, { subscriptionId: row.subscriptionId, scheduledDate: row.scheduledDate, toDate });
      accept(res.from);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the car');
    } finally {
      setBusyKey(null);
    }
  };

  if (!sheet && !error) return <Loading />;

  const actionsFor = (row: DaySheetRow, index: number) => (
    <RowActions
      row={row}
      isAdmin={isAdmin}
      busy={busyKey === keyOf(row)}
      first={index === 0}
      last={index === rows.length - 1}
      onUp={() => moveBy(index, -1)}
      onDown={() => moveBy(index, 1)}
      onMove={() => setMoving(row)}
      onRemove={() => setRows((list) => list.filter((r) => keyOf(r) !== keyOf(row)))}
      onStatus={(s) => setStatus(row, s)}
      onPhotos={() => router.push({ pathname: '/wash/[subscriptionId]/[date]', params: { subscriptionId: row.subscriptionId, date: row.scheduledDate } })}
    />
  );

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.toolbar}>
        <View style={{ flex: 1, gap: 2, minWidth: 220 }}>
          <AppText variant="heading">{formatDay(date)}</AppText>
          <AppText variant="caption">
            {sheet?.saved ? 'Saved day sheet' : 'Draft from the schedule (not saved yet)'} · {rows.length} cars · {done} washed ·{' '}
            {rows.length - done - skipped} left
          </AppText>
        </View>
        {isAdmin ? (
          <>
            <Button title="Add car" variant="secondary" icon="add" onPress={() => setAdding(true)} />
            {dirty ? <Button title="Discard" variant="ghost" onPress={() => sheet && setRows(sheet.rows)} /> : null}
            <Button title={dirty ? 'Save sheet' : sheet?.saved ? 'Saved' : 'Save sheet'} icon="save-outline" disabled={!dirty && !!sheet?.saved} loading={saving} onPress={save} />
          </>
        ) : null}
      </View>
      {sheet?.weather ? (
        <View style={[styles.weather, { backgroundColor: sheet.weather.wet ? theme.warningSoft : theme.surface }]}>
          <Ionicons name={sheet.weather.wet ? 'rainy-outline' : 'partly-sunny-outline'} size={18} color={sheet.weather.wet ? theme.warning : theme.text} />
          <AppText variant="label" color={sheet.weather.wet ? theme.warning : theme.text} style={{ flex: 1 }}>
            {sheet.weather.summary}
            {sheet.weather.wet ? ' · members with a wash get a weather notice the evening before' : ''}
          </AppText>
        </View>
      ) : null}
      {dirty ? <Banner tone="success" message="You have unsaved changes on this day sheet." /> : null}
      {error ? <Banner message={error} /> : null}
      {rows.length === 0 ? <EmptyState icon="sunny-outline" title="No cars on this day" message={isAdmin ? 'Use “Add car” to bring in a car from another day.' : undefined} /> : null}

      {wide && rows.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={[styles.table, { borderColor: theme.border }]}>
            <View style={[styles.tr, styles.th, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {COLUMNS.map((c) => (
                <AppText key={c.key} variant="caption" style={[styles.cell, { width: c.width, fontWeight: '600' }]}>
                  {c.label}
                </AppText>
              ))}
            </View>
            {rows.map((r, i) => (
              <View key={keyOf(r)} style={[styles.tr, { borderColor: theme.border, backgroundColor: r.status === 'done' ? theme.successSoft : theme.card }]}>
                <AppText variant="label" style={[styles.cell, { width: COL.order }]}>
                  {i + 1}
                </AppText>
                <View style={[styles.cell, { width: COL.where }]}>
                  <AppText variant="label">
                    {r.car.buildingNumber} · {r.car.parkingFloor}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {r.member.apartmentName}
                  </AppText>
                </View>
                <View style={[styles.cell, { width: COL.car }]}>
                  <AppText variant="label">{r.car.plateNumber}</AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {r.car.color} {r.car.brand} {r.car.model}
                  </AppText>
                </View>
                <AppText variant="caption" style={[styles.cell, { width: COL.parked }]}>
                  {r.car.arrivesHomeAt} → {r.car.leavesForWorkAt}
                </AppText>
                <View style={[styles.cell, { width: COL.plan }]}>
                  <AppText variant="caption" numberOfLines={2}>
                    {r.tariffName}
                    {r.extras.length ? ` + ${r.extras.join(', ')}` : ''}
                  </AppText>
                  {r.moved ? <Badge label={`From ${formatDay(r.scheduledDate)}`} tone="warning" /> : null}
                </View>
                <View style={[styles.cell, { width: COL.washer }]}>
                  <WasherCell row={r} editable={isAdmin} onPress={() => setAssigning(r)} />
                </View>
                <View style={[styles.cell, { width: COL.note }]}>
                  <NoteCell row={r} editable={isAdmin} onChange={(note) => patch(keyOf(r), { note })} />
                </View>
                <View style={[styles.cell, { width: COL.status }]}>
                  <StatusBadge row={r} />
                </View>
                <View style={[styles.cell, { width: COL.actions }]}>{actionsFor(r, i)}</View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        rows.map((r, i) => (
          <Card key={keyOf(r)} style={{ gap: Spacing.sm, backgroundColor: r.status === 'done' ? theme.successSoft : theme.card }}>
            <View style={styles.cardHead}>
              <View style={[styles.order, { borderColor: theme.text }]}>
                <AppText variant="label">{i + 1}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">{r.car.plateNumber}</AppText>
                <AppText variant="caption">
                  {r.car.color} {r.car.brand} {r.car.model} · Bldg {r.car.buildingNumber} · {r.car.parkingFloor}
                </AppText>
              </View>
              <StatusBadge row={r} />
            </View>
            <AppText variant="caption">
              {r.member.apartmentName} · parked {r.car.arrivesHomeAt} → {r.car.leavesForWorkAt} · {r.tariffName}
              {r.extras.length ? ` + ${r.extras.join(', ')}` : ''}
            </AppText>
            <Pressable onPress={() => Linking.openURL(`tel:${r.member.phone}`)}>
              <AppText variant="caption">
                {r.member.name} · {formatPhone(r.member.phone)}
              </AppText>
            </Pressable>
            {r.moved ? <Badge label={`Moved from ${formatDay(r.scheduledDate)}`} tone="warning" /> : null}
            <View style={styles.inline}>
              <WasherCell row={r} editable={isAdmin} onPress={() => setAssigning(r)} />
            </View>
            <NoteCell row={r} editable={isAdmin} onChange={(note) => patch(keyOf(r), { note })} />
            {actionsFor(r, i)}
          </Card>
        ))
      )}

      {/* move to another day */}
      <Picker visible={!!moving} title={`Move ${moving?.car.plateNumber ?? ''} to…`} onClose={() => setMoving(null)}>
        {moveDates
          .filter((d) => d !== date)
          .map((d) => (
            <PickerItem key={d} label={formatDay(d)} onPress={() => moving && moveTo(moving, d)} />
          ))}
      </Picker>

      {/* assign a washer */}
      <Picker visible={!!assigning} title="Assign washer" onClose={() => setAssigning(null)}>
        <PickerItem
          label="Nobody"
          onPress={() => {
            if (assigning) patch(keyOf(assigning), { washerId: null, washerName: null });
            setAssigning(null);
          }}
        />
        {staff.map((s) => (
          <PickerItem
            key={s.id}
            label={`${s.name}${s.role === 'admin' ? ' (admin)' : ''}`}
            onPress={() => {
              if (assigning) patch(keyOf(assigning), { washerId: s.id, washerName: s.name });
              setAssigning(null);
            }}
          />
        ))}
      </Picker>

      {adding ? (
        <AddCars
          date={date}
          onClose={() => setAdding(false)}
          onAdd={(c) => {
            setRows((list) => (list.some((r) => keyOf(r) === keyOf(c)) ? list : [...list, { ...c, moved: c.scheduledDate !== date }]));
          }}
          existing={new Set(rows.map(keyOf))}
        />
      ) : null}
    </View>
  );
}

const COL = { order: 40, where: 130, car: 150, parked: 110, plan: 170, washer: 140, note: 190, status: 90, actions: 400 };
const COLUMNS = [
  { key: 'order', label: '#', width: COL.order },
  { key: 'where', label: 'Bldg · Floor', width: COL.where },
  { key: 'car', label: 'Car', width: COL.car },
  { key: 'parked', label: 'Parked', width: COL.parked },
  { key: 'plan', label: 'Plan & extras', width: COL.plan },
  { key: 'washer', label: 'Washer', width: COL.washer },
  { key: 'note', label: 'Note', width: COL.note },
  { key: 'status', label: 'Status', width: COL.status },
  { key: 'actions', label: '', width: COL.actions },
];

function StatusBadge({ row }: { row: DaySheetRow }) {
  return (
    <Badge
      label={STATUS_LABEL[row.status]}
      tone={row.status === 'done' ? 'success' : row.status === 'skipped' ? 'neutral' : 'warning'}
    />
  );
}

function WasherCell({ row, editable, onPress }: { row: DaySheetRow; editable: boolean; onPress: () => void }) {
  const theme = useTheme();
  const label = row.washerName ?? (editable ? 'Assign washer' : 'No washer');
  if (!editable) return <AppText variant="caption">{label}</AppText>;
  return (
    <Pressable onPress={onPress} style={[styles.select, { borderColor: theme.border }]} accessibilityRole="button">
      <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
      <AppText variant="caption" color={row.washerName ? theme.text : theme.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </AppText>
      <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
    </Pressable>
  );
}

function NoteCell({ row, editable, onChange }: { row: DaySheetRow; editable: boolean; onChange: (v: string) => void }) {
  const theme = useTheme();
  if (!editable) return row.note ? <AppText variant="caption">Note: {row.note}</AppText> : null;
  return (
    <TextInput
      value={row.note}
      onChangeText={onChange}
      placeholder="Note"
      placeholderTextColor={theme.textSecondary}
      style={[styles.noteInput, { color: theme.text, borderColor: theme.border, fontFamily: Fonts.sans }]}
    />
  );
}

function RowActions(p: {
  row: DaySheetRow;
  isAdmin: boolean;
  busy: boolean;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onMove: () => void;
  onRemove: () => void;
  onStatus: (s: WashStatus) => void;
  onPhotos: () => void;
}) {
  const theme = useTheme();
  const icon = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled || p.busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconBtn, { borderColor: theme.border, opacity: disabled || p.busy ? 0.4 : 1 }]}>
      <Ionicons name={name} size={16} color={theme.text} />
    </Pressable>
  );
  return (
    <View style={styles.inline}>
      {p.row.status === 'planned' ? (
        <>
          <Button title="Washed" icon="checkmark" loading={p.busy} onPress={() => p.onStatus('done')} style={styles.small} />
          <Button title="Skip" variant="secondary" disabled={p.busy} onPress={() => p.onStatus('skipped')} style={styles.small} />
        </>
      ) : (
        <Button title="Undo" variant="ghost" icon="arrow-undo" loading={p.busy} onPress={() => p.onStatus('planned')} style={styles.small} />
      )}
      {icon('camera-outline', 'Photos & details', p.onPhotos)}
      {p.isAdmin ? (
        <>
          {icon('arrow-up', 'Move up', p.onUp, p.first)}
          {icon('arrow-down', 'Move down', p.onDown, p.last)}
          {icon('calendar-outline', 'Move to another day', p.onMove, p.row.status === 'done')}
          {icon('close', 'Remove from this day', p.onRemove, p.row.status === 'done')}
        </>
      ) : null}
    </View>
  );
}

function AddCars({
  date,
  existing,
  onAdd,
  onClose,
}: {
  date: string;
  existing: Set<string>;
  onAdd: (c: SheetCandidate) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<SheetCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.sheetCandidates(date).then(setList).catch((e) => setError(e instanceof Error ? e.message : 'Could not load cars'));
  }, [date]);
  const REASON: Record<SheetCandidate['reason'], { label: string; tone: 'warning' | 'neutral' | 'primary' }> = {
    missed: { label: 'Missed', tone: 'warning' },
    skipped: { label: 'Skipped', tone: 'warning' },
    today: { label: 'Today', tone: 'primary' },
    upcoming: { label: 'Upcoming', tone: 'neutral' },
  };
  return (
    <Picker visible title={`Add a car to ${formatDay(date)}`} onClose={onClose} wide>
      {error ? <Banner message={error} /> : null}
      {!list && !error ? <Loading /> : null}
      {list?.length === 0 ? <AppText variant="caption">No other cars to add.</AppText> : null}
      {list?.map((c) => {
        const added = existing.has(keyOf(c));
        return (
          <Pressable key={keyOf(c)} disabled={added} onPress={() => onAdd(c)} style={[styles.candidate, added && { opacity: 0.45 }]}>
            <View style={{ flex: 1 }}>
              <AppText variant="label">
                {c.car.plateNumber} · Bldg {c.car.buildingNumber} {c.car.parkingFloor}
              </AppText>
              <AppText variant="caption">
                {c.member.apartmentName} · {c.member.name} · due {formatDay(c.scheduledDate)}
              </AppText>
            </View>
            <Badge label={added ? 'Added' : REASON[c.reason].label} tone={added ? 'success' : REASON[c.reason].tone} />
          </Pressable>
        );
      })}
    </Picker>
  );
}

function Picker({
  visible,
  title,
  onClose,
  children,
  wide,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card, maxWidth: wide ? 640 : 380 }]} onPress={() => undefined}>
          <View style={styles.sheetHead}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {title}
            </AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: Spacing.xs }}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerItem({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pickerItem, { backgroundColor: pressed ? theme.muted : 'transparent' }]}>
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  weather: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56 },
  th: { minHeight: 36 },
  cell: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, gap: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  order: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.xs },
  nowrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  select: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, minHeight: 34 },
  noteInput: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, minHeight: 34, fontSize: 13 },
  iconBtn: { width: 34, height: 34, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  small: { minHeight: 34, paddingHorizontal: Spacing.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  sheet: { width: '100%', maxHeight: '80%', borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pickerItem: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
});
