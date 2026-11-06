import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import sharp from 'sharp';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { addDays, today, weekday, weekdayOccurrence } from '@app/common/dates';
import { normalizePhone } from '@app/common/phone';
import { SmsService } from '@app/common/sms/sms.service';
import { Invoice } from '@app/common/schemas/invoice.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';

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
let doneDay: string;

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
  process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'wooa-uploads-'));
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
    expect(after.body[0].history).toEqual([{ date: washDay, status: 'done', note: '', photos: 0, rating: null }]);
    doneDay = washDay;

    // the member is told the car was washed
    const inbox = await request(http).get('/notifications/me').set(auth(kim)).expect(200);
    expect(inbox.body.unread).toBe(1);
    expect(inbox.body.items[0]).toMatchObject({ type: 'wash_done', title: '12가 3456 is washed', date: washDay });
    expect((await request(http).get('/notifications/me').set(auth(lee)).expect(200)).body.unread).toBe(0);
    await request(http).patch('/notifications/read-all').set(auth(kim)).expect(200);
    expect((await request(http).get('/notifications/me').set(auth(kim)).expect(200)).body.unread).toBe(0);
  });

  it('lets washers add before/after photos that the owner can see', async () => {
    const washer = await request(http)
      .post('/members')
      .set(auth(admin))
      .send({ name: 'Choi Washer', phone: '010-6666-7777', apartmentName: 'Wooa', role: 'washer', password: 'washer-pass-1' })
      .expect(201);
    expect(washer.body.hasPassword).toBe(true);
    const washerToken = (
      await request(http).post('/auth/login').send({ phone: '010-6666-7777', password: 'washer-pass-1' }).expect(200)
    ).body.accessToken;

    await request(http).get('/washes').query({ date: doneDay }).set(auth(washerToken)).expect(200); // route
    await request(http).get('/members').set(auth(washerToken)).expect(403); // not member data
    await request(http).patch(`/tariffs/${tariffs[0].id}`).set(auth(washerToken)).send({ price: 1 }).expect(403);

    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#3366cc' } }).png().toBuffer();
    const upload = (token: string, kind: string) =>
      request(http)
        .post('/washes/photos')
        .set(auth(token))
        .field('subscriptionId', subId)
        .field('date', doneDay)
        .field('kind', kind)
        .field('note', kind === 'before' ? 'Scratch on rear bumper' : '')
        .attach('file', png, 'car.png');
    await upload(kim, 'before').expect(403); // members cannot upload
    const before = await upload(washerToken, 'before').expect(201);
    await upload(washerToken, 'after').expect(201);
    expect(before.body.url).toMatch(/^\/uploads\/washes\/.+\.jpg$/);
    await request(http).get(before.body.url).expect(200).expect('content-type', /image\/jpeg/);

    const detail = await request(http)
      .get('/washes/detail')
      .query({ subscriptionId: subId, date: doneDay })
      .set(auth(kim))
      .expect(200);
    expect(detail.body.photos.map((p: { kind: string }) => p.kind)).toEqual(['before', 'after']);
    expect(detail.body.photos[0].note).toBe('Scratch on rear bumper');
    expect(detail.body.canReview).toBe(true);
    await request(http).get('/washes/detail').query({ subscriptionId: subId, date: doneDay }).set(auth(lee)).expect(404);

    await request(http).delete(`/washes/photos/${detail.body.photos[1].id}`).set(auth(washerToken)).expect(204);
  });

  it('lets the owner rate a finished wash', async () => {
    const ref = { subscriptionId: subId, date: doneDay };
    await request(http).put('/washes/review').set(auth(kim)).send({ ...ref, rating: 6 }).expect(400);
    await request(http).put('/washes/review').set(auth(lee)).send({ ...ref, rating: 5 }).expect(404);
    const review = await request(http)
      .put('/washes/review')
      .set(auth(kim))
      .send({ ...ref, rating: 5, comment: 'Spotless!' })
      .expect(200);
    expect(review.body).toMatchObject({ rating: 5, comment: 'Spotless!' });

    const reviews = await request(http).get('/washes/reviews').set(auth(admin)).expect(200);
    expect(reviews.body[0]).toMatchObject({ plateNumber: '12가 3456', memberName: 'Kim Minjun', review: { rating: 5 } });
    const mine = await request(http).get('/subscriptions/me').set(auth(kim)).expect(200);
    expect(mine.body[0].history[0]).toMatchObject({ photos: 1, rating: 5 });
  });

  it('lets members change their tariff', async () => {
    const basic = tariffs.find((t) => t.washesPerMonth === 2)!;
    await request(http)
      .patch(`/subscriptions/${subId}/tariff`)
      .set(auth(kim))
      .send({ tariffId: basic.id, schedule: sixTimes })
      .expect(400); // 6 washes don't fit a 2-wash tariff
    const changed = await request(http)
      .patch(`/subscriptions/${subId}/tariff`)
      .set(auth(kim))
      .send({ tariffId: basic.id, schedule: [{ weekday: MON, weeks: [2, 4] }] })
      .expect(200);
    expect(changed.body).toMatchObject({ tariffName: 'Basic', washesPerMonth: 2 });
    await request(http)
      .patch(`/subscriptions/${subId}/tariff`)
      .set(auth(lee))
      .send({ tariffId: basic.id, schedule: [{ weekday: MON, weeks: [2, 4] }] })
      .expect(404);
  });

  it('changes extras, cancels, then frees the car', async () => {
    const updated = await request(http)
      .patch(`/subscriptions/${subId}`)
      .set(auth(kim))
      .send({ extraIds: [] })
      .expect(200);
    expect(updated.body.monthlyPrice).toBe(tariffs.find((t) => t.washesPerMonth === 2)!.price);

    await request(http).patch(`/subscriptions/${subId}/cancel`).set(auth(lee)).expect(404);
    const cancelled = await request(http).patch(`/subscriptions/${subId}/cancel`).set(auth(kim)).expect(200);
    expect(cancelled.body).toMatchObject({ status: 'cancelled', upcoming: [] });

    await request(http).delete(`/cars/${carId}`).set(auth(kim)).expect(204);
  });
});

