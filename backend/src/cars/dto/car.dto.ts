import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { TIME_RE } from '../../common/dates.js';

const NOT_EMPTY = /\S/;

export class CreateCarDto {
  @ApiProperty({ example: '12가 3456' })
  @IsString()
  @MaxLength(20)
  @Matches(NOT_EMPTY, { message: 'plateNumber must not be empty' })
  plateNumber: string;

  @ApiProperty({ example: 'Hyundai' })
  @IsString()
  @MaxLength(40)
  @Matches(NOT_EMPTY, { message: 'brand must not be empty' })
  brand: string;

  @ApiProperty({ example: 'Avante' })
  @IsString()
  @MaxLength(40)
  @Matches(NOT_EMPTY, { message: 'model must not be empty' })
  model: string;

  @ApiProperty({ example: 'White' })
  @IsString()
  @MaxLength(30)
  @Matches(NOT_EMPTY, { message: 'color must not be empty' })
  color: string;

  @ApiProperty({ example: '101', description: 'Building (dong) number' })
  @IsString()
  @MaxLength(10)
  @Matches(NOT_EMPTY, { message: 'buildingNumber must not be empty' })
  buildingNumber: string;

  @ApiProperty({ example: 'B2', description: 'Parking floor' })
  @IsString()
  @MaxLength(10)
  @Matches(NOT_EMPTY, { message: 'parkingFloor must not be empty' })
  parkingFloor: string;

  @ApiProperty({ example: '19:00', description: 'Usually back home at (HH:mm)' })
  @Matches(TIME_RE, { message: 'arrivesHomeAt must be a time like 19:00' })
  arrivesHomeAt: string;

  @ApiProperty({ example: '07:30', description: 'Usually leaves for work at (HH:mm)' })
  @Matches(TIME_RE, { message: 'leavesForWorkAt must be a time like 07:30' })
  leavesForWorkAt: string;
}

export class UpdateCarDto extends PartialType(CreateCarDto) {}
