import { Controller, Get, Logger } from '@nestjs/common';
import { Cron, Timeout } from '@nestjs/schedule';
import { BATCH_CLOSE_OUT, BATCH_TIMEZONE, BATCH_WASH_REMINDER } from './config';
import { CloseOutJob } from './jobs/close-out.job';
import { WashReminderJob } from './jobs/wash-reminder.job';

/**
 * Scheduled jobs (cron: second minute hour day month weekday, Korea time).
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
  ) {}

  @Get()
  health() {
    return { status: 'ok', name: 'wooa-carwash-batch', jobs: [BATCH_WASH_REMINDER, BATCH_CLOSE_OUT] };
  }

  @Timeout(1000)
  ready(): void {
    this.logger.log('BATCH SERVER IS READY');
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
