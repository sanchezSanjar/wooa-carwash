import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy.js';
import { CurrentUser, Role, Roles, RolesGuard } from '../common/roles.js';
import type { AuthUser } from '../common/roles.js';
import {
  CreateSubscriptionDto,
  DayQueryDto,
  SetWashStatusDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto.js';
import { SubscriptionsService } from './subscriptions.service.js';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubscriptionDto) {
    return this.subs.create(user, dto);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.subs.listMine(user);
  }

  @Get()
  @Roles(Role.Admin)
  all() {
    return this.subs.listAll();
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subs.update(user, id, dto);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.subs.cancel(user, id);
  }
}

@ApiTags('washes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@Controller('washes')
export class WashesController {
  constructor(private readonly subs: SubscriptionsService) {}

  /** The day's wash route: every scheduled car with its location and outcome. */
  @Get()
  day(@Query() query: DayQueryDto) {
    return this.subs.dayPlan(query.date);
  }

  @Patch()
  setStatus(@CurrentUser() user: AuthUser, @Body() dto: SetWashStatusDto) {
    return this.subs.setWashStatus(user, dto);
  }
}
