import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const InvoiceStatus = { Unpaid: 'unpaid', Paid: 'paid', Void: 'void' } as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentMethod = { BankTransfer: 'bank_transfer', Cash: 'cash', Card: 'card', Other: 'other' } as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

@Schema({ _id: false })
export class InvoiceLine {
  @Prop({ required: true })
  label: string;

  /** KRW */
  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: ['plan', 'extra'] })
  kind?: 'plan' | 'extra';

  /** Tariff or extra service name. */
  @Prop()
  name?: string;

  /** Washes billed. */
  @Prop()
  washes?: number;

  /** Washes in a full month (plan line). */
  @Prop()
  washesPerMonth?: number;
}

/** One car's bill for one month. Payment is collected outside the app and marked by an admin. */
@Schema({ collection: 'invoices', timestamps: true })
export class Invoice {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  member: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscription: Types.ObjectId;

  @Prop({ required: true })
  plateNumber: string;

  /** YYYY-MM */
  @Prop({ required: true, index: true })
  month: string;

  @Prop({ type: [SchemaFactory.createForClass(InvoiceLine)], default: [] })
  lines: InvoiceLine[];

  /** KRW */
  @Prop({ required: true, min: 0 })
  amount: number;

  /** YYYY-MM-DD */
  @Prop({ required: true })
  issueDate: string;

  /** YYYY-MM-DD */
  @Prop({ required: true, index: true })
  dueDate: string;

  @Prop({ type: String, enum: Object.values(InvoiceStatus), default: InvoiceStatus.Unpaid, index: true })
  status: InvoiceStatus;

  @Prop()
  paidAt?: Date;

  @Prop({ type: String, enum: Object.values(PaymentMethod) })
  method?: PaymentMethod;

  @Prop({ trim: true, default: '' })
  note: string;

  /** Reminder bookkeeping for the batch server. */
  @Prop()
  dueSoonSentAt?: Date;

  @Prop()
  lastOverdueSentAt?: Date;
}

export type InvoiceDocument = HydratedDocument<Invoice>;
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
InvoiceSchema.index({ subscription: 1, month: 1 }, { unique: true });
InvoiceSchema.index({ status: 1, dueDate: 1 });
