import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DATE_RE } from '@app/common/dates';

export class ScheduleDayDto {
  @ApiProperty({ example: 1, description: '0 = Sunday … 6 = Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty({ example: [1, 3], description: 'Which occurrences in the month: [1,3], [2,4] or [1,2,3,4]' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4, { each: true })
  weeks: number[];
}

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsMongoId()
  carId: string;

  @ApiProperty()
  @IsMongoId()
  tariffId: string;

  @ApiProperty({ example: '2026-11-09', description: 'First day of the subscription (YYYY-MM-DD)' })
  @Matches(DATE_RE, { message: 'startDate must be YYYY-MM-DD' })
  startDate: string;

  @ApiProperty({ type: [ScheduleDayDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedule: ScheduleDayDto[];

  @ApiPropertyOptional({ type: [String], description: 'Extra service ids done with every wash' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  extraIds?: string[];
}

export class ChangeTariffDto {
  @ApiProperty()
  @IsMongoId()
  tariffId: string;

  @ApiProperty({ type: [ScheduleDayDto], description: 'Wash days that fit the new tariff' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedule: ScheduleDayDto[];
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ type: [ScheduleDayDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  schedule?: ScheduleDayDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  extraIds?: string[];
}

export class DayQueryDto {
  @ApiProperty({ example: '2026-11-09' })
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date: string;
}

export class SetWashStatusDto {
  @ApiProperty()
  @IsMongoId()
  subscriptionId: string;

  @ApiProperty({ example: '2026-11-09' })
  @Matches(DATE_RE, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @ApiPropertyOptional({ example: '2026-11-11', description: 'Day the car was actually washed, when moved on a day sheet' })
  @IsOptional()
  @Matches(DATE_RE, { message: 'washedOn must be YYYY-MM-DD' })
  washedOn?: string;

  @ApiProperty({ enum: ['planned', 'done', 'skipped'], description: 'planned clears a recorded outcome' })
  @IsIn(['planned', 'done', 'skipped'])
  status: 'planned' | 'done' | 'skipped';

  @ApiPropertyOptional({ example: 'Car was not in its spot' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
