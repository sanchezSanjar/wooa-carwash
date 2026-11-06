import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser } from '../auth/roles';
import type { AuthUser } from '../auth/roles';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('members')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.userId, dto);
  }
}
