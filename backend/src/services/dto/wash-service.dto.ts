import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateWashServiceDto {
  @ApiProperty({ example: 'Premium Wash' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional({ example: 'Exterior hand wash, interior vacuum, tire shine' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 35000, description: 'Price in KRW' })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(10)
  @Max(600)
  durationMinutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateWashServiceDto extends PartialType(CreateWashServiceDto) {}
