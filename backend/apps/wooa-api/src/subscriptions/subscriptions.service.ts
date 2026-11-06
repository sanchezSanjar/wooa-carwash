import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Car, CarDocument } from '@app/common/schemas/car.schema';
import { CarsService, PublicCar } from '../cars/cars.service';
import { CatalogService } from '../catalog/catalog.service';
import { ExtraDocument } from '@app/common/schemas/catalog.schema';
import { isValidDate, today } from '@app/common/dates';
import { AuthUser, Role } from '../auth/roles';
import { User, UserDocument } from '@app/common/schemas/user.schema';
import { NotificationText } from '@app/common/notify';
import { Notification, NotificationType } from '@app/common/schemas/notification.schema';
import {
  ChangeTariffDto,
  CreateSubscriptionDto,
  SetWashStatusDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';
import { isWashDay, normalizeSchedule, upcomingWashDates, validateSchedule } from '@app/common/schedule';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionStatus,
  Wash,
  WashDocument,
  WashStatus,
} from '@app/common/schemas/subscription.schema';

const UPCOMING_COUNT = 6;
const MAX_START_DAYS_AHEAD = 90;

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(Wash.name) private readonly washes: Model<Wash>,
    @InjectModel(Car.name) private readonly carModel: Model<Car>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly cars: CarsService,
    private readonly catalog: CatalogService,
  ) {}

  async create(user: AuthUser, dto: CreateSubscriptionDto, now = new Date()) {
    const car = await this.cars.findAccessible(user, dto.carId);
    const tariff = await this.catalog.getTariff(dto.tariffId);
    if (!tariff.active) throw new BadRequestException('This tariff is not available');

    const startDate = dto.startDate;
    if (!isValidDate(startDate)) throw new BadRequestException('startDate is not a valid date');
    const todayStr = today(now);
    if (startDate < todayStr) throw new BadRequestException('startDate cannot be in the past');
    const maxStart = new Date(now.getTime() + MAX_START_DAYS_AHEAD * 86_400_000);
    if (startDate > today(maxStart)) {
      throw new BadRequestException(`startDate must be within ${MAX_START_DAYS_AHEAD} days`);
    }

    const schedule = this.checkedSchedule(dto.schedule, tariff.washesPerMonth);
    const extras = await this.catalog.getActiveExtras(dto.extraIds ?? []);

    if (await this.hasActiveForCar(car.id)) {
      throw new ConflictException('This car already has an active subscription');
    }
    try {
      const sub = await this.subs.create({
        member: car.owner,
        car: car._id,
        tariff: tariff._id,
        tariffName: tariff.name,
        washesPerMonth: tariff.washesPerMonth,
        tariffPrice: tariff.price,
        extras: SubscriptionsService.snapshotExtras(extras),
        schedule,
        startDate,
      });
      return this.toPublic(sub, { car, now });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('This car already has an active subscription');
      throw err;
    }
  }

  async listMine(user: AuthUser, now = new Date()) {
    const subs = await this.subs
      .find({ member: new Types.ObjectId(user.userId) })
      .sort({ status: 1, createdAt: -1 })
      .populate('car')
      .exec();
    const history = await this.washes
      .find({ subscription: { $in: subs.map((s) => s._id) }, status: { $ne: WashStatus.Planned } })
      .sort({ date: -1 })
      .limit(50)
      .exec();
    return subs.map((s) =>
      this.toPublic(s, {
        car: s.car as unknown as CarDocument,
        now,
        history: history.filter((w) => w.subscription.equals(s._id)).slice(0, 10),
      }),
    );
  }

  async listAll(now = new Date()) {
    const subs = await this.subs
      .find({ status: SubscriptionStatus.Active })
      .sort({ startDate: 1 })
      .populate('car')
      .populate('member', 'name email phone apartmentName')
      .exec();
    return subs.map((s) => ({
      ...this.toPublic(s, { car: s.car as unknown as CarDocument, now }),
      member: SubscriptionsService.memberInfo(s.member as unknown as UserDocument),
    }));
  }

  async update(user: AuthUser, id: string, dto: UpdateSubscriptionDto, now = new Date()) {
    const sub = await this.findAccessible(user, id);
    if (sub.status !== SubscriptionStatus.Active) {
      throw new BadRequestException('Only active subscriptions can be changed');
    }
    if (dto.schedule) sub.schedule = this.checkedSchedule(dto.schedule, sub.washesPerMonth);
    if (dto.extraIds) {
      sub.extras = SubscriptionsService.snapshotExtras(await this.catalog.getActiveExtras(dto.extraIds));
    }
    await sub.save();
    const car = await this.carModel.findById(sub.car).exec();
    return this.toPublic(sub, { car: car ?? undefined, now });
  }

  /** Switch to another tariff (members for their own cars, admins for any). New price applies from now on. */
  async changeTariff(user: AuthUser, id: string, dto: ChangeTariffDto, now = new Date()) {
    const sub = await this.findAccessible(user, id);
    if (sub.status !== SubscriptionStatus.Active) {
      throw new BadRequestException('Only active subscriptions can be changed');
    }
    const tariff = await this.catalog.getTariff(dto.tariffId);
    if (!tariff.active && user.role !== Role.Admin) throw new BadRequestException('This tariff is not available');
    sub.schedule = this.checkedSchedule(dto.schedule, tariff.washesPerMonth);
    sub.tariff = tariff._id;
    sub.tariffName = tariff.name;
    sub.washesPerMonth = tariff.washesPerMonth;
    sub.tariffPrice = tariff.price;
    await sub.save();
    const car = await this.carModel.findById(sub.car).exec();
    return this.toPublic(sub, { car: car ?? undefined, now });
  }

  async cancel(user: AuthUser, id: string, now = new Date()) {
    const sub = await this.findAccessible(user, id);
    if (sub.status === SubscriptionStatus.Cancelled) {
      throw new BadRequestException('This subscription is already cancelled');
    }
    sub.status = SubscriptionStatus.Cancelled;
    sub.cancelledAt = now;
    await sub.save();
    const car = await this.carModel.findById(sub.car).exec();
    return this.toPublic(sub, { car: car ?? undefined, now });
  }

  async hasActiveForCar(carId: string): Promise<boolean> {
    return !!(await this.subs.exists({ car: new Types.ObjectId(carId), status: SubscriptionStatus.Active }));
  }

  /** Every car to wash on a date, ordered so a washer can walk the route. */
  async dayPlan(date: string) {
    if (!isValidDate(date)) throw new BadRequestException('Invalid date');
    const subs = await this.subs
      .find({ status: SubscriptionStatus.Active, startDate: { $lte: date } })
      .populate('car')
      .populate('member', 'name email phone apartmentName')
      .exec();
    const due = subs.filter((s) => s.car && isWashDay(s.schedule, date));
    const outcomes = await this.washes
      .find({ date, subscription: { $in: due.map((s) => s._id) } })
      .exec();

    const items = due.map((s) => {
      const car = s.car as unknown as CarDocument;
      const member = s.member as unknown as UserDocument;
      const outcome = outcomes.find((w) => w.subscription.equals(s._id));
      return {
        subscriptionId: s.id as string,
        date,
        status: outcome?.status ?? 'planned',
        note: outcome?.note ?? '',
        photos: outcome?.photos.length ?? 0,
        rating: outcome?.review?.rating ?? null,
        tariffName: s.tariffName,
        extras: s.extras.map((e) => e.name),
        car: CarsService.toPublic(car),
        member: SubscriptionsService.memberInfo(member),
      };
    });
    const num = (v: string) => Number.parseInt(v, 10) || 0;
    return items.sort(
      (a, b) =>
        a.member.apartmentName.localeCompare(b.member.apartmentName) ||
        num(a.car.buildingNumber) - num(b.car.buildingNumber) ||
        a.car.buildingNumber.localeCompare(b.car.buildingNumber) ||
        a.car.parkingFloor.localeCompare(b.car.parkingFloor) ||
        a.car.arrivesHomeAt.localeCompare(b.car.arrivesHomeAt),
    );
  }

  async setWashStatus(admin: AuthUser, dto: SetWashStatusDto) {
    const sub = isValidObjectId(dto.subscriptionId) ? await this.subs.findById(dto.subscriptionId).exec() : null;
    if (!sub) throw new NotFoundException('Subscription not found');
    if (!isValidDate(dto.date) || dto.date < sub.startDate || !isWashDay(sub.schedule, dto.date)) {
      throw new BadRequestException('This car is not scheduled for a wash on that date');
    }
    const doneNotice = { subscription: sub._id, date: dto.date, type: NotificationType.WashDone };
    if (dto.status === 'planned') {
      // undo: keep the record if it has photos, otherwise remove it
      await this.washes.deleteOne({ subscription: sub._id, date: dto.date, 'photos.0': { $exists: false } });
      await this.washes.updateOne(
        { subscription: sub._id, date: dto.date },
        { $set: { status: WashStatus.Planned, note: '' }, $unset: { washedOn: '' } },
      );
      await this.notifications.deleteOne({ ...doneNotice, read: false }); // undo: take back an unread "washed"
      return { subscriptionId: sub.id, date: dto.date, status: 'planned', note: '' };
    }
    const wash = await this.washes
      .findOneAndUpdate(
        { subscription: sub._id, date: dto.date },
        {
          $set: {
            car: sub.car,
            status: dto.status,
            note: dto.note?.trim() ?? '',
            recordedBy: new Types.ObjectId(admin.userId),
            ...(dto.washedOn && dto.washedOn !== dto.date ? { washedOn: dto.washedOn } : {}),
          },
          ...(!dto.washedOn || dto.washedOn === dto.date ? { $unset: { washedOn: '' } } : {}),
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();
    if (wash.status === 'done') {
      const car = await this.carModel.findById(sub.car).exec();
      const owner = await this.userModel.findById(sub.member).select('language').lean().exec();
      if (car) {
        await this.notifications.updateOne(
          doneNotice,
          { $setOnInsert: { member: sub.member, ...NotificationText.washed(car, dto.washedOn ?? dto.date, owner?.language ?? 'ko'), read: false } },
          { upsert: true },
        );
      }
    } else {
      await this.notifications.deleteOne({ ...doneNotice, read: false });
    }
    return { subscriptionId: sub.id, date: wash.date, status: wash.status, note: wash.note };
  }

  private checkedSchedule(entries: { weekday: number; weeks: number[] }[], washesPerMonth: number) {
    const schedule = normalizeSchedule(entries);
    const error = validateSchedule(schedule, washesPerMonth);
    if (error) throw new BadRequestException(error);
    return schedule;
  }

  private async findAccessible(user: AuthUser, id: string): Promise<SubscriptionDocument> {
    const sub = isValidObjectId(id) ? await this.subs.findById(id).exec() : null;
    if (!sub || (user.role !== Role.Admin && sub.member.toString() !== user.userId)) {
      throw new NotFoundException('Subscription not found');
    }
    return sub;
  }

  private static snapshotExtras(extras: ExtraDocument[]) {
    return extras.map((e) => ({ extra: e._id, name: e.name, price: e.price }));
  }

  private static memberInfo(member: UserDocument | null) {
    return {
      id: member?.id ?? '',
      name: member?.name ?? 'Unknown',
      phone: member?.phone ?? '',
      email: member?.email ?? '',
      apartmentName: member?.apartmentName ?? '',
    };
  }

  private toPublic(
    sub: SubscriptionDocument,
    opts: { car?: CarDocument; now: Date; history?: WashDocument[] },
  ) {
    const extrasPerWash = sub.extras.reduce((sum, e) => sum + e.price, 0);
    const active = sub.status === SubscriptionStatus.Active;
    const carRef = sub.car as unknown as { _id?: Types.ObjectId } | Types.ObjectId;
    const carId = carRef instanceof Types.ObjectId ? carRef.toString() : String(carRef?._id ?? '');
    const car: PublicCar | null = opts.car && 'plateNumber' in opts.car ? CarsService.toPublic(opts.car) : null;
    return {
      id: sub.id as string,
      carId,
      car,
      tariffId: sub.tariff.toString(),
      tariffName: sub.tariffName,
      washesPerMonth: sub.washesPerMonth,
      tariffPrice: sub.tariffPrice,
      extras: sub.extras.map((e) => ({ id: e.extra.toString(), name: e.name, price: e.price })),
      monthlyPrice: sub.tariffPrice + extrasPerWash * sub.washesPerMonth,
      schedule: sub.schedule.map((d) => ({ weekday: d.weekday, weeks: [...d.weeks] })),
      startDate: sub.startDate,
      status: sub.status,
      // today's wash drops off "upcoming" once it is marked washed or skipped
      upcoming: active
        ? upcomingWashDates(sub.schedule, sub.startDate, today(opts.now), UPCOMING_COUNT + 1)
            .filter((d) => !(opts.history ?? []).some((w) => w.date === d))
            .slice(0, UPCOMING_COUNT)
        : [],
      history: (opts.history ?? []).map((w) => ({
        date: w.date,
        status: w.status,
        note: w.note,
        photos: w.photos.length,
        rating: w.review?.rating ?? null,
      })),
    };
  }
}
