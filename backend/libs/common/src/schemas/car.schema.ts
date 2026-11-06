import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'cars', timestamps: true })
export class Car {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  plateNumber: string;

  @Prop({ required: true, trim: true })
  brand: string;

  @Prop({ required: true, trim: true })
  model: string;

  @Prop({ required: true, trim: true })
  color: string;

  /** Building (dong) number inside the apartment complex, e.g. "101". */
  @Prop({ required: true, trim: true })
  buildingNumber: string;

  /** Parking floor of that building, e.g. "B2". */
  @Prop({ required: true, trim: true, uppercase: true })
  parkingFloor: string;

  /** When the car is usually back home (HH:mm). */
  @Prop({ required: true })
  arrivesHomeAt: string;

  /** When the car usually leaves for work (HH:mm). */
  @Prop({ required: true })
  leavesForWorkAt: string;
}

export type CarDocument = HydratedDocument<Car>;
export const CarSchema = SchemaFactory.createForClass(Car);
