import type { BookingStatus } from './types';

/** The shop runs on Korea time (UTC+9, no DST) regardless of the device's timezone. */
const SHOP_OFFSET_MS = 9 * 60 * 60_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const shop = (iso: string | Date) => new Date(new Date(iso).getTime() + SHOP_OFFSET_MS);
const pad = (n: number) => String(n).padStart(2, '0');

export function formatKRW(amount: number) {
  return `₩${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatTime(iso: string) {
  const d = shop(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatDate(iso: string) {
  const d = shop(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** YYYY-MM-DD shop dates starting today. */
export function upcomingDates(count: number, from = new Date()): string[] {
  const start = shop(from);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
    return d.toISOString().slice(0, 10);
  });
}

export function todayShopDate() {
  return upcomingDates(1)[0];
}

/** Label pieces for a YYYY-MM-DD date chip. */
export function dateChip(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return { weekday: WEEKDAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
