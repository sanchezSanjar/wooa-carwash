import type { Lang } from '@app/common/i18n';
import { NotificationText } from '@app/common/notify';
import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Model, Types } from 'mongoose';
import { MemberStatus } from '@app/common/enums';
import { normalizePhone } from '@app/common/phone';
import { Otp, OtpPurpose, OtpStatus } from '@app/common/schemas/otp.schema';
import { User } from '@app/common/schemas/user.schema';
import { SmsService } from '@app/common/sms/sms.service';

const MINUTE = 60_000;
const CODE_TTL = 3 * MINUTE;
const RESET_TOKEN_TTL = 10 * MINUTE;
const SIGNUP_VERIFIED_WINDOW = 15 * MINUTE;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN = MINUTE;
const MAX_PER_PHONE_PER_HOUR = 5; // every code is a paid SMS
const MAX_PER_IP_PER_HOUR = 20;

export const OTP_SENT = 'Code sent';
export const OTP_SENT_IF_REGISTERED = 'If this number has an account, a code was sent';

/**
 * Phone verification by SMS code (same design as CarZip):
 * - codes and reset tokens are stored only as hashes (HMAC with the server secret);
 * - a correct 6-digit code for a reset only buys a one-time 32-byte reset token;
 * - per-phone and per-IP limits, a resend cooldown and 5 attempts per code.
 */
@Injectable()
export class OtpService {
  private readonly secret: string;

  constructor(
    @InjectModel(Otp.name) private readonly otps: Model<Otp>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly sms: SmsService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_SECRET');
  }

  async request(rawPhone: string, purpose: OtpPurpose, ip: string, lang: Lang = 'ko'): Promise<string> {
    const phone = normalizePhone(rawPhone);
    if (purpose === OtpPurpose.Signup && (await this.users.exists({ phone }))) {
      throw new BadRequestException('This phone number already has an account. Log in or reset your password.');
    }
    await this.checkRateLimit(phone, purpose, ip);

    let member: Types.ObjectId | undefined;
    if (purpose === OtpPurpose.Reset) {
      const user = await this.users.findOne({ phone }).select('_id status').lean().exec();
      // unknown or blocked number: send nothing, answer exactly like a real send
      if (!user || user.status !== MemberStatus.Active) return OTP_SENT_IF_REGISTERED;
      member = user._id;
    }

    await this.otps.updateMany({ phone, purpose, status: OtpStatus.Pending }, { status: OtpStatus.Expired });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.otps.create({
      purpose,
      phone,
      codeHash: this.hashCode(phone, code),
      ip,
      member,
      expiresAt: new Date(Date.now() + CODE_TTL),
    });

    const text = NotificationText.otp(code, lang);
    if (purpose === OtpPurpose.Signup) {
      await this.sms.send(phone, text);
      return OTP_SENT;
    }
    // reset: don't wait for the SMS, so timing doesn't reveal whether the number is registered
    this.sms.send(phone, text).catch(() => undefined);
    return OTP_SENT_IF_REGISTERED;
  }

  async verify(rawPhone: string, purpose: OtpPurpose, code: string): Promise<{ verified: true; resetToken?: string }> {
    const phone = normalizePhone(rawPhone);
    // count the attempt before comparing, atomically: parallel guesses can't exceed the limit
    const otp = await this.otps
      .findOneAndUpdate(
        { phone, purpose, status: OtpStatus.Pending },
        { $inc: { attempts: 1 } },
        { sort: { createdAt: -1 }, returnDocument: 'after' },
      )
      .select('+codeHash')
      .lean()
      .exec();
    const expired = new BadRequestException('The code has expired. Request a new one.');
    if (!otp) throw expired;
    if (otp.expiresAt < new Date() || otp.attempts > MAX_ATTEMPTS) {
      await this.otps.updateOne({ _id: otp._id }, { status: OtpStatus.Expired });
      throw expired;
    }
    if (!this.codeMatches(otp.codeHash, phone, code)) {
      const left = MAX_ATTEMPTS - otp.attempts;
      if (left <= 0) {
        await this.otps.updateOne({ _id: otp._id }, { status: OtpStatus.Expired });
        throw expired;
      }
      throw new BadRequestException(`Wrong code. ${left} attempt(s) left.`);
    }

    const verified = { status: OtpStatus.Verified, verifiedAt: new Date() };
    if (purpose === OtpPurpose.Signup) {
      await this.otps.updateOne({ _id: otp._id, status: OtpStatus.Pending }, verified);
      return { verified: true };
    }
    const resetToken = randomBytes(32).toString('base64url');
    await this.otps.updateOne(
      { _id: otp._id, status: OtpStatus.Pending },
      { ...verified, resetTokenHash: sha256(resetToken), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL) },
    );
    return { verified: true, resetToken };
  }

  /** Sign-up: the phone must have been verified by SMS in the last 15 minutes. */
  async assertSignupVerified(rawPhone: string): Promise<void> {
    const ok = await this.otps.exists({
      phone: normalizePhone(rawPhone),
      purpose: OtpPurpose.Signup,
      status: OtpStatus.Verified,
      verifiedAt: { $gte: new Date(Date.now() - SIGNUP_VERIFIED_WINDOW) },
    });
    if (!ok) throw new BadRequestException('Verify your phone number with the SMS code first');
  }

  async markSignupUsed(rawPhone: string): Promise<void> {
    await this.otps.updateMany(
      { phone: normalizePhone(rawPhone), purpose: OtpPurpose.Signup, status: OtpStatus.Verified },
      { status: OtpStatus.Used },
    );
  }

  /** Uses a reset token exactly once and returns the member it belongs to. */
  async consumeResetToken(resetToken: string): Promise<Types.ObjectId> {
    const otp = await this.otps
      .findOneAndUpdate(
        {
          resetTokenHash: sha256(resetToken),
          purpose: OtpPurpose.Reset,
          status: OtpStatus.Verified,
          expiresAt: { $gt: new Date() },
        },
        { status: OtpStatus.Used },
      )
      .lean()
      .exec();
    if (!otp?.member) throw new BadRequestException('This reset link has expired. Start again.');
    return otp.member;
  }

  private async checkRateLimit(phone: string, purpose: OtpPurpose, ip: string): Promise<void> {
    const hourAgo = new Date(Date.now() - 60 * MINUTE);
    const [last, perPhone, perIp] = await Promise.all([
      this.otps.findOne({ phone, purpose }).sort({ createdAt: -1 }).select('createdAt').lean().exec(),
      this.otps.countDocuments({ phone, purpose, createdAt: { $gte: hourAgo } }),
      this.otps.countDocuments({ ip, createdAt: { $gte: hourAgo } }),
    ]);
    if (perPhone >= MAX_PER_PHONE_PER_HOUR || perIp >= MAX_PER_IP_PER_HOUR) {
      throw new HttpException('Too many codes requested. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const lastAt = (last as { createdAt?: Date } | null)?.createdAt;
    if (lastAt && lastAt.getTime() > Date.now() - RESEND_COOLDOWN) {
      throw new HttpException('Wait a minute before requesting another code.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private hashCode(phone: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${phone}:${code}`).digest('hex');
  }

  private codeMatches(hash: string, phone: string, code: string): boolean {
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(this.hashCode(phone, code), 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
