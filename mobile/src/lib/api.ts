import { Platform } from 'react-native';

import type { AuthResponse, Booking, BookingStatus, Slot, User, WashService } from './types';

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

const qs = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v) as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

export const api = {
  register: (body: { name: string; email: string; password: string; phone?: string }) =>
    request<AuthResponse>('POST', '/auth/register', body),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('POST', '/auth/login', body),
  me: () => request<User>('GET', '/auth/me'),

  services: () => request<WashService[]>('GET', '/services'),
  allServices: () => request<WashService[]>('GET', '/services/admin'),
  service: (id: string) => request<WashService>('GET', `/services/${id}`),
  createService: (body: Partial<WashService>) => request<WashService>('POST', '/services', body),
  updateService: (id: string, body: Partial<WashService>) =>
    request<WashService>('PATCH', `/services/${id}`, body),

  availability: (date: string, serviceId: string) =>
    request<Slot[]>('GET', `/bookings/availability${qs({ date, serviceId })}`),
  createBooking: (body: {
    serviceId: string;
    startsAt: string;
    vehicle: { plate: string; model?: string };
    notes?: string;
  }) => request<Booking>('POST', '/bookings', body),
  myBookings: () => request<Booking[]>('GET', '/bookings/me'),
  allBookings: (query: { date?: string; status?: BookingStatus }) =>
    request<Booking[]>('GET', `/bookings${qs(query)}`),
  cancelBooking: (id: string) => request<Booking>('PATCH', `/bookings/${id}/cancel`),
  setBookingStatus: (id: string, status: BookingStatus) =>
    request<Booking>('PATCH', `/bookings/${id}/status`, { status }),
};
