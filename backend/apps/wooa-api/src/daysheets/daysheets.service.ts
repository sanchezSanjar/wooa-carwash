import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { addDays, isValidDate } from '@app/common/dates';
import { MemberStatus, Role } from '@app/common/enums';
import { PlannedWash, washesForDate, washKey } from '@app/common/planner';
import { isWashDay } from '@app/common/schedule';
import { CarDocument } from '@app/common/schemas/car.schema';
import { DaySheet } from '@app/common/schemas/daysheet.schema';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
  Wash,
  WashStatus,
} from '@app/common/schemas/subscription.schema';
import { User, UserDocument } from '@app/common/schemas/user.schema';
import { CarsService } from '../cars/cars.service';
import { AuthUser } from '../auth/roles';
import { DaySheetRowDto } from './dto/daysheet.dto';

const LOOK_BACK_DAYS = 14; // unfinished washes that can be made up
const LOOK_AHEAD_DAYS = 7; // upcoming washes that can be pulled forward

const num = (v: string) => Number.parseInt(v, 10) || 0;

@Injectable()
export class DaySheetsService {
  constructor(
    @InjectModel(DaySheet.name) private readonly sheets: Model<DaySheet>,
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(Wash.name) private readonly washes: Model<Wash>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  /** The day's sheet: saved workbook, or a draft from the schedule (sorted for walking the route). */
  async get(date: string) {
    this.assertDate(date);
    const { saved, rows } = await washesForDate(date, { subs: this.subs, sheets: this.sheets });
    const sheet = saved ? await this.sheets.findOne({ date }).select('updatedAt').lean().exec() : null;
    const hydrated = await this.hydrate(rows, date);
    if (!saved) hydrated.sort(routeOrder);
    return {
      date,
      saved,
      updatedAt: (sheet as { updatedAt?: Date } | null)?.updatedAt?.toISOString() ?? null,
      rows: hydrated,
    };
  }

  /**
   * Saves the workbook for a day. A wash taken from another day's saved sheet is removed there,
   * so every wash is on exactly one sheet.
   */
  async save(admin: AuthUser, date: string, input: DaySheetRowDto[]) {
    this.assertDate(date);
    const rows = await this.validateRows(input);
    const keys = new Set(rows.map((r) => washKey(r.subscription, r.scheduledDate)));

    const others = await this.sheets.find({ date: { $ne: date }, 'rows.subscription': { $in: rows.map((r) => r.subscription) } }).exec();
    for (const other of others) {
      const kept = other.rows.filter((r) => !keys.has(washKey(r.subscription, r.scheduledDate)));
      if (kept.length !== other.rows.length) {
        other.rows = kept;
        other.updatedBy = new Types.ObjectId(admin.userId);
        await other.save();
      }
    }
    await this.sheets.updateOne(
      { date },
      { $set: { rows, updatedBy: new Types.ObjectId(admin.userId) } },
      { upsert: true },
    );
    return this.get(date);
  }

  /** Moves one wash from a day to another day's sheet (both sheets are saved). */
  async move(admin: AuthUser, fromDate: string, subscriptionId: string, scheduledDate: string, toDate: string) {
    this.assertDate(fromDate);
    this.assertDate(toDate);
    if (fromDate === toDate) throw new BadRequestException('Choose another day');
    const key = washKey(subscriptionId, scheduledDate);

    const from = await washesForDate(fromDate, { subs: this.subs, sheets: this.sheets });
    const row = from.rows.find((r) => washKey(r.subscription, r.scheduledDate) === key);
    if (!row) throw new BadRequestException('This car is not on that day');
    const to = await washesForDate(toDate, { subs: this.subs, sheets: this.sheets });

    const toRows = to.rows.some((r) => washKey(r.subscription, r.scheduledDate) === key) ? to.rows : [...to.rows, row];
    await this.save(admin, toDate, toRows.map(toDto)); // also removes it from a saved fromDate sheet
    const fromRows = from.rows.filter((r) => washKey(r.subscription, r.scheduledDate) !== key);
    await this.save(admin, fromDate, fromRows.map(toDto));
    return { from: await this.get(fromDate), to: await this.get(toDate) };
  }

  /**
   * Cars an admin can add to a day: washes not done from the last 14 days,
   * scheduled washes of the next 7 days, and this day's own washes missing from the sheet.
   */
  async candidates(date: string) {
    this.assertDate(date);
    const current = await washesForDate(date, { subs: this.subs, sheets: this.sheets });
    const onSheet = new Set(current.rows.map((r) => washKey(r.subscription, r.scheduledDate)));

    const from = addDays(date, -LOOK_BACK_DAYS);
    const to = addDays(date, LOOK_AHEAD_DAYS);
    const subs = await this.subs.find({ status: SubscriptionStatus.Active, startDate: { $lte: to } }).select('schedule startDate').lean().exec();

    const pairs: PlannedWash[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      for (const s of subs) {
        if (d >= s.startDate && isWashDay(s.schedule, d) && !onSheet.has(washKey(s._id, d))) {
          pairs.push({ subscription: s._id, scheduledDate: d, note: '' });
        }
      }
    }
    const done = await this.washes
      .find({ subscription: { $in: [...new Set(pairs.map((p) => p.subscription))] }, date: { $gte: from, $lte: to }, status: WashStatus.Done })
      .select('subscription date')
      .lean()
      .exec();
    const doneKeys = new Set(done.map((w) => washKey(w.subscription, w.date)));
    const open = pairs.filter((p) => !doneKeys.has(washKey(p.subscription, p.scheduledDate)));

    const hydrated = await this.hydrate(open, date);
    return hydrated
      .map((r) => ({
        ...r,
        reason: r.scheduledDate < date ? (r.status === 'skipped' ? 'skipped' : 'missed') : r.scheduledDate === date ? 'today' : 'upcoming',
      }))
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || routeOrder(a, b));
  }

