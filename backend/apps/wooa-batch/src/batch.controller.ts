import { Controller, Get, Logger } from '@nestjs/common';
import { Cron, Timeout } from '@nestjs/schedule';
import {
  BATCH_BILLING_ISSUE,
  BATCH_CLOSE_OUT,
  BATCH_PAYMENT_DUE,
  BATCH_PAYMENT_OVERDUE,
  BATCH_TIMEZONE,
  BATCH_WASH_REMINDER,
  BATCH_WEATHER_ALERT,
  BATCH_WEATHER_REFRESH,
} from './config';
import { BillingJob } from './jobs/billing.job';
import { CloseOutJob } from './jobs/close-out.job';
import { WeatherJob } from './jobs/weather.job';
import { WashReminderJob } from './jobs/wash-reminder.job';

/**
 * Scheduled jobs (cron: second minute hour day month weekday, Korea time).
 * - 09:00 issue this month's bills (only those still missing)
 * - 10:00 remind bills due in 3 days, 10:30 remind overdue bills (weekly)
 * - 05:30 and 17:30 weather forecast refresh, 17:45 rain alerts for tomorrow's washes
 * - 20:00 wash reminders for tomorrow's washes
 * - 23:30 close out today's washes nobody marked
 * A failing job is logged and never stops the others; a job still running skips its next tick.
 */
@Controller()
export class BatchController {
  private readonly logger = new Logger('BatchController');
  private readonly running = new Set<string>();

  constructor(
    private readonly reminder: WashReminderJob,
    private readonly closeOut: CloseOutJob,
    private readonly billing: BillingJob,
    private readonly weather: WeatherJob,
  ) {}

  @Get()
  health() {
    return { status: 'ok', name: 'wooa-carwash-batch', jobs: [BATCH_BILLING_ISSUE, BATCH_PAYMENT_DUE, BATCH_PAYMENT_OVERDUE, BATCH_WEATHER_REFRESH, BATCH_WEATHER_ALERT, BATCH_WASH_REMINDER, BATCH_CLOSE_OUT] };
  }

  @Timeout(1000)
  ready(): void {
    this.logger.log('BATCH SERVER IS READY');
  }

  @Cron('00 00 09 * * *', { name: BATCH_BILLING_ISSUE, timeZone: BATCH_TIMEZONE })
  async issueBills(): Promise<void> {
    await this.run(BATCH_BILLING_ISSUE, () => this.billing.issue());
  }

  @Cron('00 00 10 * * *', { name: BATCH_PAYMENT_DUE, timeZone: BATCH_TIMEZONE })
  async paymentDue(): Promise<void> {
    await this.run(BATCH_PAYMENT_DUE, () => this.billing.remindDueSoon());
  }

  @Cron('00 30 10 * * *', { name: BATCH_PAYMENT_OVERDUE, timeZone: BATCH_TIMEZONE })
  async paymentOverdue(): Promise<void> {
    await this.run(BATCH_PAYMENT_OVERDUE, () => this.billing.remindOverdue());
  }

  @Cron('00 30 05,17 * * *', { name: BATCH_WEATHER_REFRESH, timeZone: BATCH_TIMEZONE })
  async weatherRefresh(): Promise<void> {
    await this.run(BATCH_WEATHER_REFRESH, () => this.weather.refresh());
  }

  @Cron('00 45 17 * * *', { name: BATCH_WEATHER_ALERT, timeZone: BATCH_TIMEZONE })
  async weatherAlert(): Promise<void> {
    await this.run(BATCH_WEATHER_ALERT, () => this.weather.alert());
  }

  @Cron('00 00 20 * * *', { name: BATCH_WASH_REMINDER, timeZone: BATCH_TIMEZONE })
  async washReminder(): Promise<void> {
    await this.run(BATCH_WASH_REMINDER, () => this.reminder.run());
  }

  @Cron('00 30 23 * * *', { name: BATCH_CLOSE_OUT, timeZone: BATCH_TIMEZONE })
  async closeOutDay(): Promise<void> {
    await this.run(BATCH_CLOSE_OUT, () => this.closeOut.run());
  }

  private async run(name: string, job: () => Promise<number>): Promise<void> {
    if (this.running.has(name)) {
      this.logger.warn(`${name} is still running, skipped this tick`);
      return;
    }
    this.running.add(name);
    const started = Date.now();
    try {
      const count = await job();
      this.logger.log(`${name} done: ${count} in ${Date.now() - started} ms`);
    } catch (err) {
      this.logger.error(`${name} failed`, err instanceof Error ? err.stack : String(err));
    } finally {
      this.running.delete(name);
    }
  }
}
