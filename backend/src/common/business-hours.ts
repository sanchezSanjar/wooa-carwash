/**
 * Shop schedule. All times are local to the shop (Korea, UTC+9, no DST).
 */
export const BUSINESS = {
  utcOffsetMinutes: 9 * 60,
  openMinute: 9 * 60, // 09:00
  closeMinute: 19 * 60, // 19:00 — a wash must finish by close
  slotStepMinutes: 30,
  bookingWindowDays: 30,
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** UTC instant for local midnight of a YYYY-MM-DD shop date. */
export function localDayStart(date: string): Date {
  if (!DATE_RE.test(date)) throw new Error('Invalid date');
  const [y, m, d] = date.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) - BUSINESS.utcOffsetMinutes * 60_000;
  const result = new Date(utc);
  if (Number.isNaN(result.getTime())) throw new Error('Invalid date');
  return result;
}

/** Minutes since local midnight for an instant. */
export function localMinuteOfDay(instant: Date): number {
  const local = new Date(instant.getTime() + BUSINESS.utcOffsetMinutes * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** YYYY-MM-DD shop date for an instant. */
export function localDate(instant: Date): string {
  const local = new Date(instant.getTime() + BUSINESS.utcOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Start instants of every slot on a day that can fit a wash of `durationMinutes`. */
export function slotStartsForDay(date: string, durationMinutes: number): Date[] {
  const dayStart = localDayStart(date).getTime();
  const slots: Date[] = [];
  for (
    let minute = BUSINESS.openMinute;
    minute + durationMinutes <= BUSINESS.closeMinute;
    minute += BUSINESS.slotStepMinutes
  ) {
    slots.push(new Date(dayStart + minute * 60_000));
  }
  return slots;
}

export function isValidSlotStart(instant: Date, durationMinutes: number): boolean {
  const minute = localMinuteOfDay(instant);
  return (
    instant.getUTCSeconds() === 0 &&
    instant.getUTCMilliseconds() === 0 &&
    minute >= BUSINESS.openMinute &&
    minute + durationMinutes <= BUSINESS.closeMinute &&
    (minute - BUSINESS.openMinute) % BUSINESS.slotStepMinutes === 0
  );
}
