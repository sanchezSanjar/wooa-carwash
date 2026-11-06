import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser } from '../auth/roles';
import type { AuthUser } from '../auth/roles';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CarsService } from './cars.service';
import { CreateCarDto, UpdateCarDto } from './dto/car.dto';

@ApiTags('cars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cars')
export class CarsController {
  constructor(
    private readonly cars: CarsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.cars.listMine(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCarDto) {
    return this.cars.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCarDto) {
    return this.cars.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const car = await this.cars.findAccessible(user, id);
    if (await this.subscriptions.hasActiveForCar(car.id)) {
      throw new ConflictException('Cancel this car’s subscription before removing it');
    }
    await this.cars.remove(user, id);
  }
}
