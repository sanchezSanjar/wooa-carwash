import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PHONE_RE } from '../../auth/dto/auth.dto.js';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Kim Minjun' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ example: '010-1234-5678' })
  @IsOptional()
  @Matches(PHONE_RE, { message: 'phone must be a valid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'Raemian Gwanggyo' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apartmentName?: string;
}
