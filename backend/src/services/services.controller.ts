import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy.js';
import { Role, Roles, RolesGuard } from '../common/roles.js';
import { CreateWashServiceDto, UpdateWashServiceDto } from './dto/wash-service.dto.js';
import { ServicesService } from './services.service.js';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list() {
    return this.services.list();
  }

  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  listAll() {
    return this.services.list(true);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ServicesService.toPublic(await this.services.get(id));
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  create(@Body() dto: CreateWashServiceDto) {
    return this.services.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  update(@Param('id') id: string, @Body() dto: UpdateWashServiceDto) {
    return this.services.update(id, dto);
  }
}
