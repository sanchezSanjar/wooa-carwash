import type { Model, Types } from 'mongoose';
import { isWashDay } from './schedule';
import type { DaySheet } from './schemas/daysheet.schema';
import { SubscriptionStatus, type Subscription } from './schemas/subscription.schema';

/** "subscriptionId|scheduledDate": one wash. */
export const washKey = (subscription: Types.ObjectId | string, scheduledDate: string) =>
  `${subscription.toString()}|${scheduledDate}`;

export interface PlannedWash {
  subscription: Types.ObjectId;
  scheduledDate: string;
  washer?: Types.ObjectId;
  note: string;
}

/**
 * What gets washed on a date (shared by the API and the batch server):
 * - the saved day sheet, if an admin saved one;
 * - otherwise the schedule, minus washes an admin moved onto another day's sheet.
 */
export async function washesForDate(
  date: string,
  models: { subs: Model<Subscription>; sheets: Model<DaySheet> },
): Promise<{ saved: boolean; rows: PlannedWash[] }> {
  const sheet = await models.sheets.findOne({ date }).lean().exec();
  if (sheet) return { saved: true, rows: sheet.rows.map((r) => ({ ...r, note: r.note ?? '' })) };

  const subs = await models.subs
    .find({ status: SubscriptionStatus.Active, startDate: { $lte: date } })
    .select('schedule')
    .lean()
    .exec();
  const due = subs.filter((s) => isWashDay(s.schedule, date));
  const moved = await movedAway(date, models.sheets);
  return {
    saved: false,
    rows: due
      .filter((s) => !moved.has(washKey(s._id, date)))
      .map((s) => ({ subscription: s._id, scheduledDate: date, note: '' })),
  };
}

/** Washes scheduled on `date` that a saved sheet of another day took over. */
export async function movedAway(date: string, sheets: Model<DaySheet>): Promise<Set<string>> {
  const others = await sheets
    .find({ date: { $ne: date }, 'rows.scheduledDate': date })
    .select('rows')
    .lean()
    .exec();
  const keys = new Set<string>();
  for (const s of others) for (const r of s.rows) if (r.scheduledDate === date) keys.add(washKey(r.subscription, date));
  return keys;
}
