import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { addDays, today, weekday, weekdayOccurrence } from '@app/common/dates';
import { normalizePhone } from '@app/common/phone';
import { SmsService } from '@app/common/sms/sms.service';

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

let sms: SmsService;

/** The last SMS code sent to a phone (SMS runs in log-only mode in tests). */
const lastCode = (phone: string) => {
  const digits = normalizePhone(phone);
  const msg = [...sms.outbox].reverse().find((m) => m.to === digits);
  return msg?.text.match(/\d{6}/)?.[0] ?? '';
};

/** Full SMS sign-up: request code → verify → register. */
const register = async (name: string, phone: string, apartmentName = 'Raemian Gwanggyo') => {
  await request(http).post('/auth/otp/request').send({ phone, purpose: 'signup' }).expect(200);
  await request(http)
    .post('/auth/otp/verify')
    .send({ phone, purpose: 'signup', code: lastCode(phone) })
    .expect(200);
  const res = await request(http)
    .post('/auth/register')
    .send({ name, phone, password: 'password123', apartmentName })
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
  process.env.ADMIN_PHONES = '010-9999-0000';
  delete process.env.SOLAPI_API_KEY; // never send real SMS from tests

  const { AppModule } = await import('../src/app.module');
  const { configureApp } = await import('../src/setup');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  http = app.getHttpServer();
  sms = app.get(SmsService);
}, 300_000);

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('sms sign-up and login', () => {
  it('needs a verified phone to register', async () => {
    await request(http)
      .post('/auth/register')
      .send({ name: 'x', phone: '010-5555-6666', password: 'password123', apartmentName: 'A' })
      .expect(400);
    await request(http).post('/auth/otp/request').send({ phone: '010-5555-6666', purpose: 'signup' }).expect(200);
    const bad = await request(http)
      .post('/auth/otp/verify')
      .send({ phone: '010-5555-6666', purpose: 'signup', code: '000000' === lastCode('010-5555-6666') ? '111111' : '000000' })
      .expect(400);
    expect(bad.body.message).toMatch(/attempt/);
    await request(http).post('/auth/otp/request').send({ phone: '010-5555-6666', purpose: 'signup' }).expect(429); // cooldown
  });

  it('registers with phone, logs in with phone and password', async () => {
    kim = await register('Kim Minjun', '010-1111-2222');
    lee = await register('Lee Jiwoo', '+82 10 3333 4444', 'Hillstate');
    admin = await register('Boss', '010-9999-0000');

    const me = await request(http).get('/auth/me').set(auth(kim)).expect(200);
    expect(me.body).toMatchObject({ phone: '01011112222', apartmentName: 'Raemian Gwanggyo', role: 'customer' });
    expect((await request(http).get('/auth/me').set(auth(admin)).expect(200)).body.role).toBe('admin');

    await request(http).post('/auth/otp/request').send({ phone: '010-1111-2222', purpose: 'signup' }).expect(400); // taken
    await request(http).post('/auth/login').send({ phone: '01033334444', password: 'password123' }).expect(200);
    await request(http).post('/auth/login').send({ phone: '010-3333-4444', password: 'nope-nope' }).expect(401);
  });

  it('resets a forgotten password by SMS and logs out old sessions', async () => {
    const unknown = await request(http).post('/auth/otp/request').send({ phone: '010-7777-8888', purpose: 'reset' }).expect(200);
    const known = await request(http).post('/auth/otp/request').send({ phone: '010-3333-4444', purpose: 'reset' }).expect(200);
    expect(unknown.body.message).toBe(known.body.message); // does not reveal who has an account

    await new Promise((r) => setTimeout(r, 1100)); // new token is issued in a later second than the old one
    const verified = await request(http)
      .post('/auth/otp/verify')
      .send({ phone: '010-3333-4444', purpose: 'reset', code: lastCode('01033334444') })
      .expect(200);
    await request(http)
      .post('/auth/reset-password')
      .send({ resetToken: verified.body.resetToken, newPassword: 'brand-new-pass' })
      .expect(200);
    await request(http)
      .post('/auth/reset-password')
      .send({ resetToken: verified.body.resetToken, newPassword: 'again-again' })
      .expect(400); // one use only

    await request(http).get('/auth/me').set(auth(lee)).expect(401); // old token no longer works
    const login = await request(http).post('/auth/login').send({ phone: '010-3333-4444', password: 'brand-new-pass' }).expect(200);
    lee = login.body.accessToken;
  });
});

describe('members', () => {
  it('lets admins create, edit and block members', async () => {
    await request(http).get('/members').set(auth(kim)).expect(403);
    const created = await request(http)
      .post('/members')
      .set(auth(admin))
      .send({ name: 'Park Washer', phone: '010-4444-5555', apartmentName: 'Wooa', role: 'washer' })
      .expect(201);
    expect(created.body).toMatchObject({ role: 'washer', hasPassword: false });
    expect(sms.outbox.at(-1)?.text).toMatch(/Forgot password/);

    const list = await request(http).get('/members').query({ search: '4444' }).set(auth(admin)).expect(200);
    expect(list.body.map((m: { name: string }) => m.name)).toContain('Park Washer');

    await request(http).patch(`/members/${created.body.id}`).set(auth(admin)).send({ status: 'blocked' }).expect(200);
    const sentBefore = sms.outbox.length;
    await request(http).post('/auth/otp/request').send({ phone: '010-4444-5555', purpose: 'reset' }).expect(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(sms.outbox.length).toBe(sentBefore); // blocked: no code sent
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
      member: { apartmentName: 'Raemian Gwanggyo 2', phone: '01011112222' },
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
