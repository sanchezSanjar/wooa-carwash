import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { isValidObjectId, Model, Types } from 'mongoose';
import sharp from 'sharp';
import { addDays, isValidDate, today } from '@app/common/dates';
import { isWashDay } from '@app/common/schedule';
import { Car, CarDocument } from '@app/common/schemas/car.schema';
import {
  Subscription,
  SubscriptionDocument,
  Wash,
  WashDocument,
  WashStatus,
} from '@app/common/schemas/subscription.schema';
import { User, UserDocument } from '@app/common/schemas/user.schema';
import { AuthUser, isStaff } from '../auth/roles';
import { CarsService } from '../cars/cars.service';
import { ReviewDto, UploadPhotoDto, WashRefDto } from './dto/wash.dto';
import { StorageService } from './storage.service';

const MAX_PHOTOS_PER_WASH = 20;
const REVIEW_WINDOW_DAYS = 30;

export const toPublicPhoto = (p: Wash['photos'][number]) => ({
  id: p._id.toString(),
  kind: p.kind,
  url: StorageService.url(p.key),
  note: p.note,
  createdAt: p.createdAt?.toISOString() ?? null,
});

export const toPublicReview = (r: Wash['review']) =>
  r ? { rating: r.rating, comment: r.comment, createdAt: r.createdAt?.toISOString() ?? null } : null;

/** Photos (before/after), wash details and member reviews. */
@Injectable()
export class WashesService {
  constructor(
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(Wash.name) private readonly washes: Model<Wash>,
    @InjectModel(Car.name) private readonly cars: Model<Car>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly storage: StorageService,
  ) {}

  /** One wash: staff see any, members only their own cars. */
  async detail(user: AuthUser, ref: WashRefDto) {
    const sub = await this.accessibleSub(user, ref.subscriptionId);
    this.assertScheduled(sub, ref.date);
    const [wash, car] = await Promise.all([
      this.washes.findOne({ subscription: sub._id, date: ref.date }).exec(),
      this.cars.findById(sub.car).exec(),
    ]);
    return {
      subscriptionId: sub.id as string,
      date: ref.date,
      status: wash?.status ?? WashStatus.Planned,
      note: wash?.note ?? '',
      washedOn: wash?.washedOn ?? null,
      tariffName: sub.tariffName,
      extras: sub.extras.map((e) => e.name),
      car: car ? CarsService.toPublic(car) : null,
      photos: (wash?.photos ?? []).map(toPublicPhoto),
      review: toPublicReview(wash?.review),
      canReview: !isStaff(user) && this.reviewOpen(wash),
    };
  }

  async uploadPhoto(user: AuthUser, dto: UploadPhotoDto, file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Attach a photo');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only images can be uploaded');
    const sub = await this.subOrThrow(dto.subscriptionId);
    this.assertScheduled(sub, dto.date);

    const existing = await this.washes.findOne({ subscription: sub._id, date: dto.date }).select('photos').exec();
    if ((existing?.photos.length ?? 0) >= MAX_PHOTOS_PER_WASH) {
      throw new BadRequestException(`At most ${MAX_PHOTOS_PER_WASH} photos per wash`);
    }

    let jpeg: Buffer;
    try {
      // phones take 4000px+ photos: 1600px is plenty to see a scratch and keeps uploads small
      jpeg = await sharp(file.buffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    } catch {
      throw new BadRequestException('This file is not a readable image');
    }
    const key = `washes/${sub.id}/${dto.date}/${randomUUID()}.jpg`;
    await this.storage.save(key, jpeg);

    const photoId = new Types.ObjectId();
    // The limit is part of the update itself: the record only matches while it has fewer than 20 photos,
    // so uploads arriving at the same moment can't push it past the limit.
    const filter = { subscription: sub._id, date: dto.date, [`photos.${MAX_PHOTOS_PER_WASH - 1}`]: { $exists: false } };
    const update = {
      $setOnInsert: { car: sub.car, status: WashStatus.Planned, note: '' },
      $push: {
        photos: {
          _id: photoId,
          kind: dto.kind,
          key,
          note: dto.note?.trim() ?? '',
          uploadedBy: new Types.ObjectId(user.userId),
          createdAt: new Date(),
        },
      },
    };
    let added: boolean;
    try {
      // no record yet: created here (upsert)
      await this.washes.updateOne(filter, update, { upsert: true });
      added = true;
    } catch (err: any) {
      // the record exists but didn't match (full), or another upload created it a moment ago: try once more
      if (err?.code !== 11000) throw err;
      added = (await this.washes.updateOne(filter, update)).modifiedCount === 1;
    }
    if (!added) {
      await this.storage.delete(key);
      throw new BadRequestException(`At most ${MAX_PHOTOS_PER_WASH} photos per wash`);
    }
    return { id: photoId.toString(), kind: dto.kind, url: StorageService.url(key), note: dto.note?.trim() ?? '' };
  }

