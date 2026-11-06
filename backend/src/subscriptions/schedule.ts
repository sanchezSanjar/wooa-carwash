import { addDays, weekday, weekdayOccurrence } from '../common/dates.js';

/**
 * A wash day: a weekday plus which of its occurrences in the month are washed.
 * e.g. { weekday: 1, weeks: [1, 3] } = 1st and 3rd Monday of every month.
 * A 5th occurrence is never washed, so every month has the same number of washes.
 */
export interface ScheduleEntry {
  weekday: number;
  weeks: number[];
}

/** Week patterns customers can choose: fortnightly (two variants) or weekly. */
export const WEEK_PATTERNS = [
  [1, 3],
  [2, 4],
  [1, 2, 3, 4],
];

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function normalizeSchedule(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries
    .map((e) => ({ weekday: e.weekday, weeks: [...new Set(e.weeks)].sort((a, b) => a - b) }))
    .sort((a, b) => a.weekday - b.weekday);
}

/** Returns an error message, or null when the schedule fits the tariff. */
export function validateSchedule(entries: ScheduleEntry[], washesPerMonth: number): string | null {
  if (entries.length === 0) return 'Choose at least one wash day';
  const seen = new Set<number>();
  for (const e of entries) {
    if (!Number.isInteger(e.weekday) || e.weekday < 0 || e.weekday > 6) return 'Invalid weekday';
    if (seen.has(e.weekday)) return 'Each weekday can only be chosen once';
    seen.add(e.weekday);
    if (!WEEK_PATTERNS.some((p) => same(p, e.weeks))) {
      return 'Weeks must be 1st & 3rd, 2nd & 4th, or every week';
    }
  }
  const total = entries.reduce((sum, e) => sum + e.weeks.length, 0);
  if (total !== washesPerMonth) {
    return `This tariff includes ${washesPerMonth} washes per month, but the chosen days give ${total}`;
  }
  return null;
}

export function isWashDay(entries: ScheduleEntry[], date: string): boolean {
  const wd = weekday(date);
  const occurrence = weekdayOccurrence(date);
  return entries.some((e) => e.weekday === wd && e.weeks.includes(occurrence));
}

/** The next `count` wash dates on or after `from` (and not before the start date). */
export function upcomingWashDates(
  entries: ScheduleEntry[],
  startDate: string,
  from: string,
  count: number,
): string[] {
  const result: string[] = [];
  let date = from > startDate ? from : startDate;
  for (let i = 0; i < 400 && result.length < count; i++) {
    if (isWashDay(entries, date)) result.push(date);
    date = addDays(date, 1);
  }
  return result;
}