describe('day sheets', () => {
  let day: string;
  let next: string;
  let leeSub: string;
  let washerToken: string;

  it('builds a draft sheet from the schedule', async () => {
    // first date from today whose weekday occurrence is 1-4 (washed by an every-week plan)
    day = today();
    while (weekdayOccurrence(day) > 4) day = addDays(day, 1);
    next = addDays(day, 1);

    const standard = tariffs.find((t) => t.washesPerMonth === 4)!;
    const leeCar = await request(http)
      .post('/cars')
      .set(auth(lee))
      .send({ ...car, plateNumber: '77다 7777', buildingNumber: '203', parkingFloor: 'B1' })
      .expect(201);
    leeSub = (
      await request(http)
        .post('/subscriptions')
        .set(auth(lee))
        .send({ carId: leeCar.body.id, tariffId: standard.id, startDate: today(), schedule: [{ weekday: weekday(day), weeks: [1, 2, 3, 4] }] })
        .expect(201)
    ).body.id;

    washerToken = (await request(http).post('/auth/login').send({ phone: '010-6666-7777', password: 'washer-pass-1' }).expect(200)).body.accessToken;

    const sheet = await request(http).get(`/daysheets/${day}`).set(auth(washerToken)).expect(200);
    expect(sheet.body.saved).toBe(false);
    const row = sheet.body.rows.find((r: { subscriptionId: string }) => r.subscriptionId === leeSub);
    expect(row).toMatchObject({ scheduledDate: day, moved: false, status: 'planned', car: { plateNumber: '77다 7777' } });

    await request(http).get(`/daysheets/${day}`).set(auth(kim)).expect(403);
    await request(http).put(`/daysheets/${day}`).set(auth(washerToken)).send({ rows: [] }).expect(403);
    const staff = await request(http).get('/daysheets/staff').set(auth(admin)).expect(200);
    expect(staff.body.map((s: { name: string }) => s.name)).toEqual(expect.arrayContaining(['Boss', 'Choi Washer']));
  });

  it('moves a car to another day and back without touching its plan', async () => {
    const moved = await request(http)
      .post(`/daysheets/${day}/move`)
      .set(auth(admin))
      .send({ subscriptionId: leeSub, scheduledDate: day, toDate: next })
      .expect(201);
    expect(moved.body.from.rows.some((r: { subscriptionId: string }) => r.subscriptionId === leeSub)).toBe(false);
    expect(moved.body.to.rows.find((r: { subscriptionId: string }) => r.subscriptionId === leeSub)).toMatchObject({
      scheduledDate: day,
      moved: true,
    });

    const candidates = await request(http).get(`/daysheets/${day}/candidates`).set(auth(admin)).expect(200);
    const back = candidates.body.find((c: { subscriptionId: string; scheduledDate: string }) => c.subscriptionId === leeSub && c.scheduledDate === day);
    expect(back).toBeTruthy();

    // put it back on its own day with a washer and a note: removed from the other sheet automatically
    const washerId = (await request(http).get('/daysheets/staff').set(auth(admin)).expect(200)).body.find(
      (s: { name: string }) => s.name === 'Choi Washer',
    ).id;
    const saved = await request(http)
      .put(`/daysheets/${day}`)
      .set(auth(admin))
      .send({ rows: [{ subscriptionId: leeSub, scheduledDate: day, washerId, note: 'Gate code 1234' }] })
      .expect(200);
    expect(saved.body.rows[0]).toMatchObject({ washerName: 'Choi Washer', note: 'Gate code 1234', moved: false });
    const other = await request(http).get(`/daysheets/${next}`).set(auth(admin)).expect(200);
    expect(other.body.rows.some((r: { subscriptionId: string }) => r.subscriptionId === leeSub)).toBe(false);

    await request(http)
      .put(`/daysheets/${day}`)
      .set(auth(admin))
      .send({ rows: [{ subscriptionId: leeSub, scheduledDate: next }] })
      .expect(400); // not a wash day of that car

    const plan = await request(http).get('/subscriptions/me').set(auth(lee)).expect(200);
    expect(plan.body[0].schedule).toEqual([{ weekday: weekday(day), weeks: [1, 2, 3, 4] }]);
  });

  it('records the day a moved car was actually washed', async () => {
    await request(http)
      .patch('/washes')
      .set(auth(washerToken))
      .send({ subscriptionId: leeSub, date: day, status: 'done', washedOn: next })
      .expect(200);
    const detail = await request(http).get('/washes/detail').query({ subscriptionId: leeSub, date: day }).set(auth(lee)).expect(200);
    expect(detail.body).toMatchObject({ status: 'done', washedOn: next });
  });
});

