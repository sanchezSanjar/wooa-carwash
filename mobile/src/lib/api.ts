import { Platform } from 'react-native';

import type {
  AppNotification,
  AuthResponse,
  Car,
  CarInput,
  DayPlanItem,
  Role,
  Extra,
  ScheduleDay,
  Subscription,
  Tariff,
  User,
  WashStatus,
} from './types';

const fallbackUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackUrl).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    const raw = (data as { message?: string | string[] } | undefined)?.message;
    const message = Array.isArray(raw) ? raw[0] : raw;
    throw new ApiError(message ? capitalize(message) : `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const api = {
  requestOtp: (phone: string, purpose: 'signup' | 'reset') =>
    request<{ message: string }>('POST', '/auth/otp/request', { phone, purpose }),
  verifyOtp: (phone: string, purpose: 'signup' | 'reset', code: string) =>
    request<{ verified: true; resetToken?: string }>('POST', '/auth/otp/verify', { phone, purpose, code }),
  register: (body: { name: string; phone: string; password: string; apartmentName: string; email?: string }) =>
    request<AuthResponse>('POST', '/auth/register', body),
  login: (body: { phone: string; password: string }) => request<AuthResponse>('POST', '/auth/login', body),
  resetPassword: (resetToken: string, newPassword: string) =>
    request<{ message: string }>('POST', '/auth/reset-password', { resetToken, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('POST', '/members/me/password', { currentPassword, newPassword }),

  members: (search?: string) =>
    request<User[]>('GET', `/members${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  member: (id: string) => request<User>('GET', `/members/${id}`),
  createMember: (body: { name: string; phone: string; apartmentName: string; role: Role; email?: string }) =>
    request<User>('POST', '/members', body),
  updateMember: (id: string, body: Partial<Pick<User, 'name' | 'phone' | 'apartmentName' | 'role' | 'status'>> & { email?: string }) =>
    request<User>('PATCH', `/members/${id}`, body),
  carsForMember: (ownerId: string) => request<Car[]>('GET', `/cars?ownerId=${ownerId}`),
  me: () => request<User>('GET', '/auth/me'),
  updateProfile: (body: { name?: string; apartmentName?: string; email?: string }) =>
    request<User>('PATCH', '/members/me', body),

  tariffs: () => request<Tariff[]>('GET', '/tariffs'),
  extras: () => request<Extra[]>('GET', '/extras'),
  allTariffs: () => request<Tariff[]>('GET', '/admin/tariffs'),
  allExtras: () => request<Extra[]>('GET', '/admin/extras'),
  updateTariff: (id: string, body: Partial<Pick<Tariff, 'price' | 'active'>>) =>
    request<Tariff>('PATCH', `/tariffs/${id}`, body),
  updateExtra: (id: string, body: Partial<Pick<Extra, 'price' | 'active'>>) =>
    request<Extra>('PATCH', `/extras/${id}`, body),

  myCars: () => request<Car[]>('GET', '/cars/me'),
  createCar: (body: CarInput & { ownerId?: string }) => request<Car>('POST', '/cars', body),
  updateCar: (id: string, body: Partial<CarInput>) => request<Car>('PATCH', `/cars/${id}`, body),
  deleteCar: (id: string) => request<void>('DELETE', `/cars/${id}`),

  mySubscriptions: () => request<Subscription[]>('GET', '/subscriptions/me'),
  subscribe: (body: {
    carId: string;
    tariffId: string;
    startDate: string;
    schedule: ScheduleDay[];
    extraIds: string[];
  }) => request<Subscription>('POST', '/subscriptions', body),
  updateSubscription: (id: string, body: { schedule?: ScheduleDay[]; extraIds?: string[] }) =>
    request<Subscription>('PATCH', `/subscriptions/${id}`, body),
  cancelSubscription: (id: string) => request<Subscription>('PATCH', `/subscriptions/${id}/cancel`),

  myNotifications: () => request<{ unread: number; items: AppNotification[] }>('GET', '/notifications/me'),
  markNotificationsRead: () => request<{ updated: number }>('PATCH', '/notifications/read-all'),

  dayPlan: (date: string) => request<DayPlanItem[]>('GET', `/washes?date=${encodeURIComponent(date)}`),
  setWashStatus: (body: { subscriptionId: string; date: string; status: WashStatus; note?: string }) =>
    request<{ status: WashStatus }>('PATCH', '/washes', body),
};
