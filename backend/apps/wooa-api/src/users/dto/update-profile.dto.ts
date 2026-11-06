import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { MemberStatus, Role } from '@app/common/enums';
import { PHONE_RE } from '../../auth/dto/auth.dto';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Kim Minjun' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: 'Raemian Gwanggyo' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apartmentName?: string;

  @ApiPropertyOptional({ example: 'minjun@example.com', description: 'Empty string removes it' })
  @IsOptional()
  @ValidateIf((o: UpdateProfileDto) => o.email !== '')
  @IsEmail()
  email?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class AdminCreateMemberDto {
  @ApiProperty({ example: 'Lee Jiwoo' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: '010-2222-3333' })
  @Matches(PHONE_RE, { message: 'phone must be a Korean mobile number like 010-1234-5678' })
  phone: string;

  @ApiProperty({ example: 'Raemian Gwanggyo' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apartmentName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: Object.values(Role), default: Role.Customer })
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  @ApiPropertyOptional({ description: 'Leave empty: the member sets it via "Forgot password" (SMS)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

export class AdminUpdateMemberDto extends UpdateProfileDto {
  @ApiPropertyOptional({ example: '010-2222-3333' })
  @IsOptional()
  @Matches(PHONE_RE, { message: 'phone must be a Korean mobile number like 010-1234-5678' })
  phone?: string;

  @ApiPropertyOptional({ enum: Object.values(Role) })
  @IsOptional()
  @IsIn(Object.values(Role))
  role?: Role;

  @ApiPropertyOptional({ enum: Object.values(MemberStatus) })
  @IsOptional()
  @IsIn(Object.values(MemberStatus))
  status?: MemberStatus;
}
