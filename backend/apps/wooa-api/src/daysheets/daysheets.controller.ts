import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@app/common/enums';
import type { Lang } from '@app/common/i18n';
import { ReqLang } from '../i18n';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles';
import type { AuthUser } from '../auth/roles';
import { ApplyImportDto, MoveWashDto, SaveDaySheetDto } from './dto/daysheet.dto';
import { DaySheetsXlsxService } from './daysheets-xlsx.service';
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
  constructor(
    private readonly sheets: DaySheetsService,
    private readonly xlsx: DaySheetsXlsxService,
  ) {}

  /** Excel workbook of day sheets, one tab per day (at most 14). */
  @Get('export')
  @Roles(Role.Admin)
  @ApiQuery({ name: 'from', example: '2026-11-07' })
  @ApiQuery({ name: 'days', required: false, example: 1 })
  async export(@ReqLang() lang: Lang, @Query('from') from: string, @Query('days') days?: string) {
    const { filename, buffer } = await this.xlsx.export(from, Number(days ?? 1), lang);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /** Reads an edited workbook and lists what it would change. Saves nothing. */
  @Post('import/preview')
  @Roles(Role.Admin)
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  previewImport(@ReqLang() lang: Lang, @UploadedFile() file?: Express.Multer.File) {
    return this.xlsx.preview(file, lang);
  }

  /** Saves the day sheets of a preview. */
  @Post('import/apply')
  @Roles(Role.Admin)
  @HttpCode(200)
  applyImport(@CurrentUser() user: AuthUser, @Body() dto: ApplyImportDto) {
    return this.xlsx.apply(user, dto.plan);
  }

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
