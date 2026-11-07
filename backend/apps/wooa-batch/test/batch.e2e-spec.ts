import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import type { INestApplication } from '@nestjs/common';

import { Car } from '@app/common/schemas/car.schema';
import { DaySheet } from '@app/common/schemas/daysheet.schema';
import { Invoice } from '@app/common/schemas/invoice.schema';
import { SmsService } from '@app/common/sms/sms.service';
import { BillingJob } from '../src/jobs/billing.job';
import { WeatherJob } from '../src/jobs/weather.job';
import { Forecast } from '@app/common/schemas/forecast.schema';
import { Notification } from '@app/common/schemas/notification.schema';
import { Subscription, Wash } from '@app/common/schemas/subscription.schema';
import { User } from '@app/common/schemas/user.schema';
import { CLOSE_OUT_NOTE } from '../src/config';
import { CloseOutJob } from '../src/jobs/close-out.job';
import { WashReminderJob } from '../src/jobs/wash-reminder.job';

// November 2026: Monday the 2nd is the 1st Monday, Monday the 9th the 2nd.
const EVENING_BEFORE = new Date('2026-11-01T11:00:00Z'); // Sun Nov 1, 20:00 in Korea
const END_OF_WASH_DAY = new Date('2026-11-02T14:30:00Z'); // Mon Nov 2, 23:30 in Korea
const MONDAYS_1_3 = [{ weekday: 1, weeks: [1, 3] }];
const MONDAYS_2_4 = [{ weekday: 1, weeks: [2, 4] }];

let mongo: MongoMemoryServer;
let app: INestApplication;
let subs: Model<Subscription>;
let washes: Model<Wash>;
let notifications: Model<Notification>;
let due: Types.ObjectId;
let dueMarked: Types.ObjectId;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('wooa-batch-test');
  process.env.KMA_SERVICE_KEY = 'test-key';
  delete process.env.SOLAPI_API_KEY;
  const { BatchModule } = await import('../src/batch.module');
  const moduleRef = await Test.createTestingModule({ imports: [BatchModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  subs = app.get(getModelToken(Subscription.name));
  washes = app.get(getModelToken(Wash.name));
  notifications = app.get(getModelToken(Notification.name));
  const users = app.get<Model<User>>(getModelToken(User.name));
  const cars = app.get<Model<Car>>(getModelToken(Car.name));

  const member = await users.create({
    name: 'Kim',
    email: 'kim@wooa.test',
    phone: '010-1111-2222',
    apartmentName: 'Raemian',
    passwordHash: 'x',
  });
  const car = (plateNumber: string) =>
    cars.create({
      owner: member._id,
      plateNumber,
      brand: 'Hyundai',
      model: 'Avante',
      color: 'White',
      buildingNumber: '101',
      parkingFloor: 'B2',
      arrivesHomeAt: '19:00',
      leavesForWorkAt: '07:30',
    });
  const sub = async (plate: string, schedule: typeof MONDAYS_1_3, extra: Partial<Subscription> = {}) =>
    (
      await subs.create({
        member: member._id,
        car: (await car(plate))._id,
        tariff: new Types.ObjectId(),
        tariffName: 'Basic',
        washesPerMonth: 2,
        tariffPrice: 40000,
        extras: [{ extra: new Types.ObjectId(), name: 'Interior vacuuming', price: 5000 }],
        schedule,
        startDate: '2026-10-01',
        ...extra,
      })
    )._id;

  due = await sub('11가 1111', MONDAYS_1_3);
  dueMarked = await sub('22가 2222', MONDAYS_1_3);
  await sub('33가 3333', MONDAYS_2_4); // washed on the 9th, not the 2nd
  await sub('44가 4444', MONDAYS_1_3, { status: 'cancelled' });
  await sub('55가 5555', MONDAYS_1_3, { startDate: '2026-11-05' }); // not started yet
}, 300_000);

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('wash reminder job', () => {
  it('reminds only cars washed tomorrow, once', async () => {
    const job = app.get(WashReminderJob);
    expect(await job.run(EVENING_BEFORE)).toBe(2);
    expect(await job.run(EVENING_BEFORE)).toBe(0); // second run: no duplicates

    const sent = await notifications.find().sort({ title: 1 }).lean();
    expect(sent.map((n) => n.title)).toEqual(['내일 세차: 11가 1111', '내일 세차: 22가 2222']); // members read Korean by default
    expect(sent[0]).toMatchObject({ type: 'wash_reminder', date: '2026-11-02', read: false });
    expect(sent[0].body).toBe(
      '11월 2일 (월)에 101동 B2층 주차장에서 세차합니다. 추가 서비스: 실내 진공 청소.',
    );
  });
});

describe('close-out job', () => {
  it('marks unrecorded washes skipped and leaves recorded ones alone', async () => {
    await washes.create({ subscription: dueMarked, car: new Types.ObjectId(), date: '2026-11-02', status: 'done' });

    const job = app.get(CloseOutJob);
    expect(await job.run(END_OF_WASH_DAY)).toBe(1);
    expect(await job.run(END_OF_WASH_DAY)).toBe(0);

    const day = await washes.find({ date: '2026-11-02' }).lean();
    expect(day).toHaveLength(2);
    expect(day.find((w) => w.subscription.equals(due))).toMatchObject({ status: 'skipped', note: CLOSE_OUT_NOTE });
    expect(day.find((w) => w.subscription.equals(dueMarked))).toMatchObject({ status: 'done' });
  });
});

describe('jobs follow the day sheets', () => {
  it('skips a wash moved to another day and reminds it the evening before the new day', async () => {
    const sheets = app.get<Model<DaySheet>>(getModelToken(DaySheet.name));
    // Mon Nov 16 (3rd Monday) wash of `due` moved to Tue Nov 17
    await sheets.create({ date: '2026-11-17', rows: [{ subscription: due, scheduledDate: '2026-11-16', note: '' }] });

    const closeOut = app.get(CloseOutJob);
    const closed = await closeOut.run(new Date('2026-11-16T14:30:00Z')); // Nov 16, 23:30 Korea
    expect(closed).toBe(2); // dueMarked and 55가 5555 (started Nov 5); `due` was moved
    expect(await washes.exists({ subscription: due, date: '2026-11-16' })).toBeFalsy();

    const reminder = app.get(WashReminderJob);
    expect(await reminder.run(new Date('2026-11-16T11:00:00Z'))).toBe(1); // evening of Nov 16 → Nov 17 sheet
    const sent = await notifications.findOne({ subscription: due, date: '2026-11-16', type: 'wash_reminder' }).lean();
    expect(sent?.body).toMatch(/11월 17일 \(화\)/);

    // close-out on the new day marks it skipped with the day it was due to be washed
    expect(await closeOut.run(new Date('2026-11-17T14:30:00Z'))).toBe(1);
    expect(await washes.findOne({ subscription: due, date: '2026-11-16' }).lean()).toMatchObject({ status: 'skipped', washedOn: '2026-11-17' });
  });
});

describe('billing job', () => {
  const at = (date: string, hhmm = '09:00') => {
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h - 9, m)); // Korea time
  };

  it('issues one bill per active plan per month, prorating a late start', async () => {
    const invoices = app.get<Model<Invoice>>(getModelToken(Invoice.name));
    const sms = app.get(SmsService);
    const job = app.get(BillingJob);
    const smsBefore = sms.outbox.length;

    expect(await job.issue(at('2026-11-01'))).toBe(4); // the cancelled plan gets no bill
    expect(await job.issue(at('2026-11-02'))).toBe(0); // safe to run every day

    const bills = await invoices.find({ month: '2026-11' }).sort({ plateNumber: 1 }).lean();
    expect(bills.map((b) => b.plateNumber)).toEqual(['11가 1111', '22가 2222', '33가 3333', '55가 5555']);
    expect(bills[0]).toMatchObject({ amount: 50000, dueDate: '2026-11-10', status: 'unpaid' }); // 40,000 + 2 × 5,000
    // started Nov 5: only Mon Nov 16 is left of its two November washes
    expect(bills[3]).toMatchObject({ amount: 25000, lines: [{ label: 'Basic plan (1 of 2 washes)', amount: 20000 }, { amount: 5000 }] });
    expect(sms.outbox.length - smsBefore).toBe(4);
    expect(sms.outbox.at(-1)?.text).toMatch(/^\[우아세차\] .+ 차량의 11월 세차 요금은 .+원이며, 납부 기한은 11월 10일 \(화\)입니다/);
  });

  it('reminds before the due date once, and weekly while overdue', async () => {
    const invoices = app.get<Model<Invoice>>(getModelToken(Invoice.name));
    const job = app.get(BillingJob);
    expect(await job.remindDueSoon(at('2026-11-07', '10:00'))).toBe(4);
    expect(await job.remindDueSoon(at('2026-11-08', '10:00'))).toBe(0);

    await invoices.updateOne({ plateNumber: '22가 2222' }, { status: 'paid', paidAt: new Date() });
    expect(await job.remindOverdue(at('2026-11-10', '10:30'))).toBe(0); // due today: not overdue yet
    expect(await job.remindOverdue(at('2026-11-11', '10:30'))).toBe(3);
    expect(await job.remindOverdue(at('2026-11-14', '10:30'))).toBe(0); // within a week
    expect(await job.remindOverdue(at('2026-11-18', '10:30'))).toBe(3);

    const overdue = await notifications.find({ type: 'payment_overdue' }).lean();
    expect(overdue).toHaveLength(6);
    expect(overdue[0].body).toMatch(/이미 납부하셨다면/);
  });
});

