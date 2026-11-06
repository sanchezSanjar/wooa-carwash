import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DATE_RE } from '@app/common/dates';
import { PhotoKind } from '@app/common/schemas/subscription.schema';

export class WashRefDto {
  @ApiProperty()
  @IsMongoId()
  subscriptionId: string;

  @ApiProperty({ example: '2026-11-09', description: 'Scheduled wash date' })
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date: string;
}

export class UploadPhotoDto extends WashRefDto {
  @ApiProperty({ enum: Object.values(PhotoKind) })
  @IsIn(Object.values(PhotoKind))
  kind: PhotoKind;

  @ApiPropertyOptional({ example: 'Scratch on rear bumper' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class ReviewDto extends WashRefDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Spotless, thank you!' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
