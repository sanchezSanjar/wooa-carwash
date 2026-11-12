import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
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

/** Washes can be recorded once their day has come: the tests run 60 days ahead unless a test changes it. */
const testClock = { aheadDays: 60, now: () => new Date(Date.now() + testClock.aheadDays * 86_400_000) };

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
const register = async (name: string, phone: string, apartmentName = 'Raemian Gwanggyo', headers: Record<string, string> = {}) => {
  await request(http).post('/auth/otp/request').set(headers).send({ phone, purpose: 'signup' }).expect(200);
  const verified = await request(http)
    .post('/auth/otp/verify')
    .send({ phone, purpose: 'signup', code: lastCode(phone) })
    .expect(200);
  const res = await request(http)
    .post('/auth/register')
    .set(headers)
    .send({ name, phone, password: 'password123', apartmentName, signupToken: verified.body.signupToken })
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
  const { Clock } = await import('../src/clock');
  // tests mark upcoming washes as done: act as if those days had come (one test sets it back to today)
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(Clock).useValue(testClock).compile();
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
      .send({ name: 'x', phone: '010-5555-6666', password: 'password123', apartmentName: 'A', signupToken: 'x'.repeat(43) })
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

  it('answers in Korean when the app asks for it', async () => {
    const ko = { 'Accept-Language': 'ko' };
    await request(http).post('/auth/otp/request').set(ko).send({ phone: '010-2468-1357', purpose: 'signup' }).expect(200);
    expect(sms.outbox.at(-1)?.text).toMatch(/^\[우아세차\] 인증번호는 \d{6}입니다/);

    const wrong = await request(http).post('/auth/login').set(ko).send({ phone: '010-1111-2222', password: 'nope-nope' }).expect(401);
    expect(wrong.body.message).toBe('전화번호 또는 비밀번호가 올바르지 않습니다');
    const invalid = await request(http).post('/auth/login').set(ko).send({ phone: 'abc' }).expect(400);
    expect(invalid.body.message[0]).toMatch(/[가-힣]/);
    const english = await request(http).post('/auth/login').send({ phone: '010-1111-2222', password: 'nope-nope' }).expect(401);
    expect(english.body.message).toBe('Wrong phone number or password');

    const signedUp = await register('Park Seoyeon', '010-2468-9999', 'Hillstate', ko);
    expect((await request(http).get('/auth/me').set(auth(signedUp)).expect(200)).body.language).toBe('ko');
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
    expect(sms.outbox.at(-1)?.text).toMatch(/비밀번호 찾기/); // new members get Korean texts

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
      .send({ apartmentName: 'Raemian Gwanggyo 2', language: 'en' })
      .expect(200);
    expect(res.body).toMatchObject({ apartmentName: 'Raemian Gwanggyo 2', language: 'en' });
    await request(http).patch('/members/me').set(auth(kim)).send({ language: 'fr' }).expect(400);
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
    expect(before.body.url).toMatch(/^\/uploads\/washes\/.+\.jpg\?exp=\d+&sig=[\w-]+$/);
    await request(http).get(before.body.url).expect(200).expect('content-type', /image\/jpeg/);
    // photos are not public: without the signature, with a changed one, or for another file, nothing
    const [path, query] = before.body.url.split('?');
    await request(http).get(path).expect(404);
    await request(http).get(`${path}?${query.replace(/sig=./, 'sig=X')}`).expect(404);
    await request(http).get(`${path.replace(/[^/]+\.jpg$/, 'other.jpg')}?${query}`).expect(404);
    await request(http).get(`/uploads/../package.json?${query}`).expect(404);
    const { StorageService } = await import('../src/washes/storage.service');
    const key = path.slice('/uploads/'.length);
    const exp = new URLSearchParams(query).get('exp')!;
    const sig = new URLSearchParams(query).get('sig')!;
    expect(StorageService.verify(key, exp, sig)).toBe(true);
    expect(StorageService.verify(key, exp, sig, (Number(exp) + 1) * 1000)).toBe(false); // expired

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

  it('round-trips the day sheet through Excel', async () => {
    await request(http).get('/daysheets/export').query({ from: day, days: 2 }).set(auth(washerToken)).expect(403);
    const exported = await request(http)
      .get('/daysheets/export')
      .query({ from: day, days: 2 })
      .set(auth(admin))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200)
      .expect('content-type', /spreadsheetml/);
    expect(exported.headers['content-disposition']).toMatch(/wooa-daysheet-.+.xlsx/);

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(exported.body as unknown as ArrayBuffer);
    expect(book.worksheets.map((w) => w.name.slice(0, 10))).toEqual([day, next]);
    const ws = book.worksheets[0];
    const header = (ws.getRow(1).values as string[]).slice(1);
    const col = (name: string) => header.findIndex((h) => h.startsWith(name)) + 1;
    let leeRow = 0;
    ws.eachRow((row, n) => {
      if (row.getCell(col('Plate number')).value === '77다 7777') leeRow = n;
    });
    expect(leeRow).toBeGreaterThan(1);
    expect(ws.getRow(leeRow).getCell(col('Washer')).value).toBe('Choi Washer');

    // edit like an admin would in Excel: move it to the next day, change the note, add a typo row
    ws.getRow(leeRow).getCell(col('Day')).value = next;
    ws.getRow(leeRow).getCell(col('Note')).value = 'Bring ladder';
    ws.addRow(['99', day, '99마 0000']);
    const edited = Buffer.from(await book.xlsx.writeBuffer());

    await request(http).post('/daysheets/import/preview').set(auth(admin)).attach('file', Buffer.from('not excel'), 'x.xlsx').expect(400);
    const preview = await request(http)
      .post('/daysheets/import/preview')
      .set(auth(admin))
      .attach('file', edited, 'edited.xlsx')
      .expect(200);
    expect(preview.body.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'moved', plateNumber: '77다 7777' }),
        expect.objectContaining({ type: 'note', plateNumber: '77다 7777', detail: 'note: “Bring ladder”' }),
      ]),
    );
    expect(preview.body.problems).toEqual([expect.objectContaining({ plateNumber: '99마 0000', message: expect.stringMatching(/No car/) })]);

    // nothing is saved until apply
    expect((await request(http).get(`/daysheets/${next}`).set(auth(admin))).body.rows.some((r: { subscriptionId: string }) => r.subscriptionId === leeSub)).toBe(false);
    const applied = await request(http).post('/daysheets/import/apply').set(auth(admin)).send({ plan: preview.body.plan }).expect(200);
    expect(applied.body.saved).toEqual(expect.arrayContaining([day, next]));

    const onNext = (await request(http).get(`/daysheets/${next}`).set(auth(admin))).body.rows.find((r: { subscriptionId: string }) => r.subscriptionId === leeSub);
    expect(onNext).toMatchObject({ moved: true, note: 'Bring ladder', washerName: 'Choi Washer', scheduledDate: day });
    expect((await request(http).get(`/daysheets/${day}`).set(auth(admin))).body.rows.some((r: { subscriptionId: string }) => r.subscriptionId === leeSub)).toBe(false);
  });

  it('exports and reads Korean workbooks', async () => {
    const ko = { 'Accept-Language': 'ko-KR,ko;q=0.9' };
    const exported = await request(http)
      .get('/daysheets/export')
      .query({ from: day, days: 1 })
      .set(auth(admin))
      .set(ko)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(exported.body as unknown as ArrayBuffer);
    const ws = book.worksheets[0];
    expect(ws.name).toMatch(new RegExp(`^${day} [일월화수목금토]$`));
    const header = (ws.getRow(1).values as string[]).slice(1);
    expect(header.slice(0, 3)).toEqual(['순서', '날짜 (YYYY-MM-DD)', '차량 번호']);

    ws.addRow(['99', day, '99마 0000']);
    const edited = Buffer.from(await book.xlsx.writeBuffer());
    const preview = await request(http).post('/daysheets/import/preview').set(auth(admin)).set(ko).attach('file', edited, 'ko.xlsx').expect(200);
    expect(preview.body.problems).toEqual([expect.objectContaining({ plateNumber: '99마 0000', message: '이 번호로 이용 중인 차량이 없어 건너뜁니다' })]);
    expect(preview.body.changes).toEqual([]);

    // the same Korean file previews in English for an admin using English
    const inEnglish = await request(http).post('/daysheets/import/preview').set(auth(admin)).attach('file', edited, 'ko.xlsx').expect(200);
    expect(inEnglish.body.problems[0].message).toMatch(/No car/);
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

describe('security', () => {
  /** Requests and checks an SMS code; returns the token the server gives for it. */
  const verifyPhone = async (phone: string) => {
    await request(http).post('/auth/otp/request').send({ phone, purpose: 'signup' }).expect(200);
    const res = await request(http).post('/auth/otp/verify').send({ phone, purpose: 'signup', code: lastCode(phone) }).expect(200);
    return res.body.signupToken as string;
  };
  const signup = { name: 'Someone', password: 'password123', apartmentName: 'Raemian Gwanggyo' };

  it('lets only the person who checked the SMS code create the account', async () => {
    const token = await verifyPhone('010-7777-1001');
    expect(token).toMatch(/^[\w-]{40,}$/);
    // someone else who only knows the number can't finish the sign-up
    await request(http).post('/auth/register').send({ ...signup, phone: '010-7777-1001', signupToken: 'x'.repeat(43) }).expect(400);
    // a token is tied to its own number
    await request(http).post('/auth/register').send({ ...signup, phone: '010-7777-1002', signupToken: token }).expect(400);
    await request(http).post('/auth/register').send({ ...signup, phone: '010-7777-1001', signupToken: token }).expect(201);
    // and works once
    await request(http).post('/auth/register').send({ ...signup, phone: '010-7777-1001', signupToken: token }).expect(400);
  });

  it('never makes an admin from an email address', async () => {
    process.env.ADMIN_EMAILS = 'boss@wooa.test'; // the old setting must do nothing now
    const token = await verifyPhone('010-7777-1003');
    const res = await request(http)
      .post('/auth/register')
      .send({ ...signup, phone: '010-7777-1003', email: 'boss@wooa.test', signupToken: token })
      .expect(201);
    expect(res.body.user.role).toBe('customer');
    delete process.env.ADMIN_EMAILS;
  });

  it('locks a phone number after 5 wrong passwords', async () => {
    const token = await verifyPhone('010-7777-1004');
    await request(http).post('/auth/register').send({ ...signup, phone: '010-7777-1004', signupToken: token }).expect(201);
    for (let i = 0; i < 5; i++) {
      await request(http).post('/auth/login').send({ phone: '010-7777-1004', password: 'wrong-password' }).expect(401);
    }
    // even the right password waits now
    const locked = await request(http).post('/auth/login').send({ phone: '010-7777-1004', password: 'password123' }).expect(429);
    expect(locked.body.message).toMatch(/15 minutes/);
    // other members are not affected
    await request(http).post('/auth/login').send({ phone: '010-1111-2222', password: 'password123' }).expect(200);
  });

  it('limits auth calls per IP address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) {
      const res = await request(http).post('/auth/reset-password').send({ resetToken: 'x'.repeat(43), newPassword: 'password123' });
      statuses.push(res.status);
    }
    // earlier tests already used a few calls this minute: at most 20 get through, then every call is refused
    const firstRefused = statuses.indexOf(429);
    expect(firstRefused).toBeGreaterThan(0);
    expect(firstRefused).toBeLessThanOrEqual(20);
    expect(statuses.slice(0, firstRefused).every((s) => s === 400)).toBe(true);
    expect(statuses.slice(firstRefused).every((s) => s === 429)).toBe(true);
  });
});

