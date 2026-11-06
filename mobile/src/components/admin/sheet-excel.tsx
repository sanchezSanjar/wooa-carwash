import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { api, XLSX_TYPE } from '@/lib/api';
import { downloadFromApi } from '@/lib/download';
import type { SheetImportPreview } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

const RANGES = [
  { days: 1, label: 'This day' },
  { days: 7, label: 'This day and the next 6' },
  { days: 14, label: 'Two weeks' },
];

type ChangeType = SheetImportPreview['changes'][number]['type'];
const CHANGE_ICON: Record<ChangeType, keyof typeof Ionicons.glyphMap> = {
  order: 'swap-vertical',
  washer: 'person-outline',
  note: 'document-text-outline',
  moved: 'calendar-outline',
  removed: 'remove-circle-outline',
  added: 'add-circle-outline',
};

/**
 * Export the day sheets to Excel and import an edited workbook.
 * The import shows every change first; nothing is saved until "Apply".
 */
export function SheetExcel({ date, onImported }: { date: string; onImported: () => void }) {
  const theme = useTheme();
  const { t, fmt } = useI18n();
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState<'export' | 'import' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SheetImportPreview | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const exportDays = async (days: number) => {
    setChoosing(false);
    setBusy('export');
    setError(null);
    try {
      const name = `wooa-daysheet-${date}${days > 1 ? `-${days}days` : ''}.xlsx`;
      await downloadFromApi(`/daysheets/export?from=${date}&days=${days}`, name, XLSX_TYPE);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not export'));
    } finally {
      setBusy(null);
    }
  };

  const importFile = async () => {
    setError(null);
    setDone(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: [XLSX_TYPE, 'application/vnd.ms-excel', '.xlsx'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setBusy('import');
    try {
      setPreview(
        await api.previewSheetImport({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? undefined, file: asset.file ?? undefined }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not read the file'));
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy('apply');
    setError(null);
    try {
      const res = await api.applySheetImport(preview.plan);
      setPreview(null);
      setDone(res.saved.length ? t('Saved {days}', { days: res.saved.map(fmt.day).join(', ') }) : t('Nothing to change'));
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not apply the import'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button title={t('Export to Excel')} variant="secondary" icon="download-outline" loading={busy === 'export'} onPress={() => setChoosing(true)} />
      <Button title={t('Import from Excel')} variant="secondary" icon="cloud-upload-outline" loading={busy === 'import'} onPress={importFile} />
      {error && !preview ? (
        <View style={{ width: '100%' }}>
          <Banner message={error} />
        </View>
      ) : null}
      {done ? (
        <View style={{ width: '100%' }}>
          <Banner tone="success" message={done} />
        </View>
      ) : null}

      <Modal visible={choosing} transparent animationType="fade" onRequestClose={() => setChoosing(false)}>
        <Pressable style={styles.backdrop} onPress={() => setChoosing(false)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, maxWidth: 380 }]} onPress={() => undefined}>
            <AppText variant="heading">{t('Export to Excel')}</AppText>
            <AppText variant="caption">{t('One tab per day, starting {date}. Edit the yellow columns and import the file again.', { date: fmt.day(date) })}</AppText>
            {RANGES.map((r) => (
              <Pressable key={r.days} onPress={() => exportDays(r.days)} style={({ pressed }) => [styles.option, { backgroundColor: pressed ? theme.muted : 'transparent' }]}>
                <AppText variant="label">{t(r.label)}</AppText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.dialog, { backgroundColor: theme.card, maxWidth: 620 }]}>
            {preview ? (
              <>
                <View style={styles.head}>
                  <Ionicons name="document-outline" size={22} color={theme.success} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading">{t('Import day sheet')}</AppText>
                    <AppText variant="caption">
                      {preview.filename ?? t('Workbook')} · {t('{n} rows', { n: preview.rowsRead })} · {preview.days.map(fmt.day).join(', ')}
                    </AppText>
                  </View>
                  <Pressable onPress={() => setPreview(null)} accessibilityLabel={t('Close')}>
                    <Ionicons name="close" size={22} color={theme.text} />
                  </Pressable>
                </View>

                <View style={styles.stats}>
                  <Stat label={t('Unchanged')} value={preview.unchanged} bg={theme.surface} fg={theme.text} />
                  <Stat label={t('Changes')} value={preview.changes.length} bg={theme.primarySoft} fg={theme.text} />
                  <Stat label={t('Problems')} value={preview.problems.length} bg={preview.problems.length ? theme.dangerSoft : theme.surface} fg={preview.problems.length ? theme.danger : theme.text} />
                </View>

                <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 0 }}>
                  {preview.changes.map((c, i) => (
                    <View key={`c${i}`} style={[styles.item, { borderTopColor: theme.border }]}>
                      <Ionicons name={CHANGE_ICON[c.type]} size={18} color={c.type === 'moved' || c.type === 'removed' ? theme.warning : theme.text} />
                      <AppText style={{ flex: 1 }}>
                        <AppText variant="label">{c.plateNumber}</AppText>
                        <AppText variant="caption"> · {c.detail}</AppText>
                      </AppText>
                    </View>
                  ))}
                  {preview.problems.map((p, i) => (
                    <View key={`p${i}`} style={[styles.item, { borderTopColor: theme.border }]}>
                      <Ionicons name="warning-outline" size={18} color={theme.danger} />
                      <AppText style={{ flex: 1 }}>
                        <AppText variant="label" color={theme.danger}>
                          {t('Row {row}', { row: p.row })}
                          {p.plateNumber ? `: ${p.plateNumber}` : ''}
                        </AppText>
                        <AppText variant="caption"> · {p.message}</AppText>
                      </AppText>
                    </View>
                  ))}
                  {preview.changes.length === 0 && preview.problems.length === 0 ? (
                    <AppText variant="caption">{t('The file matches the day sheets. Nothing to change.')}</AppText>
                  ) : null}
                </ScrollView>

                {error ? <Banner message={error} /> : null}
                <AppText variant="caption">{t('Only the day sheets change. Cars, members, plans and wash results stay as they are.')}</AppText>
                <View style={styles.actions}>
                  <Button title={t('Cancel')} variant="secondary" onPress={() => setPreview(null)} />
                  <Button
                    title={preview.plan.length ? fmt.count(preview.changes.length, 'Apply {n} change', 'Apply {n} changes') : t('Nothing to apply')}
                    disabled={!preview.plan.length}
                    loading={busy === 'apply'}
                    onPress={apply}
                  />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Stat({ label, value, bg, fg }: { label: string; value: number; bg: string; fg: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <AppText variant="caption" color={fg}>
        {label}
      </AppText>
      <AppText variant="heading" color={fg}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  dialog: { width: '100%', borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, maxHeight: '90%' },
  option: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: { flexGrow: 1, flexBasis: 110, borderRadius: Radius.md, padding: Spacing.md, gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
