import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BUSINESS } from './common/business-hours.js';

@ApiTags('health')
@Controller()
export class AppController {
  @Get()
  health() {
    return { status: 'ok', name: 'wooa-carwash-api' };
  }

  @Get('info')
  info() {
    const fmt = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return {
      opensAt: fmt(BUSINESS.openMinute),
      closesAt: fmt(BUSINESS.closeMinute),
      timezone: 'Asia/Seoul',
      bookingWindowDays: BUSINESS.bookingWindowDays,
    };
  }
}
