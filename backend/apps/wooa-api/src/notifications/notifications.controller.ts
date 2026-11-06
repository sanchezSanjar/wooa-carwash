import { Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser } from '../auth/roles';
import type { AuthUser } from '../auth/roles';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthUser) {
    return this.notifications.listMine(user);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }
}
