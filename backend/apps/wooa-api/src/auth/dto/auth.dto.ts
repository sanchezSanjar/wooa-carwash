import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PasswordFits } from '../password';
import { OtpPurpose } from '@app/common/schemas/otp.schema';

/** Accepts 010-1234-5678, 01012345678 or +82 10 1234 5678; services normalize it. */
export const PHONE_RE = /^(\+?82[\s-]?|0)1[016789][\s-]?\d{3,4}[\s-]?\d{4}$/;
const PHONE_MSG = { message: 'phone must be a Korean mobile number like 010-1234-5678' };

export class PhoneDto {
  @ApiProperty({ example: '010-1234-5678' })
  @Matches(PHONE_RE, PHONE_MSG)
  phone: string;
}

export class RequestOtpDto extends PhoneDto {
  @ApiProperty({ enum: Object.values(OtpPurpose) })
  @IsIn(Object.values(OtpPurpose))
  purpose: OtpPurpose;
}

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}

export class RegisterDto extends PhoneDto {
  @ApiProperty({ description: 'Given by /auth/otp/verify after the correct SMS code' })
  @IsString()
  @MinLength(20)
  @MaxLength(100)
  signupToken: string;

  @ApiProperty({ example: 'Kim Minjun' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty({ minLength: 8, example: 'secret123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @PasswordFits()
  password: string;

  @ApiProperty({ example: 'Raemian Gwanggyo', description: 'Apartment complex name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apartmentName: string;

  @ApiPropertyOptional({ example: 'minjun@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class LoginDto extends PhoneDto {
  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(1)
  password: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(100)
  resetToken: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @PasswordFits()
  newPassword: string;
}
