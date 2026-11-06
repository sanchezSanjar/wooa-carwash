import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DATE_RE } from '@app/common/dates';

export class DaySheetRowDto {
  @ApiProperty()
  @IsMongoId()
  subscriptionId: string;

  @ApiProperty({ example: '2026-11-09', description: "The wash's date in the car's schedule" })
  @Matches(DATE_RE, { message: 'scheduledDate must be YYYY-MM-DD' })
  scheduledDate: string;

  @ApiPropertyOptional({ description: 'Washer (staff member) doing this car' })
  @IsOptional()
  @IsMongoId()
  washerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class SaveDaySheetDto {
  @ApiProperty({ type: [DaySheetRowDto], description: 'Rows in washing order' })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => DaySheetRowDto)
  rows: DaySheetRowDto[];
}

export class MoveWashDto {
  @ApiProperty()
  @IsMongoId()
  subscriptionId: string;

  @ApiProperty({ example: '2026-11-09' })
  @Matches(DATE_RE, { message: 'scheduledDate must be YYYY-MM-DD' })
  scheduledDate: string;

  @ApiProperty({ example: '2026-11-11', description: 'Day sheet to move the car to' })
  @Matches(DATE_RE, { message: 'toDate must be YYYY-MM-DD' })
  toDate: string;
}
