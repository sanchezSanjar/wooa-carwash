import { Platform } from 'react-native';

import type {
  AppNotification,
  AuthResponse,
  Car,
  CarInput,
  DayPlanItem,
  SheetImportPreview,
  Invoice,
  InvoiceMonth,
  InvoiceStatus,
  PaymentMethod,
  DaySheet,
  SheetCandidate,
  StaffMember,
  PhotoKind,
  ReviewItem,
  Role,
  Extra,
  ScheduleDay,
  Subscription,
  Tariff,
  User,
  WashDetail,
  WashPhoto,
  WashReview,
  WashStatus,
} from './types';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Full URL for a file the API serves, e.g. /uploads/... */
export const fileUrl = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`);

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
let language = 'ko';
let onUnauthorized: (() => void) | null = null;

export const getAuthToken = () => authToken;

/** Headers every API call sends: login token and the app language (errors and Excel files follow it). */
export const apiHeaders = (): Record<string, string> => ({
  'Accept-Language': language,
  ...(authToken && { Authorization: `Bearer ${authToken}` }),
});

export const currentLang = () => (language === 'en' ? 'en' : 'ko') as 'ko' | 'en';

export function setApiLanguage(lang: string) {
  language = lang;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
        ...apiHeaders(),
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(language === 'ko' ? '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.' : 'Cannot reach the server. Check your connection and try again.', 0);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    const raw = (data as { message?: string | string[] } | undefined)?.message;
    const message = Array.isArray(raw) ? raw[0] : raw;
    throw new ApiError(message ? capitalize(message) : language === 'ko' ? `요청을 처리하지 못했습니다 (${res.status})` : `Request failed (${res.status})`, res.status);
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
    request<{ verified: true; signupToken?: string; resetToken?: string }>('POST', '/auth/otp/verify', { phone, purpose, code }),
  register: (body: { name: string; phone: string; password: string; apartmentName: string; email?: string; signupToken: string }) =>
    request<AuthResponse>('POST', '/auth/register', body),
  login: (body: { phone: string; password: string }) => request<AuthResponse>('POST', '/auth/login', body),
  resetPassword: (resetToken: string, newPassword: string) =>
    request<{ message: string }>('POST', '/auth/reset-password', { resetToken, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('POST', '/members/me/password', { currentPassword, newPassword }),

  members: (search?: string) =>
    request<User[]>('GET', `/members${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  member: (id: string) => request<User>('GET', `/members/${id}`),
  createMember: (body: { name: string; phone: string; apartmentName: string; role: Role; email?: string; language?: 'ko' | 'en' }) =>
    request<User>('POST', '/members', body),
  updateMember: (id: string, body: Partial<Pick<User, 'name' | 'phone' | 'apartmentName' | 'role' | 'status'>> & { email?: string }) =>
    request<User>('PATCH', `/members/${id}`, body),
  carsForMember: (ownerId: string) => request<Car[]>('GET', `/cars?ownerId=${ownerId}`),
  me: () => request<User>('GET', '/auth/me'),
  updateProfile: (body: { name?: string; apartmentName?: string; email?: string; language?: 'ko' | 'en' }) =>
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

  washDetail: (subscriptionId: string, date: string) =>
    request<WashDetail>('GET', `/washes/detail?subscriptionId=${subscriptionId}&date=${date}`),
  uploadPhoto: async (p: { subscriptionId: string; date: string; kind: PhotoKind; note?: string; uri: string; mimeType?: string }) => {
    const form = new FormData();
    form.append('subscriptionId', p.subscriptionId);
    form.append('date', p.date);
    form.append('kind', p.kind);
    if (p.note) form.append('note', p.note);
    if (Platform.OS === 'web') {
      form.append('file', await (await fetch(p.uri)).blob(), 'photo.jpg');
    } else {
      // React Native's FormData takes a file descriptor object
      form.append('file', { uri: p.uri, name: 'photo.jpg', type: p.mimeType ?? 'image/jpeg' } as unknown as Blob);
    }
    return request<WashPhoto>('POST', '/washes/photos', form);
  },
  deletePhoto: (id: string) => request<void>('DELETE', `/washes/photos/${id}`),
  reviewWash: (body: { subscriptionId: string; date: string; rating: number; comment?: string }) =>
    request<WashReview>('PUT', '/washes/review', body),
  reviews: () => request<ReviewItem[]>('GET', '/washes/reviews'),
  changeTariff: (id: string, body: { tariffId: string; schedule: ScheduleDay[] }) =>
    request<Subscription>('PATCH', `/subscriptions/${id}/tariff`, body),

  daySheet: (date: string) => request<DaySheet>('GET', `/daysheets/${date}`),
  saveDaySheet: (date: string, rows: { subscriptionId: string; scheduledDate: string; washerId?: string; note?: string }[]) =>
    request<DaySheet>('PUT', `/daysheets/${date}`, { rows }),
  moveWash: (date: string, body: { subscriptionId: string; scheduledDate: string; toDate: string }) =>
    request<{ from: DaySheet; to: DaySheet }>('POST', `/daysheets/${date}/move`, body),
  sheetCandidates: (date: string) => request<SheetCandidate[]>('GET', `/daysheets/${date}/candidates`),
  sheetStaff: () => request<StaffMember[]>('GET', '/daysheets/staff'),

  myInvoices: () => request<{ bankAccount: string | null; invoices: Invoice[] }>('GET', '/invoices/me'),
  invoices: (month: string, status?: InvoiceStatus) =>
    request<InvoiceMonth>('GET', `/invoices?month=${month}${status ? `&status=${status}` : ''}`),
  overdueInvoices: () => request<Invoice[]>('GET', '/invoices/overdue'),
  setInvoiceStatus: (id: string, body: { status: InvoiceStatus; method?: PaymentMethod; note?: string }) =>
    request<Invoice>('PATCH', `/invoices/${id}`, body),

  previewSheetImport: async (file: { uri: string; name: string; mimeType?: string; file?: Blob }) => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      form.append('file', file.file ?? (await (await fetch(file.uri)).blob()), file.name);
    } else {
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? XLSX_TYPE } as unknown as Blob);
    }
    return request<SheetImportPreview>('POST', '/daysheets/import/preview', form);
  },
  applySheetImport: (plan: SheetImportPreview['plan']) =>
    request<{ saved: string[] }>('POST', '/daysheets/import/apply', { plan }),

  dayPlan: (date: string) => request<DayPlanItem[]>('GET', `/washes?date=${encodeURIComponent(date)}`),
  setWashStatus: (body: { subscriptionId: string; date: string; status: WashStatus; note?: string; washedOn?: string }) =>
    request<{ status: WashStatus }>('PATCH', '/washes', body),
};
