import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { AppText, Banner, Button, Chip, Loading, Screen, SectionTitle, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import type { CarInput } from '@/lib/types';

const COLORS = ['White', 'Black', 'Silver', 'Gray', 'Blue', 'Red'];
const FLOORS = ['B1', 'B2', 'B3', 'B4'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const EMPTY: CarInput = {
  plateNumber: '',
  brand: '',
  model: '',
  color: '',
  buildingNumber: '',
  parkingFloor: '',
  arrivesHomeAt: '19:00',
  leavesForWorkAt: '08:00',
};

type Errors = Partial<Record<keyof CarInput, string>>;

/** Accepts "730", "7:30" or "07:30" and returns "07:30". */
function normalizeTime(v: string) {
  const digits = v.replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 4) {
    const padded = digits.padStart(4, '0');
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }
  return v.trim();
}

export default function CarFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isNew = id === 'new';
  const [form, setForm] = useState<CarInput>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    api
      .myCars()
      .then((cars) => {
        const car = cars.find((c) => c.id === id);
        if (!car) throw new Error('Car not found');
        const { id: _id, ownerId: _owner, ...rest } = car;
        setForm(rest);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load car'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  if (!user) {
    return (
      <Screen>
        <Button title="Log in to add a car" onPress={() => router.replace({ pathname: '/login', params: { next: '/car/new' } })} />
      </Screen>
    );
  }
  if (loading) return <Loading />;

  const set = (key: keyof CarInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validate = (data: CarInput) => {
    const e: Errors = {};
    if (!data.plateNumber.trim()) e.plateNumber = 'Enter the plate number';
    if (!data.brand.trim()) e.brand = 'Enter the brand';
    if (!data.model.trim()) e.model = 'Enter the model';
    if (!data.color.trim()) e.color = 'Choose or type a color';
    if (!data.buildingNumber.trim()) e.buildingNumber = 'Enter the building number';
    if (!data.parkingFloor.trim()) e.parkingFloor = 'Choose the parking floor';
    if (!TIME_RE.test(data.arrivesHomeAt)) e.arrivesHomeAt = 'Use a time like 19:00';
    if (!TIME_RE.test(data.leavesForWorkAt)) e.leavesForWorkAt = 'Use a time like 07:30';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    const data = {
      ...form,
      arrivesHomeAt: normalizeTime(form.arrivesHomeAt),
      leavesForWorkAt: normalizeTime(form.leavesForWorkAt),
    };
    setForm(data);
    if (!validate(data)) return;
    setBusy(true);
    setError(null);
    try {
      const trimmed = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.trim()])) as CarInput;
      if (isNew) {
        const car = await api.createCar(trimmed);
        router.replace({ pathname: '/plan/[carId]', params: { carId: car.id } });
      } else {
        await api.updateCar(id, trimmed);
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the car');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm('Remove car?', `${form.plateNumber} will be removed from your account.`, 'Remove'))) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteCar(id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the car');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ maxWidth: 640 }}>
        <Stack.Screen options={{ title: isNew ? 'Add a car' : 'Edit car' }} />
        {error ? <Banner message={error} /> : null}

        <SectionTitle>Car</SectionTitle>
        <TextField
          label="Plate number"
          value={form.plateNumber}
          onChangeText={set('plateNumber')}
          placeholder="12가 3456"
          autoCapitalize="characters"
          error={errors.plateNumber}
        />
        <Row>
          <TextField label="Brand" value={form.brand} onChangeText={set('brand')} placeholder="Hyundai" error={errors.brand} />
          <TextField label="Model" value={form.model} onChangeText={set('model')} placeholder="Avante" error={errors.model} />
        </Row>
        <View style={{ gap: Spacing.sm }}>
          <TextField label="Color" value={form.color} onChangeText={set('color')} placeholder="White" error={errors.color} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
            {COLORS.map((c) => (
              <Chip key={c} label={c} selected={form.color === c} onPress={() => set('color')(c)} />
            ))}
          </View>
        </View>

        <SectionTitle hint={`In ${user.apartmentName}`}>Parking spot</SectionTitle>
        <Row>
          <TextField
            label="Building number"
            value={form.buildingNumber}
            onChangeText={set('buildingNumber')}
            placeholder="101"
            keyboardType="number-pad"
            error={errors.buildingNumber}
          />
          <TextField
            label="Parking floor"
            value={form.parkingFloor}
            onChangeText={set('parkingFloor')}
            placeholder="B2"
            autoCapitalize="characters"
            error={errors.parkingFloor}
          />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {FLOORS.map((f) => (
            <Chip key={f} label={f} selected={form.parkingFloor.toUpperCase() === f} onPress={() => set('parkingFloor')(f)} />
          ))}
        </View>

        <SectionTitle hint="We wash while the car is parked at home.">Daily routine</SectionTitle>
        <Row>
          <TextField
            label="Arrives home at"
            value={form.arrivesHomeAt}
            onChangeText={set('arrivesHomeAt')}
            placeholder="19:00"
            keyboardType="numbers-and-punctuation"
            error={errors.arrivesHomeAt}
          />
          <TextField
            label="Leaves for work at"
            value={form.leavesForWorkAt}
            onChangeText={set('leavesForWorkAt')}
            placeholder="07:30"
            keyboardType="numbers-and-punctuation"
            error={errors.leavesForWorkAt}
          />
        </Row>

        <Button title={isNew ? 'Save and choose a plan' : 'Save changes'} loading={busy} onPress={save} />
        {!isNew ? <Button title="Remove car" variant="danger" icon="trash-outline" disabled={busy} onPress={remove} /> : null}
        {isNew ? (
          <AppText variant="caption" style={{ textAlign: 'center' }}>
            You can add more cars later from My cars.
          </AppText>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Row({ children }: { children: React.ReactNode[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg }}>
      {children.map((child, i) => (
        <View key={i} style={{ flex: 1, minWidth: 200 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
