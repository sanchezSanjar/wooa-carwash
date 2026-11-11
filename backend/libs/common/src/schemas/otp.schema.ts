import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const OtpPurpose = { Signup: 'signup', Reset: 'reset' } as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];

export const OtpStatus = { Pending: 'pending', Verified: 'verified', Used: 'used', Expired: 'expired' } as const;
export type OtpStatus = (typeof OtpStatus)[keyof typeof OtpStatus];

/** A one-time SMS code. Codes and the tokens given after a correct code are stored only as hashes. */
@Schema({ collection: 'otps', timestamps: true })
export class Otp {
  @Prop({ type: String, enum: Object.values(OtpPurpose), required: true })
  purpose: OtpPurpose;

  @Prop({ type: String, enum: Object.values(OtpStatus), default: OtpStatus.Pending })
  status: OtpStatus;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true, select: false })
  codeHash: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ required: true })
  ip: string;

  /** Given after a correct code: sign-up needs it to register, a reset needs it to set the password. */
  @Prop({ select: false })
  tokenHash?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  member?: Types.ObjectId;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  verifiedAt?: Date;
}

export type OtpDocument = HydratedDocument<Otp>;
export const OtpSchema = SchemaFactory.createForClass(Otp);
OtpSchema.index({ phone: 1, purpose: 1, createdAt: -1 });
OtpSchema.index({ ip: 1, createdAt: -1 });
OtpSchema.index({ tokenHash: 1 }, { sparse: true });
// Deleted after a day; rate-limit history lives that long.
OtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
