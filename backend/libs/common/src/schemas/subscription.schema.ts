import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const SubscriptionStatus = { Active: 'active', Cancelled: 'cancelled' } as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

/** planned: stored only once photos exist but the wash is not marked yet. */
export const WashStatus = { Planned: 'planned', Done: 'done', Skipped: 'skipped' } as const;
export type WashStatus = (typeof WashStatus)[keyof typeof WashStatus];

export const PhotoKind = {
  /** Pre-wash inspection: existing scratches and dents. */
  Before: 'before',
  /** Finished car. */
  After: 'after',
} as const;
export type PhotoKind = (typeof PhotoKind)[keyof typeof PhotoKind];

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class WashPhoto {
  @Prop({ type: String, enum: Object.values(PhotoKind), required: true })
  kind: PhotoKind;

  /** Path under the uploads folder, e.g. "washes/<sub>/<date>/<id>.jpg". */
  @Prop({ required: true })
  key: string;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  uploadedBy?: Types.ObjectId;
}

@Schema({ _id: false, timestamps: { createdAt: true, updatedAt: true } })
export class WashReview {
  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ trim: true, default: '' })
  comment: string;
}

@Schema({ _id: false })
export class ScheduleDay {
  /** 0 = Sunday … 6 = Saturday */
  @Prop({ required: true, min: 0, max: 6 })
  weekday: number;

  /** Occurrences of that weekday in the month, e.g. [1, 3] = 1st and 3rd. */
  @Prop({ type: [Number], required: true })
  weeks: number[];
}

@Schema({ _id: false })
export class SubscribedExtra {
  @Prop({ type: Types.ObjectId, ref: 'Extra', required: true })
  extra: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  /** Price per wash at the time of subscribing (KRW). */
  @Prop({ required: true })
  price: number;
}

/** One car's wash plan. Tariff and extra prices are copied so later price edits don't change it. */
@Schema({ collection: 'subscriptions', timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  member: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Car', required: true })
  car: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tariff', required: true })
  tariff: Types.ObjectId;

  @Prop({ required: true })
  tariffName: string;

  @Prop({ required: true })
  washesPerMonth: number;

  /** Monthly tariff price (KRW). */
  @Prop({ required: true })
  tariffPrice: number;

  @Prop({ type: [SchemaFactory.createForClass(SubscribedExtra)], default: [] })
  extras: SubscribedExtra[];

  @Prop({ type: [SchemaFactory.createForClass(ScheduleDay)], required: true })
  schedule: ScheduleDay[];

  /** First day the subscription is valid (YYYY-MM-DD, Korea time). */
  @Prop({ required: true, index: true })
  startDate: string;

  @Prop({ type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.Active })
  status: SubscriptionStatus;

  @Prop()
  cancelledAt?: Date;
}

/** Outcome of one scheduled wash. Planned washes are computed from the schedule, not stored. */
@Schema({ collection: 'washes', timestamps: true })
export class Wash {
  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscription: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Car', required: true, index: true })
  car: Types.ObjectId;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  date: string;

  @Prop({ type: String, enum: Object.values(WashStatus), required: true })
  status: WashStatus;

  @Prop({ trim: true, default: '' })
  note: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  recordedBy?: Types.ObjectId;

  /** Set when the car was washed on another day than scheduled (moved on a day sheet). */
  @Prop()
  washedOn?: string;

  @Prop({ type: [SchemaFactory.createForClass(WashPhoto)], default: [] })
  photos: (WashPhoto & { _id: Types.ObjectId; createdAt?: Date })[];

  /** The member's rating of this wash. */
  @Prop({ type: SchemaFactory.createForClass(WashReview) })
  review?: WashReview & { createdAt?: Date; updatedAt?: Date };
}

export type SubscriptionDocument = HydratedDocument<Subscription>;
export type WashDocument = HydratedDocument<Wash>;

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
// A car can only have one active subscription.
SubscriptionSchema.index(
  { car: 1 },
  { unique: true, partialFilterExpression: { status: SubscriptionStatus.Active } },
);

export const WashSchema = SchemaFactory.createForClass(Wash);
WashSchema.index({ subscription: 1, date: 1 }, { unique: true });
WashSchema.index({ date: 1 });
WashSchema.index({ 'review.createdAt': -1 }, { sparse: true });
