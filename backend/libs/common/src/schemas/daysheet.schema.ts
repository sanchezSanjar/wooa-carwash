import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class DaySheetRow {
  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscription: Types.ObjectId;

  /** The wash this row does (its date in the car's schedule). Differs from the sheet date when moved. */
  @Prop({ required: true })
  scheduledDate: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  washer?: Types.ObjectId;

  @Prop({ trim: true, default: '' })
  note: string;
}

/**
 * The admin's workbook for one day: which cars are washed that day, in what order, by whom.
 * Only exists once an admin saved the day; until then the day is the schedule.
 * It never changes cars, members or subscriptions.
 */
@Schema({ collection: 'daysheets', timestamps: true })
export class DaySheet {
  /** YYYY-MM-DD */
  @Prop({ required: true, unique: true })
  date: string;

  @Prop({ type: [SchemaFactory.createForClass(DaySheetRow)], default: [] })
  rows: DaySheetRow[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export type DaySheetDocument = HydratedDocument<DaySheet>;
export const DaySheetSchema = SchemaFactory.createForClass(DaySheet);
DaySheetSchema.index({ 'rows.subscription': 1, 'rows.scheduledDate': 1 });
