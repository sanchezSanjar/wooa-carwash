import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addDays, today } from '@app/common/dates';
import { NotificationText, smsText } from '@app/common/notify';
import { washesForDate } from '@app/common/planner';
import { CarDocument } from '@app/common/schemas/car.schema';
import { DaySheet } from '@app/common/schemas/daysheet.schema';
import { Forecast } from '@app/common/schemas/forecast.schema';
import { Notification, NotificationType } from '@app/common/schemas/notification.schema';
import { Subscription } from '@app/common/schemas/subscription.schema';
import { UserDocument } from '@app/common/schemas/user.schema';
import { SmsService } from '@app/common/sms/sms.service';
import { allGrids, gridFor, parseGrid, readGrids, type GridConfig } from '@app/common/weather/grids';
import { fetchForecast, isWet } from '@app/common/weather/kma';

/**
 * Weather from the Korea Meteorological Administration:
 * - refresh: stores the next days' forecast per grid (shown on the admin day sheets);
 * - alert: members with a wash tomorrow are told when rain or snow is likely.
 * Without KMA_SERVICE_KEY both steps are skipped.
 */
@Injectable()
export class WeatherJob {
  private readonly logger = new Logger('WeatherJob');
  private readonly key?: string;
  private readonly grids: GridConfig;
  private readonly threshold: number;
  private readonly sendSms: boolean;
  /** Replaceable in tests. */
  fetcher: typeof fetch = (...args) => fetch(...args);

  constructor(
    @InjectModel(Forecast.name) private readonly forecasts: Model<Forecast>,
    @InjectModel(Subscription.name) private readonly subs: Model<Subscription>,
    @InjectModel(DaySheet.name) private readonly sheets: Model<DaySheet>,
    @InjectModel(Notification.name) private readonly notifications: Model<Notification>,
    private readonly sms: SmsService,
    config: ConfigService,
  ) {
    this.key = config.get<string>('KMA_SERVICE_KEY')?.trim() || undefined;
    this.grids = readGrids({ WEATHER_GRID: config.get('WEATHER_GRID'), WEATHER_GRIDS: config.get('WEATHER_GRIDS') });
    this.threshold = Number(config.get('WEATHER_RAIN_POP') ?? 60) || 60;
    this.sendSms = config.get('WEATHER_SMS') === 'true';
  }

  /** Saves the forecast for every configured grid. Returns how many day forecasts were stored. */
  async refresh(now = new Date()): Promise<number> {
    if (!this.key) {
      this.logger.warn('KMA_SERVICE_KEY is missing in .env: weather is skipped');
      return 0;
    }
    let saved = 0;
    for (const grid of allGrids(this.grids)) {
      try {
        const days = await fetchForecast(this.key, parseGrid(grid), now, this.fetcher);
        for (const d of days) {
          await this.forecasts.updateOne({ date: d.date, grid }, { $set: { ...d, grid } }, { upsert: true });
          saved++;
        }
      } catch (err) {
        this.logger.error(`Forecast for grid ${grid} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return saved;
  }

  /** Warns members whose car is washed tomorrow when rain or snow is likely. Returns how many. */
  async alert(now = new Date()): Promise<number> {
    if (!this.key) return 0;
    const tomorrow = addDays(today(now), 1);
    const forecasts = new Map(
      (await this.forecasts.find({ date: tomorrow }).lean().exec()).map((f) => [f.grid, f]),
    );
    if (forecasts.size === 0) return 0;

    const { rows } = await washesForDate(tomorrow, { subs: this.subs, sheets: this.sheets });
    const subs = await this.subs
      .find({ _id: { $in: rows.map((r) => r.subscription) } })
      .populate('car', 'plateNumber')
      .populate('member', 'phone apartmentName language')
      .exec();
    const byId = new Map(subs.map((s) => [s.id as string, s]));

    let alerted = 0;
    for (const row of rows) {
      const sub = byId.get(row.subscription.toString());
      const member = sub?.member as unknown as UserDocument | null;
      const car = sub?.car as unknown as CarDocument | null;
      if (!sub || !member || !car) continue;
      const forecast = forecasts.get(gridFor(this.grids, member.apartmentName));
      if (!forecast || !isWet({ pop: forecast.pop, precipitation: forecast.precipitation as never }, this.threshold)) continue;

      const text = NotificationText.weather(car, tomorrow, forecast, member.language ?? 'ko');
      const res = await this.notifications.updateOne(
        { subscription: sub._id, date: row.scheduledDate, type: NotificationType.WeatherAlert },
        { $setOnInsert: { member: member._id, ...text, read: false } },
        { upsert: true },
      );
      if (!res.upsertedCount) continue;
      alerted++;
      if (this.sendSms && member.phone) {
        await this.sms.send(member.phone, smsText(text, member.language ?? 'ko')).catch(() => undefined);
      }
    }
    return alerted;
  }
}
