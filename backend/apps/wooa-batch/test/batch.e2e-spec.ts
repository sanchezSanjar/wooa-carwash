import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import type { INestApplication } from '@nestjs/common';

import { Car } from '@app/common/schemas/car.schema';
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
    expect(sent.map((n) => n.title)).toEqual(['Wash tomorrow: 11가 1111', 'Wash tomorrow: 22가 2222']);
    expect(sent[0]).toMatchObject({ type: 'wash_reminder', date: '2026-11-02', read: false });
    expect(sent[0].body).toBe(
      'We wash your car on Mon, Nov 2 in building 101, floor B2. Extras: interior vacuuming.',
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