describe('proxy setting', () => {
  it('trusts only the proxies it is told about', async () => {
    const { trustProxySetting } = await import('../src/setup');
    expect(trustProxySetting(undefined)).toBeUndefined();
    expect(trustProxySetting('')).toBeUndefined();
    expect(trustProxySetting('false')).toBeUndefined();
    expect(trustProxySetting('1')).toBe(1);
    expect(trustProxySetting('loopback')).toBe('loopback');
  });
});

describe('api docs', () => {
  it('are hidden in production unless switched on', async () => {
    const { docsEnabled } = await import('../src/setup');
    expect(docsEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(docsEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(docsEnabled({ NODE_ENV: 'production', API_DOCS: 'true' })).toBe(true);
    await request(http).get('/docs').expect(200); // tests run as development
  });
});

describe('logout', () => {
  it('ends the token on the server, on that device only', async () => {
    const login = () => request(http).post('/auth/login').send({ phone: '010-7777-1001', password: 'password123' }).expect(200);
    const phone1 = (await login()).body.accessToken as string;
    const phone2 = (await login()).body.accessToken as string;
    await request(http).get('/auth/me').set(auth(phone1)).expect(200);
    await request(http).post('/auth/logout').set(auth(phone1)).expect(204);
    await request(http).get('/auth/me').set(auth(phone1)).expect(401); // a copy of the token is useless now
    await request(http).get('/auth/me').set(auth(phone2)).expect(200); // the other device stays logged in
    await request(http).post('/auth/logout').expect(401);
  });

  it('refuses tokens without an id (made before logout existed)', async () => {
    const { JwtService } = await import('@nestjs/jwt');
    const me = (await request(http).get('/auth/me').set(auth(kim)).expect(200)).body;
    const old = new JwtService({ secret: 'test-secret' }).sign({ sub: me.id, role: me.role }, { expiresIn: '1h' });
    await request(http).get('/auth/me').set(auth(old)).expect(401);
  });
});

describe('recording washes', () => {
  it('refuses days that have not come yet and days after a plan was cancelled', async () => {
    const owner = await register('Jung Hana', '010-7777-2001');
    const ownCar = (await request(http).post('/cars').set(auth(owner)).send({ ...car, plateNumber: '34나 7777' }).expect(201)).body;
    const tariffList = (await request(http).get('/tariffs').expect(200)).body as { id: string; washesPerMonth: number }[];
    const sub = (
      await request(http)
        .post('/subscriptions')
        .set(auth(owner))
        .send({ carId: ownCar.id, tariffId: tariffList.find((t) => t.washesPerMonth === 6)!.id, startDate: today(), schedule: sixTimes })
        .expect(201)
    ).body;
    const future = (sub.upcoming as string[]).find((d) => d > today())!;
    const mark = (date: string, extra: Record<string, string> = {}) =>
      request(http).patch('/washes').set(auth(admin)).send({ subscriptionId: sub.id, date, status: 'done', ...extra });

    testClock.aheadDays = 0; // really today
    try {
      const early = await mark(future).expect(400);
      expect(early.body.message).toMatch(/on or after its day/);
      await request(http).patch('/washes').set(auth(admin)).send({ subscriptionId: sub.id, date: future, status: 'skipped' }).expect(400);
      // a car moved to an earlier day can be marked on the day it was really washed
      await mark(future, { washedOn: today() }).expect(200);
      await mark(future, { washedOn: addDays(today(), 1) }).expect(400);
      await request(http).patch('/washes').set(auth(admin)).send({ subscriptionId: sub.id, date: future, status: 'planned' }).expect(200);
    } finally {
      testClock.aheadDays = 60;
    }

    await request(http).patch(`/subscriptions/${sub.id}/cancel`).set(auth(owner)).expect(200);
    const cancelled = await mark(future).expect(400);
    expect(cancelled.body.message).toMatch(/cancelled/);
  });
});
