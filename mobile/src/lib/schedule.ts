import type { ScheduleDay } from './types';

/** Mirrors the server rules so the plan screen can preview wash dates instantly. */
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const addDays = (date: string, n: number) =>
  new Date(utc(date).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export function isWashDay(schedule: ScheduleDay[], date: string) {
  const d = utc(date);
  const occurrence = Math.ceil(d.getUTCDate() / 7);
  return schedule.some((e) => e.weekday === d.getUTCDay() && e.weeks.includes(occurrence));
}

export function previewWashDates(schedule: ScheduleDay[], startDate: string, count: number) {
  const out: string[] = [];
  let date = startDate;
  for (let i = 0; i < 400 && out.length < count && schedule.length > 0; i++) {
    if (isWashDay(schedule, date)) out.push(date);
    date = addDays(date, 1);
  }
  return out;
}

/**
 * Day picks for each tariff, turned into the schedule the API expects.
 * - 2 / month: one weekday, 1st & 3rd or 2nd & 4th occurrence
 * - 4 / month: one weekday, every week
 * - 6 / month: two weekdays in weeks 1 & 3, one weekday in weeks 2 & 4
 */
export interface DayPicks {
  /** Weekdays washed in weeks 1 & 3 (2×: one day; 6×: two days). */
  oddWeeks: number[];
  /** Weekdays washed in weeks 2 & 4 (2× alternative; 6×: one day). */
  evenWeeks: number[];
  /** Weekday washed every week (4×). */
  everyWeek: number[];
}

export const emptyPicks = (): DayPicks => ({ oddWeeks: [], evenWeeks: [], everyWeek: [] });

export function picksToSchedule(p: DayPicks): ScheduleDay[] {
  return [
    ...p.oddWeeks.map((weekday) => ({ weekday, weeks: [1, 3] })),
    ...p.evenWeeks.map((weekday) => ({ weekday, weeks: [2, 4] })),
    ...p.everyWeek.map((weekday) => ({ weekday, weeks: [1, 2, 3, 4] })),
  ];
}

export function scheduleToPicks(schedule: ScheduleDay[]): DayPicks {
  const p = emptyPicks();
  for (const d of schedule) {
    const w = d.weeks.join(',');
    if (w === '1,3') p.oddWeeks.push(d.weekday);
    else if (w === '2,4') p.evenWeeks.push(d.weekday);
    else p.everyWeek.push(d.weekday);
  }
  return p;
}

/** null when the picks are complete for the tariff, otherwise what is still missing. */
export function picksProblem(p: DayPicks, washesPerMonth: number): string | null {
  const total = p.oddWeeks.length * 2 + p.evenWeeks.length * 2 + p.everyWeek.length * 4;
  if (washesPerMonth === 6 && (p.oddWeeks.length !== 2 || p.evenWeeks.length !== 1)) {
    return 'Choose 2 days for weeks 1 & 3 and 1 day for weeks 2 & 4';
  }
  if (total !== washesPerMonth) return 'Choose your wash day';
  const all = [...p.oddWeeks, ...p.evenWeeks, ...p.everyWeek];
  if (new Set(all).size !== all.length) return 'Each weekday can only be used once';
  return null;
}
