import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PHONE_RE = /^[0-9+\-\s]{7,20}$/;

export class RegisterDto {
  @ApiProperty({ example: 'Kim Minjun' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'minjun@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, example: 'secret123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiProperty({ example: '010-1234-5678' })
  @Matches(PHONE_RE, { message: 'phone must be a valid phone number' })
  phone: string;

  @ApiProperty({ example: 'Raemian Gwanggyo', description: 'Apartment complex name' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apartmentName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'minjun@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(1)
  password: string;
}
