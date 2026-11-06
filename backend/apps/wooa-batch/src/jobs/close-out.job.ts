import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { today } from '@app/common/dates';
import { isWashDay } from '@app/common/schedule';
import { Subscription, SubscriptionStatus, Wash, WashStatus } from '@app/common/schemas/subscription.schema';
import { CLOSE_OUT_NOTE } from '../config';

/**
 * End of the day: every wash due today that nobody marked becomes "skipped" with a note,
 * so the history and the admin route show what really happened. Washes already marked are left alone.
 * Returns how many washes were closed.
 */
@Injectable()
export class CloseOutJob {
  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(Wash.name) private readonly washes: Model<Wash>,
  ) {}

  async run(now = new Date()): Promise<number> {
    const date = today(now);
    const subs = await this.subs
      .find({ status: SubscriptionStatus.Active, startDate: { $lte: date } })
      .select('car schedule')
      .exec();

    let closed = 0;
    for (const sub of subs) {
      if (!isWashDay(sub.schedule, date)) continue;
      // a record that only has photos (status planned) is closed too; done/skipped ones are left alone
      const marked = await this.washes.updateOne(
        { subscription: sub._id, date, status: WashStatus.Planned },
        { $set: { status: WashStatus.Skipped, note: CLOSE_OUT_NOTE } },
      );
      if (marked.modifiedCount) {
        closed++;
        continue;
      }
      const res = await this.washes.updateOne(
        { subscription: sub._id, date },
        { $setOnInsert: { car: sub.car, status: WashStatus.Skipped, note: CLOSE_OUT_NOTE } },
        { upsert: true },
      );
      if (res.upsertedCount) closed++;
    }
    return closed;
  }
}
