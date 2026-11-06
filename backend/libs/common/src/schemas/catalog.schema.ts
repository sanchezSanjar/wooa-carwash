import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** A subscription plan: how many washes per month and the monthly price. */
@Schema({ collection: 'tariffs', timestamps: true })
export class Tariff {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  description: string;

  @Prop({ required: true, enum: [2, 4, 6] })
  washesPerMonth: number;

  /** Monthly price in KRW. */
  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

/** Optional add-on done with every wash, e.g. interior vacuuming. */
@Schema({ collection: 'extras', timestamps: true })
export class Extra {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  description: string;

  /** Price per wash in KRW. */
  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export type TariffDocument = HydratedDocument<Tariff>;
export type ExtraDocument = HydratedDocument<Extra>;
export const TariffSchema = SchemaFactory.createForClass(Tariff);
export const ExtraSchema = SchemaFactory.createForClass(Extra);
