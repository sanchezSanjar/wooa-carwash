import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../common/roles.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { User, UserDocument } from './schemas/user.schema.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  apartmentName: string;
  role: Role;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  create(data: Omit<User, 'role'> & { role?: Role }): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Member not found');
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.phone !== undefined) user.phone = dto.phone.trim();
    if (dto.apartmentName !== undefined) user.apartmentName = dto.apartmentName.trim();
    return UsersService.toPublic(await user.save());
  }

  static toPublic(user: UserDocument): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      apartmentName: user.apartmentName,
      role: user.role,
    };
  }
}
