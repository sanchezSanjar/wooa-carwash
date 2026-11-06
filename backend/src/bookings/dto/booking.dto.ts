import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BookingStatus } from '../schemas/booking.schema.js';

export class VehicleDto {
  @ApiProperty({ example: '12가 3456' })
  @IsString()
  @MaxLength(20)
  @Matches(/\S/, { message: 'plate must not be empty' })
  plate: string;

  @ApiPropertyOptional({ example: 'Hyundai Avante' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  model?: string;
}

export class CreateBookingDto {
  @ApiProperty()
  @IsMongoId()
  serviceId: string;

  @ApiProperty({ example: '2026-11-10T01:00:00.000Z', description: 'Slot start (ISO 8601)' })
  @IsDateString({ strict: true })
  startsAt: string;

  @ApiProperty({ type: VehicleDto })
  @ValidateNested()
  @Type(() => VehicleDto)
  vehicle: VehicleDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AvailabilityQueryDto {
  @ApiProperty({ example: '2026-11-10', description: 'Shop-local date YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiProperty()
  @IsMongoId()
  serviceId: string;
}

export class ListBookingsQueryDto {
  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({ enum: Object.values(BookingStatus) })
  @IsOptional()
  @IsIn(Object.values(BookingStatus))
  status?: BookingStatus;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: Object.values(BookingStatus) })
  @IsIn(Object.values(BookingStatus))
  status: BookingStatus;
}
