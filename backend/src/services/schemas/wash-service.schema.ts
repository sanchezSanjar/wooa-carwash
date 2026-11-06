import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'services', timestamps: true })
export class WashService {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: '', trim: true })
  description: string;

  /** Price in KRW. */
  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 10 })
  durationMinutes: number;

  @Prop({ default: true })
  active: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export type WashServiceDocument = HydratedDocument<WashService>;
export const WashServiceSchema = SchemaFactory.createForClass(WashService);
