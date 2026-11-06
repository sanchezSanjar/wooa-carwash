import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@app/common/enums';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles';
import type { AuthUser } from '../auth/roles';
import { MoveWashDto, SaveDaySheetDto } from './dto/daysheet.dto';
import { DaySheetsService } from './daysheets.service';

/**
 * Day sheets: the per-day workbook of cars to wash. Staff read it; admins rearrange and save it.
 * Saving a sheet never changes cars, members or subscriptions.
 */
@ApiTags('daysheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Washer)
@Controller('daysheets')
export class DaySheetsController {
  constructor(private readonly sheets: DaySheetsService) {}

  @Get('staff')
  staff() {
    return this.sheets.staff();
  }

  @Get(':date')
  get(@Param('date') date: string) {
    return this.sheets.get(date);
  }

  @Get(':date/candidates')
  @Roles(Role.Admin)
  candidates(@Param('date') date: string) {
    return this.sheets.candidates(date);
  }

  @Put(':date')
  @Roles(Role.Admin)
  save(@CurrentUser() user: AuthUser, @Param('date') date: string, @Body() dto: SaveDaySheetDto) {
    return this.sheets.save(user, date, dto.rows);
  }

  @Post(':date/move')
  @Roles(Role.Admin)
  move(@CurrentUser() user: AuthUser, @Param('date') date: string, @Body() dto: MoveWashDto) {
    return this.sheets.move(user, date, dto.subscriptionId, dto.scheduledDate, dto.toDate);
  }
}
