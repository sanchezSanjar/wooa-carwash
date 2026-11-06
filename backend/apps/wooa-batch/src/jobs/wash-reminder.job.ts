import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addDays, today } from '@app/common/dates';
import { NotificationText } from '@app/common/notify';
import { washesForDate } from '@app/common/planner';
import { CarDocument } from '@app/common/schemas/car.schema';
import { DaySheet } from '@app/common/schemas/daysheet.schema';
import { Notification, NotificationType } from '@app/common/schemas/notification.schema';
import { Subscription, SubscriptionStatus } from '@app/common/schemas/subscription.schema';

/**
 * Evening before a wash: tell every member whose car is washed tomorrow
 * (tomorrow's day sheet if an admin saved one, otherwise the schedule).
 * Safe to run twice: one reminder per wash. Returns how many reminders were created.
 */
@Injectable()
export class WashReminderJob {
  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(DaySheet.name) private readonly sheets: Model<DaySheet>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
  ) {}

  async run(now = new Date()): Promise<number> {
    const tomorrow = addDays(today(now), 1);
    const { rows } = await washesForDate(tomorrow, { subs: this.subs, sheets: this.sheets });
    if (rows.length === 0) return 0;

    const subs = await this.subs
      .find({ _id: { $in: rows.map((r) => r.subscription) }, status: SubscriptionStatus.Active })
      .populate('car')
      .exec();
    const byId = new Map(subs.map((s) => [s.id as string, s]));

    let created = 0;
    for (const row of rows) {
      const sub = byId.get(row.subscription.toString());
      const car = sub?.car as unknown as CarDocument | null;
      if (!sub || !car) continue;
      const text = NotificationText.reminder(car, tomorrow, sub.extras.map((e) => e.name));
      const res = await this.notifications.updateOne(
        { subscription: sub._id, date: row.scheduledDate, type: NotificationType.WashReminder },
        { $setOnInsert: { member: sub.member, ...text, read: false } },
        { upsert: true },
      );
      if (res.upsertedCount) created++;
    }
    return created;
  }
}
