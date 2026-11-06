import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { addDays, today, weekday, weekdayOccurrence } from '@app/common/dates';

let mongo: MongoMemoryServer;
let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;

let kim: string;
let lee: string;
let admin: string;
let tariffs: { id: string; washesPerMonth: number; price: number }[];
let extras: { id: string; name: string; price: number }[];
let carId: string;
let subId: string;

const MON = 1;
const WED = 3;
const FRI = 5;
const sixTimes = [
  { weekday: MON, weeks: [1, 3] },
  { weekday: FRI, weeks: [1, 3] },
  { weekday: WED, weeks: [2, 4] },
];
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const register = async (email: string, apartmentName = 'Raemian Gwanggyo') => {
  const res = await request(http)
    .post('/auth/register')
    .send({ name: email.split('@')[0], email, password: 'password123', phone: '010-1111-2222', apartmentName })
    .expect(201);
  return res.body.accessToken as string;
};

const car = {
  plateNumber: '12가 3456',
  brand: 'Hyundai',
  model: 'Avante',
  color: 'White',
  buildingNumber: '101',
  parkingFloor: 'b2',
  arrivesHomeAt: '19:00',
  leavesForWorkAt: '07:30',
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('wooa-test');
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.ADMIN_EMAILS = 'boss@wooa.test';

  const { AppModule } = await import('../src/app.module');
  const { configureApp } = await import('../src/setup');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  http = app.getHttpServer();
}, 300_000);

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('members', () => {
  it('requires phone and apartment to register', async () => {
    await request(http)
      .post('/auth/register')
      .send({ name: 'x', email: 'x@wooa.test', password: 'password123' })
      .expect(400);
    kim = await register('kim@wooa.test');
    lee = await register('lee@wooa.test', 'Hillstate');
    admin = await register('boss@wooa.test');

    const me = await request(http).get('/auth/me').set(auth(kim)).expect(200);
    expect(me.body).toMatchObject({ phone: '010-1111-2222', apartmentName: 'Raemian Gwanggyo', role: 'customer' });
  });

  it('updates the profile', async () => {
    const res = await request(http)
      .patch('/members/me')
      .set(auth(kim))
      .send({ apartmentName: 'Raemian Gwanggyo 2' })
      .expect(200);
    expect(res.body.apartmentName).toBe('Raemian Gwanggyo 2');
  });
});

describe('catalog', () => {
  it('seeds tariffs and extras', async () => {
    tariffs = (await request(http).get('/tariffs').expect(200)).body;
    extras = (await request(http).get('/extras').expect(200)).body;
    expect(tariffs.map((t) => t.washesPerMonth)).toEqual([2, 4, 6]);
    expect(extras.map((e) => e.name)).toContain('Anti-rain polish');
  });

  it('only admins edit prices', async () => {
    await request(http).patch(`/extras/${extras[0].id}`).set(auth(kim)).send({ price: 1 }).expect(403);
    await request(http).patch(`/extras/${extras[0].id}`).set(auth(admin)).send({ price: 6000 }).expect(200);
    extras[0].price = 6000;
  });
});

describe('cars', () => {
  it('adds a car with its location and commute times', async () => {
    const res = await request(http).post('/cars').set(auth(kim)).send(car).expect(201);
    expect(res.body).toMatchObject({ plateNumber: '12가 3456', parkingFloor: 'B2', buildingNumber: '101' });
    carId = res.body.id;

    await request(http).post('/cars').set(auth(lee)).send(car).expect(409); // plate taken
    await request(http)
      .post('/cars')
      .set(auth(kim))
      .send({ ...car, plateNumber: '34나 5678', arrivesHomeAt: '7pm' })
      .expect(400);
    await request(http)
      .post('/cars')
      .set(auth(kim))
      .send({ ...car, plateNumber: '34나 5678', brand: 'Kia', model: 'K5', color: 'Black' })
      .expect(201);

    const mine = await request(http).get('/cars/me').set(auth(kim)).expect(200);
    expect(mine.body).toHaveLength(2);
    expect((await request(http).get('/cars/me').set(auth(lee)).expect(200)).body).toHaveLength(0);
    await request(http).patch(`/cars/${carId}`).set(auth(lee)).send({ color: 'Red' }).expect(404);
  });
});