  async deletePhoto(photoId: string) {
    if (!isValidObjectId(photoId)) throw new NotFoundException('Photo not found');
    const wash = await this.washes.findOne({ 'photos._id': new Types.ObjectId(photoId) }).exec();
    const photo = wash?.photos.find((p) => p._id.toString() === photoId);
    if (!wash || !photo) throw new NotFoundException('Photo not found');
    await this.washes.updateOne({ _id: wash._id }, { $pull: { photos: { _id: photo._id } } });
    await this.storage.delete(photo.key);
  }

  /** Members rate a finished wash of their own car (1–5 stars) within 30 days. */
  async review(user: AuthUser, dto: ReviewDto) {
    const sub = await this.accessibleSub(user, dto.subscriptionId);
    if (sub.member.toString() !== user.userId) throw new ForbiddenException('Only the car owner can review this wash');
    const wash = await this.washes.findOne({ subscription: sub._id, date: dto.date }).exec();
    if (!wash || wash.status !== WashStatus.Done) throw new BadRequestException('You can rate a wash once it is done');
    if (!this.reviewOpen(wash)) throw new BadRequestException(`Reviews are open for ${REVIEW_WINDOW_DAYS} days after the wash`);
    const now = new Date();
    wash.review = {
      rating: dto.rating,
      comment: dto.comment?.trim() ?? '',
      createdAt: wash.review?.createdAt ?? now,
      updatedAt: now,
    };
    await wash.save();
    return toPublicReview(wash.review);
  }

  /** Admin: newest reviews with the car and member. */
  async recentReviews(limit = 50) {
    const washes = await this.washes
      .find({ review: { $exists: true } })
      .sort({ 'review.updatedAt': -1 })
      .limit(limit)
      .populate('car')
      .populate({ path: 'subscription', select: 'member tariffName', populate: { path: 'member', select: 'name phone apartmentName' } })
      .exec();
    return washes.map((w) => {
      const car = w.car as unknown as CarDocument | null;
      const sub = w.subscription as unknown as (SubscriptionDocument & { member: UserDocument | null }) | null;
      return {
        subscriptionId: sub?.id ?? '',
        date: w.date,
        plateNumber: car?.plateNumber ?? '',
        memberName: sub?.member?.name ?? '',
        apartmentName: sub?.member?.apartmentName ?? '',
        review: toPublicReview(w.review),
      };
    });
  }

  private reviewOpen(wash: WashDocument | null): boolean {
    if (!wash || wash.status !== WashStatus.Done) return false;
    return addDays(wash.washedOn ?? wash.date, REVIEW_WINDOW_DAYS) >= today();
  }

  private assertScheduled(sub: SubscriptionDocument, date: string) {
    if (!isValidDate(date) || date < sub.startDate || !isWashDay(sub.schedule, date)) {
      throw new BadRequestException('This car is not scheduled for a wash on that date');
    }
  }

  private async subOrThrow(id: string): Promise<SubscriptionDocument> {
    const sub = isValidObjectId(id) ? await this.subs.findById(id).exec() : null;
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  private async accessibleSub(user: AuthUser, id: string): Promise<SubscriptionDocument> {
    const sub = await this.subOrThrow(id);
    if (!isStaff(user) && sub.member.toString() !== user.userId) throw new NotFoundException('Subscription not found');
    return sub;
  }
}