describe('weather job', () => {
  const kma = (items: { category: string; fcstDate: string; fcstTime: string; fcstValue: string }[]) =>
    (async () => new Response(JSON.stringify({ response: { header: { resultCode: '00' }, body: { items: { item: items } } } }))) as unknown as typeof fetch;

  it('stores forecasts and warns members with a wash on a rainy tomorrow', async () => {
    const job = app.get(WeatherJob);
    const forecasts = app.get<Model<Forecast>>(getModelToken(Forecast.name));
    job.fetcher = kma([
      { category: 'POP', fcstDate: '20261102', fcstTime: '1200', fcstValue: '80' },
      { category: 'PTY', fcstDate: '20261102', fcstTime: '1200', fcstValue: '1' },
      { category: 'POP', fcstDate: '20261103', fcstTime: '1200', fcstValue: '10' },
    ]);
    const evening = new Date('2026-11-01T08:30:00Z'); // Sun Nov 1, 17:30 Korea
    expect(await job.refresh(evening)).toBe(2);
    expect(await forecasts.findOne({ date: '2026-11-02', grid: '60,127' }).lean()).toMatchObject({ pop: 80, precipitation: 'rain' });

    expect(await job.alert(evening)).toBe(2); // the two Monday Nov 2 washes
    expect(await job.alert(evening)).toBe(0); // once per wash
    const sent = await notifications.find({ type: 'weather_alert' }).lean();
    expect(sent[0].title).toBe('세차일 날씨: 비 예상 (80%)');

    expect(await job.alert(new Date('2026-11-02T08:30:00Z'))).toBe(0); // Tuesday is dry
  });
});
