import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { CarCard } from '@/components/car-card';
import { Stars } from '@/components/stars';
import { AppText, Badge, Banner, Button, Card, EmptyState, Loading, Screen, SectionTitle, TextField } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useApi } from '@/hooks/use-api';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { formatDay, STATUS_LABEL } from '@/lib/format';
import type { PhotoKind, WashDetail, WashPhoto, WashStatus } from '@/lib/types';

const KIND_TITLE: Record<PhotoKind, { title: string; hint: string }> = {
  before: { title: 'Before the wash', hint: 'Inspection photos of existing scratches or dents.' },
  after: { title: 'After the wash', hint: 'The finished car.' },
};

export default function WashScreen() {
  const { subscriptionId, date } = useLocalSearchParams<{ subscriptionId: string; date: string }>();
  const { user } = useAuth();
  const load = useCallback(() => api.washDetail(subscriptionId, date), [subscriptionId, date]);
  const { data, setData, error, loading, refresh } = useApi(load);
  const staff = user?.role === 'admin' || user?.role === 'washer';

  if (loading) return <Loading />;
  if (error || !data) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Wash not found" message={error ?? undefined} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ maxWidth: 820 }}>
      <Stack.Screen options={{ title: `${data.car?.plateNumber ?? 'Wash'} · ${formatDay(date)}` }} />
      {data.car ? (
        <CarCard car={data.car}>
          <Badge label={STATUS_LABEL[data.status]} tone={data.status === 'done' ? 'success' : data.status === 'skipped' ? 'neutral' : 'warning'} />
        </CarCard>
      ) : null}
      <AppText variant="caption">
        {data.tariffName}
        {data.extras.length ? ` · ${data.extras.join(', ')}` : ''}
        {data.washedOn && data.washedOn !== date ? ` · washed on ${formatDay(data.washedOn)}` : ''}
      </AppText>

      {staff ? <StatusActions detail={data} onChange={(status) => setData((d) => d && { ...d, status })} /> : null}

      {(['before', 'after'] as const).map((kind) => (
        <PhotoSection
          key={kind}
          kind={kind}
          photos={data.photos.filter((p) => p.kind === kind)}
          canEdit={staff}
          detail={data}
          onChanged={refresh}
        />
      ))}

      {!staff ? <ReviewBox detail={data} onSaved={(review) => setData((d) => d && { ...d, review })} /> : null}
      {staff && data.review ? (
        <Card style={{ gap: Spacing.xs }}>
          <SectionTitle>Member rating</SectionTitle>
          <Stars value={data.review.rating} />
          {data.review.comment ? <AppText>{data.review.comment}</AppText> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function StatusActions({ detail, onChange }: { detail: WashDetail; onChange: (s: WashStatus) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = async (status: WashStatus) => {
    setBusy(true);
    setError(null);
    try {
      await api.setWashStatus({ subscriptionId: detail.subscriptionId, date: detail.date, status });
      onChange(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: Spacing.sm }}>
      {error ? <Banner message={error} /> : null}
      <View style={styles.row}>
        {detail.status === 'planned' ? (
          <>
            <Button title="Mark washed" icon="checkmark" loading={busy} onPress={() => set('done')} />
            <Button title="Skip" variant="secondary" disabled={busy} onPress={() => set('skipped')} />
          </>
        ) : (
          <Button title="Undo" variant="ghost" icon="arrow-undo" loading={busy} onPress={() => set('planned')} />
        )}
      </View>
    </View>
  );
}

function PhotoSection({
  kind,
  photos,
  canEdit,
  detail,
  onChanged,
}: {
  kind: PhotoKind;
  photos: WashPhoto[];
  canEdit: boolean;
  detail: WashDetail;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<WashPhoto | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    const perm =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(source === 'camera' ? 'Allow camera access to take photos' : 'Allow photo access to choose photos');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: source === 'library' };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    setBusy(true);
    try {
      for (const asset of result.assets) {
        await api.uploadPhoto({
          subscriptionId: detail.subscriptionId,
          date: detail.date,
          kind,
          note: note.trim() || undefined,
          uri: asset.uri,
          mimeType: asset.mimeType ?? undefined,
        });
      }
      setNote('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the photo');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: WashPhoto) => {
    if (!(await confirm('Delete photo?', 'The member will no longer see it.', 'Delete'))) return;
    try {
      await api.deletePhoto(p.id);
      setOpen(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the photo');
    }
  };

  if (!canEdit && photos.length === 0) return null;

  return (
    <View style={{ gap: Spacing.md }}>
      <SectionTitle hint={KIND_TITLE[kind].hint}>{KIND_TITLE[kind].title}</SectionTitle>
      {error ? <Banner message={error} /> : null}
      {photos.length === 0 ? <AppText variant="caption">No photos yet.</AppText> : null}
      <View style={styles.grid}>
        {photos.map((p) => (
          <Pressable key={p.id} onPress={() => setOpen(p)} style={[styles.thumb, { borderColor: theme.border }]} accessibilityRole="imagebutton">
            <Image source={{ uri: fileUrl(p.url) }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {p.note ? (
              <View style={styles.noteTag}>
                <AppText variant="caption" color="#fff" numberOfLines={2}>
                  {p.note}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      {canEdit ? (
        <Card style={{ gap: Spacing.sm }}>
          {kind === 'before' ? (
            <TextField label="Note for the next photo (optional)" value={note} onChangeText={setNote} placeholder="e.g. Scratch on rear bumper" />
          ) : null}
          <View style={styles.row}>
            {Platform.OS !== 'web' ? (
              <Button title="Take photo" icon="camera-outline" loading={busy} onPress={() => pick('camera')} />
            ) : null}
            <Button title={Platform.OS === 'web' ? 'Upload photos' : 'Choose photos'} variant="secondary" icon="images-outline" disabled={busy} onPress={() => pick('library')} />
          </View>
        </Card>
      ) : null}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={styles.viewer}>
          {open ? <Image source={{ uri: fileUrl(open.url) }} style={styles.full} contentFit="contain" /> : null}
          {open?.note ? (
            <AppText color="#fff" style={{ textAlign: 'center', paddingHorizontal: Spacing.lg }}>
              {open.note}
            </AppText>
          ) : null}
          <View style={styles.row}>
            <Button title="Close" variant="secondary" icon="close" onPress={() => setOpen(null)} />
            {canEdit && open ? <Button title="Delete" variant="danger" icon="trash-outline" onPress={() => remove(open)} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ReviewBox({ detail, onSaved }: { detail: WashDetail; onSaved: (r: WashDetail['review']) => void }) {
  const [rating, setRating] = useState(detail.review?.rating ?? 0);
  const [comment, setComment] = useState(detail.review?.comment ?? '');
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!detail.canReview) {
    return detail.review ? (
      <Card style={{ gap: Spacing.xs }}>
        <SectionTitle>Your rating</SectionTitle>
        <Stars value={detail.review.rating} />
        {detail.review.comment ? <AppText>{detail.review.comment}</AppText> : null}
      </Card>
    ) : null;
  }

  const save = async () => {
    if (rating < 1) return setMessage({ text: 'Tap the stars to rate the wash', tone: 'danger' });
    setBusy(true);
    setMessage(null);
    try {
      onSaved(await api.reviewWash({ subscriptionId: detail.subscriptionId, date: detail.date, rating, comment: comment.trim() }));
      setMessage({ text: 'Thanks for your feedback!', tone: 'success' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Could not save', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: Spacing.md }}>
      <SectionTitle hint="Your rating helps us keep every wash spotless.">{detail.review ? 'Your rating' : 'Rate this wash'}</SectionTitle>
      <Stars value={rating} onChange={setRating} size={32} />
      <TextField
        label="Comment (optional)"
        value={comment}
        onChangeText={setComment}
        multiline
        placeholder="How was it?"
        style={{ minHeight: 80, paddingTop: Spacing.md, textAlignVertical: 'top' }}
      />
      {message ? <Banner message={message.text} tone={message.tone} /> : null}
      <Button title={detail.review ? 'Update rating' : 'Send rating'} loading={busy} onPress={save} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumb: { width: 150, height: 112, borderRadius: Radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  noteTag: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.lg },
  full: { width: '100%', height: '75%' },
});
