import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { today } from '@app/common/dates';
import { washesForDate } from '@app/common/planner';
import { DaySheet } from '@app/common/schemas/daysheet.schema';
import { Subscription, Wash, WashStatus } from '@app/common/schemas/subscription.schema';
import { CLOSE_OUT_NOTE } from '../config';

/**
 * End of the day: every wash on today's sheet (or schedule) that nobody marked becomes "skipped"
 * with a note. Washes moved to another day are left alone; marked ones are never changed.
 * Returns how many washes were closed.
 */
@Injectable()
export class CloseOutJob {
  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(DaySheet.name) private readonly sheets: Model<DaySheet>,
    @InjectModel(Wash.name) private readonly washes: Model<Wash>,
  ) {}

  async run(now = new Date()): Promise<number> {
    const date = today(now);
    const { rows } = await washesForDate(date, { subs: this.subs, sheets: this.sheets });
    const cars = new Map(
      (await this.subs.find({ _id: { $in: rows.map((r) => r.subscription) } }).select('car').lean().exec()).map((s) => [
        s._id.toString(),
        s.car,
      ]),
    );

    let closed = 0;
    for (const row of rows) {
      const ref = { subscription: row.subscription, date: row.scheduledDate };
      const extra = row.scheduledDate !== date ? { washedOn: date } : {};
      // a record that only has photos (status planned) is closed too; done/skipped ones are left alone
      const marked = await this.washes.updateOne(
        { ...ref, status: WashStatus.Planned },
        { $set: { status: WashStatus.Skipped, note: CLOSE_OUT_NOTE, ...extra } },
      );
      if (marked.modifiedCount) {
        closed++;
        continue;
      }
      const res = await this.washes.updateOne(
        ref,
        { $setOnInsert: { car: cars.get(row.subscription.toString()), status: WashStatus.Skipped, note: CLOSE_OUT_NOTE, ...extra } },
        { upsert: true },
      );
      if (res.upsertedCount) closed++;
    }
    return closed;
  }
}
