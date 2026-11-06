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
import { OtpService } from './otp.service';
import { AuthUser, Role } from './roles';

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
  ) {}

  static hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const phone = normalizePhone(dto.phone);
    await this.otp.assertSignupVerified(phone);
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
        role: this.bootstrapRole(phone, dto.email),
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('This phone number or email already has an account');
      throw err;
    }
    await this.otp.markSignupUsed(phone);
    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByPhoneWithPassword(normalizePhone(dto.phone));
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Wrong phone number or password');
    }
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

  /** First admins come from .env (ADMIN_PHONES, or ADMIN_EMAILS for a matching email). */
  private bootstrapRole(phone: string, email?: string): Role {
    const list = (key: string) =>
      (this.config.get<string>(key) ?? '')
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
    const phones = list('ADMIN_PHONES').map(normalizePhone);
    const emails = list('ADMIN_EMAILS');
    if (phones.includes(phone) || (email && emails.includes(email.trim().toLowerCase()))) return Role.Admin;
    return Role.Customer;
  }
}
