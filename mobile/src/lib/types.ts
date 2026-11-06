export type Role = 'customer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface WashService {
  id: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  active: boolean;
  sortOrder: number;
}

export interface Slot {
  startsAt: string;
  available: boolean;
  remaining: number;
}

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  userId: string;
  customer?: { name: string; email: string; phone?: string };
  serviceId: string;
  serviceName: string;
  price: number;
  startsAt: string;
  endsAt: string;
  date: string;
  vehicle: { plate: string; model?: string };
  notes: string;
  status: BookingStatus;
}
