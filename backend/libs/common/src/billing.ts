import { addDays, isValidDate } from './dates';
import { isWashDay, type ScheduleEntry } from './schedule';

/** YYYY-MM of a YYYY-MM-DD date. */
export const monthOf = (date: string) => date.slice(0, 7);

export function monthBounds(month: string): { first: string; last: string } {
  const first = `${month}-01`;
  if (!isValidDate(first)) throw new Error(`Invalid month: ${month}`);
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first, last };
}

/** Washes a schedule gives in a month, counting only days on or after `from`. */
export function washesInMonth(schedule: ScheduleEntry[], month: string, from?: string): number {
  const { first, last } = monthBounds(month);
  let count = 0;
  for (let d = from && from > first ? from : first; d <= last; d = addDays(d, 1)) {
    if (isWashDay(schedule, d)) count++;
  }
  return count;
}

export interface BillableSubscription {
  tariffName: string;
  tariffPrice: number;
  washesPerMonth: number;
  extras: { name: string; price: number }[];
  schedule: ScheduleEntry[];
  startDate: string;
}

/**
 * The month's bill for a subscription. A plan that starts mid-month pays only for the washes left
 * in that month (e.g. 2 of 4 washes = half the tariff). Amounts are rounded to 10 won.
 */
export interface BillLine {
  /** English text, kept for older bills; the app builds the text in the member's language from the fields below. */
  label: string;
  amount: number;
  kind: 'plan' | 'extra';
  /** Tariff or extra service name. */
  name: string;
  /** Washes billed. */
  washes: number;
  /** Washes in a full month (plan line). */
  washesPerMonth?: number;
}

export function invoiceLines(sub: BillableSubscription, month: string): BillLine[] {
  const startMonth = monthOf(sub.startDate);
  if (month < startMonth) return [];
  const washes = month === startMonth ? washesInMonth(sub.schedule, month, sub.startDate) : sub.washesPerMonth;
  if (washes <= 0) return [];
  const share = Math.min(1, washes / sub.washesPerMonth);
  const round10 = (n: number) => Math.round(n / 10) * 10;

  const lines: BillLine[] = [
    {
      label: share < 1 ? `${sub.tariffName} plan (${washes} of ${sub.washesPerMonth} washes)` : `${sub.tariffName} plan`,
      amount: round10(sub.tariffPrice * share),
      kind: 'plan',
      name: sub.tariffName,
      washes,
      washesPerMonth: sub.washesPerMonth,
    },
  ];
  for (const e of sub.extras) {
    lines.push({ label: `${e.name} × ${washes}`, amount: round10(e.price * washes), kind: 'extra', name: e.name, washes });
  }
  return lines;
}

/** Due on the PAYMENT_DUE_DAY of the month, but never sooner than `minDays` after issuing. */
export function dueDateFor(month: string, issueDate: string, dueDay: number, minDays = 7): string {
  const { last } = monthBounds(month);
  const day = String(Math.min(Math.max(1, dueDay), 28)).padStart(2, '0');
  const regular = `${month}-${day}`;
  const earliest = addDays(issueDate, minDays);
  const due = regular > earliest ? regular : earliest;
  return due > last && earliest <= last ? last : due;
}
