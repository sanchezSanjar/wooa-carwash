import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthUser, Role } from './roles';
import { PublicUser, UsersService } from '../users/users.service';
import { UserDocument } from '@app/common/schemas/user.schema';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findByEmailWithPassword(email)) {
      throw new ConflictException('An account with this email already exists');
    }
    const adminEmails = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    let user: UserDocument;
    try {
      user = await this.users.create({
        name: dto.name.trim(),
        email,
        phone: dto.phone.trim(),
        apartmentName: dto.apartmentName.trim(),
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: adminEmails.includes(email) ? Role.Admin : Role.Customer,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
    return this.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue(user);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return UsersService.toPublic(user);
  }

  private async issue(user: UserDocument): Promise<AuthResponse> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: UsersService.toPublic(user),
    };
  }

  static payloadToUser(payload: { sub: string; email: string; role: Role }): AuthUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
