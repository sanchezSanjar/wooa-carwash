import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@app/common/enums';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles';
import type { AuthUser } from '../auth/roles';
import {
  AdminCreateMemberDto,
  AdminUpdateMemberDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }

  @Post('me/password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.users.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  // ---- admin: full control over every account ----

  @Get()
  @Roles(Role.Admin)
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, enum: Object.values(Role) })
  list(@Query('search') search?: string, @Query('role') role?: Role) {
    return this.users.list({ search, role: Object.values(Role).includes(role as Role) ? role : undefined });
  }

  @Post()
  @Roles(Role.Admin)
  create(@Body() dto: AdminCreateMemberDto) {
    return this.users.adminCreate(dto);
  }

  @Get(':id')
  @Roles(Role.Admin)
  async get(@Param('id') id: string) {
    return UsersService.toPublic(await this.users.getOrThrow(id), true);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  adminUpdate(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdateMemberDto) {
    return this.users.adminUpdate(id, dto, admin.userId);
  }
}
