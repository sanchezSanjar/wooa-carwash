import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addDays, today } from '@app/common/dates';
import { NotificationText } from '@app/common/notify';
import { isWashDay } from '@app/common/schedule';
import { CarDocument } from '@app/common/schemas/car.schema';
import { Notification, NotificationType } from '@app/common/schemas/notification.schema';
import { Subscription, SubscriptionStatus } from '@app/common/schemas/subscription.schema';

/**
 * Evening before a wash: tell every member whose car is washed tomorrow.
 * Safe to run twice: the notifications collection allows one reminder per wash.
 * Returns how many reminders were created.
 */
@Injectable()
export class WashReminderJob {
  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
  ) {}

  async run(now = new Date()): Promise<number> {
    const tomorrow = addDays(today(now), 1);
    const subs = await this.subs
      .find({ status: SubscriptionStatus.Active, startDate: { $lte: tomorrow } })
      .populate('car')
      .exec();

    let created = 0;
    for (const sub of subs) {
      const car = sub.car as unknown as CarDocument | null;
      if (!car || !isWashDay(sub.schedule, tomorrow)) continue;
      const text = NotificationText.reminder(car, tomorrow, sub.extras.map((e) => e.name));
      const res = await this.notifications.updateOne(
        { subscription: sub._id, date: tomorrow, type: NotificationType.WashReminder },
        { $setOnInsert: { member: sub.member, ...text, read: false } },
        { upsert: true },
      );
      if (res.upsertedCount) created++;
    }
    return created;
  }
}
