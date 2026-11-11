import type { Lang } from '@app/common/i18n';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { MemberStatus } from '@app/common/enums';
import { normalizePhone } from '@app/common/phone';
import { UserDocument } from '@app/common/schemas/user.schema';
import { PublicUser, UsersService } from '../users/users.service';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';
import { LoginAttempts } from './login-attempts';
import { OtpService } from './otp.service';
import { AuthUser, Role } from './roles';

/** Compared when the number has no account, so a wrong number takes as long as a wrong password. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly attempts: LoginAttempts,
  ) {}

  static hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  async register(dto: RegisterDto, language: Lang = 'ko'): Promise<AuthResponse> {
    const phone = normalizePhone(dto.phone);
    await this.otp.assertSignupToken(phone, dto.signupToken);
    if (await this.users.findByPhoneWithPassword(phone)) {
      throw new ConflictException('This phone number already has an account');
    }
    let user: UserDocument;
    try {
      user = await this.users.create({
        name: dto.name.trim(),
        phone,
        email: dto.email?.trim().toLowerCase() || undefined,
        apartmentName: dto.apartmentName.trim(),
        passwordHash: await AuthService.hashPassword(dto.password),
        role: this.bootstrapRole(phone),
        language,
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('This phone number or email already has an account');
      throw err;
    }
    await this.otp.useSignupToken(phone, dto.signupToken);
    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const phone = normalizePhone(dto.phone);
    this.attempts.assertAllowed(phone);
    const user = await this.users.findByPhoneWithPassword(phone);
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user?.passwordHash || !ok) {
      this.attempts.failed(phone);
      throw new UnauthorizedException('Wrong phone number or password');
    }
    this.attempts.succeeded(phone);
    if (user.status !== MemberStatus.Active) throw new ForbiddenException('This account is blocked');
    return this.issue(user);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const memberId = await this.otp.consumeResetToken(dto.resetToken);
    const ok = await this.users.setPassword(memberId.toString(), await AuthService.hashPassword(dto.newPassword));
    if (!ok) throw new BadRequestException('This reset link has expired. Start again.');
    return { message: 'Password changed. Log in with your new password.' };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return UsersService.toPublic(user);
  }

  /** Called on every request by the JWT strategy: blocked members and old tokens are rejected. */
  async validate(payload: { sub: string; iat?: number }): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== MemberStatus.Active) throw new UnauthorizedException();
    const issuedAt = (payload.iat ?? 0) * 1000;
    if (user.passwordChangedAt && issuedAt < user.passwordChangedAt.getTime() - 1000) {
      throw new UnauthorizedException('Please log in again');
    }
    return { userId: user.id, role: user.role, phone: user.phone };
  }

  private async issue(user: UserDocument): Promise<AuthResponse> {
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      user: UsersService.toPublic(user),
    };
  }

  /**
   * First admins come from ADMIN_PHONES in .env. Only phone numbers count: they are proven by the SMS code,
   * while an email address at sign-up is not checked by anyone.
   */
  private bootstrapRole(phone: string): Role {
    const phones = (this.config.get<string>('ADMIN_PHONES') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map(normalizePhone);
    return phones.includes(phone) ? Role.Admin : Role.Customer;
  }
}
