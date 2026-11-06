import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { MemberStatus, Role } from '../enums';
import { LANGS, type Lang } from '../i18n';

@Schema({ collection: 'members', timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  /** Login name: mobile number, digits only (01012345678). Verified by SMS at sign-up. */
  @Prop({ required: true, unique: true, trim: true })
  phone: string;

  /** Optional contact email. */
  @Prop({ lowercase: true, trim: true, unique: true, sparse: true })
  email?: string;

  /** Apartment complex the member lives in, e.g. "Raemian Gwanggyo". */
  @Prop({ required: true, trim: true, index: true })
  apartmentName: string;

  /** Empty for accounts an admin created: the member sets it with "forgot password". */
  @Prop({ select: false })
  passwordHash?: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.Customer })
  role: Role;

  @Prop({ type: String, enum: Object.values(MemberStatus), default: MemberStatus.Active })
  status: MemberStatus;

  /** Language of the member's notifications and SMS. */
  @Prop({ type: String, enum: LANGS, default: 'ko' })
  language: Lang;

  /** Tokens issued before this moment stop working (password reset, block). */
  @Prop()
  passwordChangedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
