import type { ScheduleDay } from './types';

/** The shop runs on Korea time (UTC+9, no DST) regardless of the device's timezone. */
const SHOP_OFFSET_MS = 9 * 60 * 60_000;
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "010-1234-5678" from any Korean mobile format. */
export function formatPhone(phone: string) {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('82')) d = `0${d.slice(2)}`;
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d;
}

export const isMobile = (phone: string) => /^01[016789]\d{7,8}$/.test(formatPhone(phone).replace(/\D/g, ''));

export function formatKRW(amount: number) {
  return `₩${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Mon, Nov 16" for a YYYY-MM-DD date. */
export function formatDay(date: string) {
  const d = utc(date);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** YYYY-MM-DD shop dates starting today. */
export function upcomingDates(count: number, from = new Date()): string[] {
  const start = new Date(from.getTime() + SHOP_OFFSET_MS);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i))
      .toISOString()
      .slice(0, 10),
  );
}

export function todayShopDate() {
  return upcomingDates(1)[0];
}

export function dateChip(date: string) {
  const d = utc(date);
  return { weekday: WEEKDAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];

/** "Mon & Fri (weeks 1 & 3) · Wed (weeks 2 & 4)" */
export function scheduleSummary(schedule: ScheduleDay[]) {
  const groups = new Map<string, number[]>();
  for (const d of schedule) {
    const key = d.weeks.join(',');
    groups.set(key, [...(groups.get(key) ?? []), d.weekday]);
  }
  return [...groups.entries()]
    .map(([weeks, days]) => {
      const names = days.map((d) => WEEKDAYS[d]).join(' & ');
      const w = weeks.split(',').map(Number);
      return w.length === 4 ? `Every ${names}` : `${w.map((n) => ORDINAL[n]).join(' & ')} ${names}`;
    })
    .join(' · ');
}

export const STATUS_LABEL = { planned: 'Planned', done: 'Washed', skipped: 'Skipped' } as const;
