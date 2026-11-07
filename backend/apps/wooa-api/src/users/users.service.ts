import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { isValidObjectId, Model } from 'mongoose';
import { MemberStatus, Role } from '@app/common/enums';
import { brand, type Lang } from '@app/common/i18n';
import { formatPhone, normalizePhone } from '@app/common/phone';
import { User, UserDocument } from '@app/common/schemas/user.schema';
import { SmsService } from '@app/common/sms/sms.service';
import { AdminCreateMemberDto, AdminUpdateMemberDto, UpdateProfileDto } from './dto/update-profile.dto';

export interface PublicUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  apartmentName: string;
  role: Role;
  status: MemberStatus;
  language: Lang;
  hasPassword?: boolean;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly sms: SmsService,
  ) {}

  create(data: Partial<User> & Pick<User, 'name' | 'phone' | 'apartmentName'>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findByPhoneWithPassword(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone: normalizePhone(phone) }).select('+passwordHash').exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return isValidObjectId(id) ? this.userModel.findById(id).exec() : Promise.resolve(null);
  }

  /** Sets a new password and logs out every device (older tokens stop working). */
  async setPassword(id: string, passwordHash: string): Promise<boolean> {
    const res = await this.userModel.updateOne(
      { _id: id, status: MemberStatus.Active },
      { passwordHash, passwordChangedAt: new Date() },
    );
    return res.matchedCount === 1;
  }

  async changePassword(id: string, current: string, next: string): Promise<void> {
    const user = await this.userModel.findById(id).select('+passwordHash').exec();
    if (!user?.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) {
      throw new BadRequestException('The current password is wrong');
    }
    await this.setPassword(id, await bcrypt.hash(next, 10));
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.getOrThrow(id);
    this.applyProfile(user, dto);
    return UsersService.toPublic(await this.save(user));
  }

  // ---- admin ----

  async list(query: { search?: string; role?: Role }) {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.search?.trim()) {
      const s = query.search.trim();
      const re = new RegExp(escapeRegex(s), 'i');
      const digits = normalizePhone(s);
      filter.$or = [{ name: re }, { apartmentName: re }, { email: re }, ...(digits ? [{ phone: new RegExp(digits) }] : [])];
    }
    const users = await this.userModel.find(filter).sort({ createdAt: -1 }).limit(200).select('+passwordHash').exec();
    return users.map((u) => UsersService.toPublic(u, true));
  }

  async adminCreate(dto: AdminCreateMemberDto): Promise<PublicUser> {
    const phone = normalizePhone(dto.phone);
    if (await this.userModel.exists({ phone })) throw new ConflictException('This phone number already has an account');
    let user: UserDocument;
    try {
      user = await this.userModel.create({
        name: dto.name.trim(),
        phone,
        email: dto.email?.trim().toLowerCase() || undefined,
        apartmentName: dto.apartmentName.trim(),
        role: dto.role ?? Role.Customer,
        language: dto.language ?? 'ko',
        passwordHash: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('This phone number or email already has an account');
      throw err;
    }
    if (!dto.password) {
      await this.sms
        .send(
          phone,
          user.language === 'en'
            ? `[${brand('en')}] An account was created for ${formatPhone(phone)}. ` +
                `Open the ${brand('en')} app, tap "Forgot password" and set your password with an SMS code.`
            : `[${brand('ko')}] ${formatPhone(phone)} 번호로 계정이 만들어졌습니다. ` +
                `${brand('ko')} 앱에서 "비밀번호 찾기"를 누르고 문자 인증번호로 비밀번호를 설정해 주세요.`,
        )
        .catch(() => undefined); // the account exists either way; the admin can tell the member
    }
    return UsersService.toPublic(user, true);
  }

  async adminUpdate(id: string, dto: AdminUpdateMemberDto): Promise<PublicUser> {
    const user = await this.getOrThrow(id);
    this.applyProfile(user, dto);
    if (dto.phone !== undefined) user.phone = normalizePhone(dto.phone);
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.status !== undefined && dto.status !== user.status) {
      user.status = dto.status;
      if (dto.status === MemberStatus.Blocked) user.passwordChangedAt = new Date(); // logs the member out
    }
    return UsersService.toPublic(await this.save(user), true);
  }

  async getOrThrow(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Member not found');
    return user;
  }

  private applyProfile(user: UserDocument, dto: UpdateProfileDto) {
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.apartmentName !== undefined) user.apartmentName = dto.apartmentName.trim();
    if (dto.email !== undefined) user.email = dto.email.trim().toLowerCase() || undefined;
    if (dto.language !== undefined) user.language = dto.language;
  }

  private async save(user: UserDocument): Promise<UserDocument> {
    try {
      return await user.save();
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('This phone number or email is used by another account');
      throw err;
    }
  }

  static toPublic(user: UserDocument, withPasswordFlag = false): PublicUser {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email ?? null,
      apartmentName: user.apartmentName,
      role: user.role,
      status: user.status,
      language: user.language ?? 'ko',
      ...(withPasswordFlag && { hasPassword: !!user.passwordHash }),
    };
  }
}