  /** Staff who can be assigned on a sheet. */
  async staff() {
    const users = await this.users
      .find({ role: { $in: [Role.Washer, Role.Admin] }, status: MemberStatus.Active })
      .sort({ role: -1, name: 1 })
      .select('name role')
      .exec();
    return users.map((u) => ({ id: u.id as string, name: u.name, role: u.role }));
  }

  private async validateRows(input: DaySheetRowDto[]): Promise<PlannedWash[]> {
    const ids = [...new Set(input.map((r) => r.subscriptionId))];
    const subs = await this.subs.find({ _id: { $in: ids } }).exec();
    const byId = new Map(subs.map((s) => [s.id as string, s]));
    const washerIds = [...new Set(input.map((r) => r.washerId).filter(Boolean) as string[])];
    const washers = washerIds.length
      ? await this.users.find({ _id: { $in: washerIds }, role: { $in: [Role.Washer, Role.Admin] } }).select('_id').lean().exec()
      : [];
    const okWashers = new Set(washers.map((w) => w._id.toString()));

    const seen = new Set<string>();
    return input.map((r) => {
      const sub = byId.get(r.subscriptionId);
      if (!sub || sub.status !== SubscriptionStatus.Active) throw new BadRequestException('A car on the sheet has no active plan');
      if (!isValidDate(r.scheduledDate) || r.scheduledDate < sub.startDate || !isWashDay(sub.schedule, r.scheduledDate)) {
        throw new BadRequestException(`A car is not scheduled on ${r.scheduledDate}`);
      }
      const key = washKey(sub._id, r.scheduledDate);
      if (seen.has(key)) throw new BadRequestException('The same wash is on the sheet twice');
      seen.add(key);
      if (r.washerId && !okWashers.has(r.washerId)) throw new BadRequestException('Assigned washer not found');
      return {
        subscription: sub._id,
        scheduledDate: r.scheduledDate,
        washer: r.washerId ? new Types.ObjectId(r.washerId) : undefined,
        note: r.note?.trim() ?? '',
      };
    });
  }

  /** Adds car, member, washer and wash status to planned rows. */
  private async hydrate(rows: PlannedWash[], sheetDate: string) {
    if (rows.length === 0) return [];
    const subIds = [...new Set(rows.map((r) => r.subscription.toString()))];
    const [subs, washes, washers] = await Promise.all([
      this.subs.find({ _id: { $in: subIds } }).populate('car').populate('member', 'name phone apartmentName').exec(),
      this.washes.find({ subscription: { $in: subIds }, date: { $in: [...new Set(rows.map((r) => r.scheduledDate))] } }).exec(),
      this.users.find({ _id: { $in: rows.map((r) => r.washer).filter(Boolean) } }).select('name').exec(),
    ]);
    const subById = new Map(subs.map((s) => [s.id as string, s]));
    const washByKey = new Map(washes.map((w) => [washKey(w.subscription, w.date), w]));
    const washerName = new Map(washers.map((u) => [u.id as string, u.name]));

    return rows.flatMap((r) => {
      const sub = subById.get(r.subscription.toString()) as (SubscriptionDocument & { member: UserDocument | null }) | undefined;
      const car = sub?.car as unknown as CarDocument | null;
      if (!sub || !car) return [];
      const wash = washByKey.get(washKey(r.subscription, r.scheduledDate));
      return [
        {
          subscriptionId: sub.id as string,
          scheduledDate: r.scheduledDate,
          moved: r.scheduledDate !== sheetDate,
          washerId: r.washer?.toString() ?? null,
          washerName: r.washer ? (washerName.get(r.washer.toString()) ?? null) : null,
          note: r.note ?? '',
          status: wash?.status ?? WashStatus.Planned,
          washedOn: wash?.washedOn ?? null,
          photos: wash?.photos.length ?? 0,
          rating: wash?.review?.rating ?? null,
          tariffName: sub.tariffName,
          extras: sub.extras.map((e) => e.name),
          car: CarsService.toPublic(car),
          member: {
            id: sub.member?.id ?? '',
            name: sub.member?.name ?? 'Unknown',
            phone: sub.member?.phone ?? '',
            apartmentName: sub.member?.apartmentName ?? '',
          },
        },
      ];
    });
  }

  private assertDate(date: string) {
    if (!isValidDate(date)) throw new BadRequestException('Invalid date');
  }
}

type RouteRow = { member: { apartmentName: string }; car: { buildingNumber: string; parkingFloor: string; arrivesHomeAt: string } };
const routeOrder = (a: RouteRow, b: RouteRow) =>
  a.member.apartmentName.localeCompare(b.member.apartmentName) ||
  num(a.car.buildingNumber) - num(b.car.buildingNumber) ||
  a.car.buildingNumber.localeCompare(b.car.buildingNumber) ||
  a.car.parkingFloor.localeCompare(b.car.parkingFloor) ||
  a.car.arrivesHomeAt.localeCompare(b.car.arrivesHomeAt);

const toDto = (r: PlannedWash): DaySheetRowDto => ({
  subscriptionId: r.subscription.toString(),
  scheduledDate: r.scheduledDate,
  washerId: r.washer?.toString(),
  note: r.note,
});
