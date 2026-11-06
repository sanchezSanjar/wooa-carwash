import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy.js';
import { Role, Roles, RolesGuard } from '../common/roles.js';
import { CatalogService } from './catalog.service.js';
import { CreateExtraDto, CreateTariffDto, UpdateExtraDto, UpdateTariffDto } from './dto/catalog.dto.js';

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('tariffs')
  tariffs() {
    return this.catalog.listTariffs();
  }

  @Get('extras')
  extras() {
    return this.catalog.listExtras();
  }

  @Get('admin/tariffs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  allTariffs() {
    return this.catalog.listTariffs(true);
  }

  @Get('admin/extras')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  allExtras() {
    return this.catalog.listExtras(true);
  }

  @Post('tariffs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  createTariff(@Body() dto: CreateTariffDto) {
    return this.catalog.createTariff(dto);
  }

  @Patch('tariffs/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  updateTariff(@Param('id') id: string, @Body() dto: UpdateTariffDto) {
    return this.catalog.updateTariff(id, dto);
  }

  @Post('extras')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  createExtra(@Body() dto: CreateExtraDto) {
    return this.catalog.createExtra(dto);
  }

  @Patch('extras/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  updateExtra(@Param('id') id: string, @Body() dto: UpdateExtraDto) {
    return this.catalog.updateExtra(id, dto);
  }
}