describe('bills', () => {
  it('shows members their bills and lets admins mark them paid', async () => {
    const invoices = app.get<Model<Invoice>>(getModelToken(Invoice.name));
    const kimId = (await request(http).get('/auth/me').set(auth(kim)).expect(200)).body.id;
    const month = today().slice(0, 7);
    const bill = await invoices.create({
      member: new Types.ObjectId(kimId),
      subscription: new Types.ObjectId(subId),
      plateNumber: '12가 3456',
      month,
      lines: [{ label: 'Basic plan', amount: 40000 }],
      amount: 40000,
      issueDate: `${month}-01`,
      dueDate: '2000-01-10', // long overdue
    });

    const mine = await request(http).get('/invoices/me').set(auth(kim)).expect(200);
    expect(mine.body.invoices).toHaveLength(1);
    expect(mine.body.invoices[0]).toMatchObject({ amount: 40000, status: 'unpaid', overdue: true });
    expect((await request(http).get('/invoices/me').set(auth(lee)).expect(200)).body.invoices).toHaveLength(0);

    await request(http).get('/invoices').set(auth(kim)).expect(403);
    const list = await request(http).get('/invoices').query({ month }).set(auth(admin)).expect(200);
    expect(list.body.totals).toMatchObject({ billed: 40000, unpaid: 40000, paid: 0, unpaidCount: 1 });
    expect(list.body.invoices[0].member).toMatchObject({ name: 'Kim Minjun' });
    expect((await request(http).get('/invoices/overdue').set(auth(admin)).expect(200)).body).toHaveLength(1);

    const paid = await request(http)
      .patch(`/invoices/${bill.id}`)
      .set(auth(admin))
      .send({ status: 'paid', method: 'bank_transfer', note: 'Shinhan transfer' })
      .expect(200);
    expect(paid.body).toMatchObject({ status: 'paid', method: 'bank_transfer', overdue: false });
    expect((await request(http).get('/invoices').query({ month }).set(auth(admin)).expect(200)).body.totals).toMatchObject({ paid: 40000, unpaid: 0 });
  });
});
