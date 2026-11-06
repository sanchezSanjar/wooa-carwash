import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { today } from '@app/common/dates';

@ApiTags('health')
@Controller()
export class AppController {
  @Get()
  health() {
    return { status: 'ok', name: 'wooa-carwash-api', today: today(), timezone: 'Asia/Seoul' };
  }
}
