import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateExtraDto {
  @ApiProperty({ example: 'Interior vacuuming' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ example: 5000, description: 'Price per wash in KRW' })
  @IsInt()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateExtraDto extends PartialType(CreateExtraDto) {}

export class CreateTariffDto extends CreateExtraDto {
  @ApiProperty({ enum: [2, 4, 6] })
  @IsIn([2, 4, 6])
  washesPerMonth: number;
}

/** washesPerMonth is fixed once a tariff exists, so existing schedules stay valid. */
export class UpdateTariffDto extends PartialType(OmitType(CreateTariffDto, ['washesPerMonth'] as const)) {}