describe('subscriptions', () => {
  it('validates the schedule against the tariff', async () => {
    const six = tariffs.find((t) => t.washesPerMonth === 6)!;
    const res = await request(http)
      .post('/subscriptions')
      .set(auth(kim))
      .send({ carId, tariffId: six.id, startDate: today(), schedule: [{ weekday: MON, weeks: [1, 3] }] })
      .expect(400);
    expect(res.body.message).toMatch(/6 washes per month/);

    await request(http)
      .post('/subscriptions')
      .set(auth(kim))
      .send({ carId, tariffId: six.id, startDate: addDays(today(), -1), schedule: sixTimes })
      .expect(400); // past start
  });

  it('subscribes a car with extras', async () => {
    const six = tariffs.find((t) => t.washesPerMonth === 6)!;
    const chosen = [extras[0], extras[2]];
    const res = await request(http)
      .post('/subscriptions')
      .set(auth(kim))
      .send({ carId, tariffId: six.id, startDate: today(), schedule: sixTimes, extraIds: chosen.map((e) => e.id) })
      .expect(201);
    subId = res.body.id;
    expect(res.body).toMatchObject({ status: 'active', washesPerMonth: 6, carId });
    expect(res.body.monthlyPrice).toBe(six.price + (chosen[0].price + chosen[1].price) * 6);
    expect(res.body.upcoming).toHaveLength(6);
    for (const d of res.body.upcoming as string[]) {
      const wd = weekday(d);
      const occ = weekdayOccurrence(d);
      expect(
        ((wd === MON || wd === FRI) && (occ === 1 || occ === 3)) || (wd === WED && (occ === 2 || occ === 4)),
      ).toBe(true);
    }

    await request(http)
      .post('/subscriptions')
      .set(auth(kim))
      .send({ carId, tariffId: six.id, startDate: today(), schedule: sixTimes })
      .expect(409); // already active
    await request(http)
      .post('/subscriptions')
      .set(auth(lee))
      .send({ carId, tariffId: six.id, startDate: today(), schedule: sixTimes })
      .expect(404); // not lee's car
    await request(http).delete(`/cars/${carId}`).set(auth(kim)).expect(409);
  });

  it('gives admins the day route and records outcomes', async () => {
    const mine = await request(http).get('/subscriptions/me').set(auth(kim)).expect(200);
    const washDay = mine.body[0].upcoming[0] as string;

    await request(http).get('/washes').query({ date: washDay }).set(auth(kim)).expect(403);
    const plan = await request(http).get('/washes').query({ date: washDay }).set(auth(admin)).expect(200);
    expect(plan.body).toHaveLength(1);
    expect(plan.body[0]).toMatchObject({
      status: 'planned',
      car: { plateNumber: '12가 3456', buildingNumber: '101', parkingFloor: 'B2', arrivesHomeAt: '19:00' },
      member: { apartmentName: 'Raemian Gwanggyo 2', phone: '010-1111-2222' },
    });
    expect(plan.body[0].extras).toHaveLength(2);

    await request(http)
      .patch('/washes')
      .set(auth(admin))
      .send({ subscriptionId: subId, date: washDay, status: 'done' })
      .expect(200);
    const notWashDay = addDays(washDay, 1);
    await request(http)
      .patch('/washes')
      .set(auth(admin))
      .send({ subscriptionId: subId, date: notWashDay, status: 'done' })
      .expect(400);

    const after = await request(http).get('/subscriptions/me').set(auth(kim)).expect(200);
    expect(after.body[0].history).toEqual([{ date: washDay, status: 'done', note: '' }]);

    // the member is told the car was washed
    const inbox = await request(http).get('/notifications/me').set(auth(kim)).expect(200);
    expect(inbox.body.unread).toBe(1);
    expect(inbox.body.items[0]).toMatchObject({ type: 'wash_done', title: '12가 3456 is washed', date: washDay });
    expect((await request(http).get('/notifications/me').set(auth(lee)).expect(200)).body.unread).toBe(0);
    await request(http).patch('/notifications/read-all').set(auth(kim)).expect(200);
    expect((await request(http).get('/notifications/me').set(auth(kim)).expect(200)).body.unread).toBe(0);
  });

  it('changes extras, cancels, then frees the car', async () => {
    const updated = await request(http)
      .patch(`/subscriptions/${subId}`)
      .set(auth(kim))
      .send({ extraIds: [] })
      .expect(200);
    expect(updated.body.monthlyPrice).toBe(tariffs.find((t) => t.washesPerMonth === 6)!.price);

    await request(http).patch(`/subscriptions/${subId}/cancel`).set(auth(lee)).expect(404);
    const cancelled = await request(http).patch(`/subscriptions/${subId}/cancel`).set(auth(kim)).expect(200);
    expect(cancelled.body).toMatchObject({ status: 'cancelled', upcoming: [] });

    await request(http).delete(`/cars/${carId}`).set(auth(kim)).expect(204);
  });
});
