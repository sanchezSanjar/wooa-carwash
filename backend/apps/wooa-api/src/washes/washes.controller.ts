import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@app/common/enums';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { CurrentUser, Roles, RolesGuard } from '../auth/roles';
import type { AuthUser } from '../auth/roles';
import { ReviewDto, UploadPhotoDto, WashRefDto } from './dto/wash.dto';
import { WashesService } from './washes.service';

const MAX_UPLOAD = 15 * 1024 * 1024;

@ApiTags('washes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('washes')
export class WashPhotosController {
  constructor(private readonly washes: WashesService) {}

  /** One wash with its photos and review (staff: any car, member: own cars). */
  @Get('detail')
  detail(@CurrentUser() user: AuthUser, @Query() ref: WashRefDto) {
    return this.washes.detail(user, ref);
  }

  @Post('photos')
  @Roles(Role.Washer)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subscriptionId', 'date', 'kind', 'file'],
      properties: {
        subscriptionId: { type: 'string' },
        date: { type: 'string', example: '2026-11-09' },
        kind: { type: 'string', enum: ['before', 'after'] },
        note: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @Body() dto: UploadPhotoDto, @UploadedFile() file?: Express.Multer.File) {
    return this.washes.uploadPhoto(user, dto, file);
  }

  @Delete('photos/:id')
  @Roles(Role.Washer)
  @HttpCode(204)
  async deletePhoto(@Param('id') id: string) {
    await this.washes.deletePhoto(id);
  }

  @Put('review')
  review(@CurrentUser() user: AuthUser, @Body() dto: ReviewDto) {
    return this.washes.review(user, dto);
  }

  @Get('reviews')
  @Roles(Role.Admin)
  reviews() {
    return this.washes.recentReviews();
  }
}
