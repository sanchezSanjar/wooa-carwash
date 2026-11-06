import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const BookingStatus = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  InProgress: 'in_progress',
  Completed: 'completed',
  Cancelled: 'cancelled',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

/** Statuses that occupy a bay. */
export const ACTIVE_STATUSES: BookingStatus[] = [
  BookingStatus.Pending,
  BookingStatus.Confirmed,
  BookingStatus.InProgress,
];

@Schema({ _id: false })
export class Vehicle {
  @Prop({ required: true, trim: true, uppercase: true })
  plate: string;

  @Prop({ trim: true })
  model?: string;
}

@Schema({ collection: 'bookings', timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WashService', required: true })
  service: Types.ObjectId;

  /** Snapshot so later price/name edits don't change past bookings. */
  @Prop({ required: true })
  serviceName: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true, index: true })
  startsAt: Date;

  @Prop({ required: true })
  endsAt: Date;

  @Prop({ type: Vehicle, required: true })
  vehicle: Vehicle;

  @Prop({ trim: true, default: '' })
  notes: string;

  @Prop({ type: String, enum: Object.values(BookingStatus), default: BookingStatus.Pending })
  status: BookingStatus;
}

export type BookingDocument = HydratedDocument<Booking>;
export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index({ startsAt: 1, status: 1 });
