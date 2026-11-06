import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const NotificationType = {
  /** Sent by the batch server the evening before a wash. */
  WashReminder: 'wash_reminder',
  /** Sent by the API when the shop marks a wash done. */
  WashDone: 'wash_done',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** A message to a member, shown in the app. */
@Schema({ collection: 'notifications', timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  member: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  body: string;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscription: Types.ObjectId;

  /** The wash date this is about (YYYY-MM-DD). */
  @Prop({ required: true })
  date: string;

  @Prop({ default: false })
  read: boolean;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ member: 1, createdAt: -1 });
// One notification of each kind per wash: a job that runs twice cannot send duplicates.
NotificationSchema.index({ subscription: 1, date: 1, type: 1 }, { unique: true });
