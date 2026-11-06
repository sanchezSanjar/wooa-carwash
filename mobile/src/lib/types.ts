export type Role = 'customer' | 'washer' | 'admin';
export type MemberStatus = 'active' | 'blocked';

export interface User {
  id: string;
  name: string;
  /** Digits only, e.g. 01012345678 */
  phone: string;
  email: string | null;
  apartmentName: string;
  role: Role;
  status: MemberStatus;
  hasPassword?: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Car {
  id: string;
  ownerId: string;
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  buildingNumber: string;
  parkingFloor: string;
  arrivesHomeAt: string;
  leavesForWorkAt: string;
}

export type CarInput = Omit<Car, 'id' | 'ownerId'>;

export interface Tariff {
  id: string;
  name: string;
  description: string;
  washesPerMonth: number;
  price: number;
  active: boolean;
  sortOrder: number;
}

export type Extra = Omit<Tariff, 'washesPerMonth'>;

export interface ScheduleDay {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** Occurrences of the weekday in the month, e.g. [1, 3] */
  weeks: number[];
}

export type WashStatus = 'planned' | 'done' | 'skipped';

export interface Subscription {
  id: string;
  carId: string;
  car: Car | null;
  tariffId: string;
  tariffName: string;
  washesPerMonth: number;
  tariffPrice: number;
  extras: { id: string; name: string; price: number }[];
  monthlyPrice: number;
  schedule: ScheduleDay[];
  startDate: string;
  status: 'active' | 'cancelled';
  upcoming: string[];
  history: { date: string; status: WashStatus; note: string }[];
}

export interface AppNotification {
  id: string;
  type: 'wash_reminder' | 'wash_done';
  title: string;
  body: string;
  date: string;
  read: boolean;
  createdAt: string | null;
}

export interface DayPlanItem {
  subscriptionId: string;
  date: string;
  status: WashStatus;
  note: string;
  tariffName: string;
  extras: string[];
  car: Car;
  member: { id: string; name: string; phone: string; email: string; apartmentName: string };
}
