import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** A login token ended by "Log out". Kept only until the token would have expired anyway. */
@Schema({ collection: 'revokedtokens' })
export class RevokedToken {
  /** The token's id (JWT "jti"). */
  @Prop({ required: true, unique: true })
  jti: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export type RevokedTokenDocument = HydratedDocument<RevokedToken>;
export const RevokedTokenSchema = SchemaFactory.createForClass(RevokedToken);
// MongoDB deletes each entry when its token expires
RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
