export type Role = 'customer' | 'washer' | 'admin';
export type MemberStatus = 'active' | 'blocked';

/** A bill line. Newer bills carry the parts so the app can word them in either language. */
export interface InvoiceLine {
  label: string;
  amount: number;
  kind?: 'plan' | 'extra' | null;
  name?: string | null;
  washes?: number | null;
  washesPerMonth?: number | null;
}

export interface User {
  id: string;
  name: string;
  /** Digits only, e.g. 01012345678 */
  phone: string;
  email: string | null;
  apartmentName: string;
  role: Role;
  status: MemberStatus;
  /** Language of the member's notifications and SMS. */
  language?: 'ko' | 'en';
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
  history: { date: string; status: WashStatus; note: string; photos: number; rating: number | null }[];
}

export interface AppNotification {
  id: string;
  type: 'wash_reminder' | 'wash_done' | 'invoice_issued' | 'payment_due' | 'payment_overdue' | 'weather_alert';
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
  photos: number;
  rating: number | null;
  tariffName: string;
  extras: string[];
  car: Car;
  member: { id: string; name: string; phone: string; email: string; apartmentName: string };
}

export type PhotoKind = 'before' | 'after';

export interface WashPhoto {
  id: string;
  kind: PhotoKind;
  /** Relative to the API, e.g. /uploads/washes/... */
  url: string;
  note: string;
  createdAt: string | null;
}

export interface WashReview {
  rating: number;
  comment: string;
  createdAt: string | null;
}

export interface WashDetail {
  subscriptionId: string;
  date: string;
  status: WashStatus;
  note: string;
  washedOn: string | null;
  tariffName: string;
  extras: string[];
  car: Car | null;
  photos: WashPhoto[];
  review: WashReview | null;
  canReview: boolean;
}

export interface ReviewItem {
  subscriptionId: string;
  date: string;
  plateNumber: string;
  memberName: string;
  apartmentName: string;
  review: WashReview | null;
}

export interface DaySheetRow {
  subscriptionId: string;
  /** The wash's date in the car's schedule; differs from the sheet date when moved. */
  scheduledDate: string;
  moved: boolean;
  washerId: string | null;
  washerName: string | null;
  note: string;
  status: WashStatus;
  washedOn: string | null;
  photos: number;
  rating: number | null;
  tariffName: string;
  extras: string[];
  car: Car;
  member: { id: string; name: string; phone: string; apartmentName: string };
}

export interface DaySheet {
  date: string;
  saved: boolean;
  /** Forecast from the batch server (KMA), when available. */
  weather: {
    summary: string;
    pop: number;
    precipitation?: string;
    tempMin?: number | null;
    tempMax?: number | null;
    wet: boolean;
  } | null;
  updatedAt: string | null;
  rows: DaySheetRow[];
}

export interface SheetCandidate extends DaySheetRow {
  reason: 'missed' | 'skipped' | 'today' | 'upcoming';
}

export interface StaffMember {
  id: string;
  name: string;
  role: Role;
}

export type InvoiceStatus = 'unpaid' | 'paid' | 'void';
export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'other';

export interface Invoice {
  id: string;
  subscriptionId: string;
  plateNumber: string;
  /** YYYY-MM */
  month: string;
  lines: InvoiceLine[];
  amount: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  overdue: boolean;
  paidAt: string | null;
  method: PaymentMethod | null;
  note: string;
  member?: { id: string; name: string; phone: string; apartmentName: string };
}

export interface InvoiceMonth {
  month: string;
  totals: { billed: number; paid: number; unpaid: number; count: number; unpaidCount: number };
  invoices: Invoice[];
}

export interface SheetImportPreview {
  filename: string | null;
  rowsRead: number;
  days: string[];
  unchanged: number;
  changes: { type: 'order' | 'washer' | 'note' | 'moved' | 'removed' | 'added'; plateNumber: string; date: string; detail: string }[];
  problems: { sheet: string; row: number; plateNumber: string; message: string }[];
  plan: { date: string; rows: { subscriptionId: string; scheduledDate: string; washerId?: string; note?: string }[] }[];
}
