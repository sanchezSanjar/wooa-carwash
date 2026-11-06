import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** A day's weather for one KMA grid square, refreshed by the batch server. */
@Schema({ collection: 'forecasts', timestamps: true })
export class Forecast {
  /** YYYY-MM-DD */
  @Prop({ required: true })
  date: string;

  /** "nx,ny" */
  @Prop({ required: true })
  grid: string;

  @Prop({ required: true })
  pop: number;

  @Prop({ required: true })
  precipitation: string;

  @Prop({ type: Number })
  tempMin?: number | null;

  @Prop({ type: Number })
  tempMax?: number | null;

  @Prop({ required: true })
  summary: string;
}

export type ForecastDocument = HydratedDocument<Forecast>;
export const ForecastSchema = SchemaFactory.createForClass(Forecast);
ForecastSchema.index({ date: 1, grid: 1 }, { unique: true });
// old forecasts are useless: keep two weeks
ForecastSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 14 * 24 * 3600 });
