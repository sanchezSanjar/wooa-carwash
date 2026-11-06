import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { localDayStart, localDate } from '../src/common/business-hours.js';

let mongo: MongoMemoryServer;
let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;

let customerToken: string;
let otherToken: string;
let adminToken: string;
let basicId: string;
let premiumId: string;

/** A shop-local date a few days ahead, safely inside the booking window. */
const day = localDate(new Date(Date.now() + 3 * 24 * 60 * 60_000));
const at = (hh: number, mm = 0) =>
  new Date(localDayStart(day).getTime() + (hh * 60 + mm) * 60_000).toISOString();

const register = async (email: string) => {
  const res = await request(http)
    .post('/auth/register')
    .send({ name: email.split('@')[0], email, password: 'password123', phone: '010-1111-2222' })
    .expect(201);
  return res.body.accessToken as string;
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri('wooa-test');
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.ADMIN_EMAILS = 'boss@wooa.test';
  process.env.BAYS = '2';

  const { AppModule } = await import('../src/app.module.js');
  const { configureApp } = await import('../src/setup.js');
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

describe('auth', () => {
  it('registers, logs in and returns the profile', async () => {
    customerToken = await register('kim@wooa.test');
    otherToken = await register('lee@wooa.test');
    adminToken = await register('boss@wooa.test');

    const login = await request(http)
      .post('/auth/login')
      .send({ email: 'KIM@wooa.test', password: 'password123' })
      .expect(200);
    expect(login.body.user).toMatchObject({ email: 'kim@wooa.test', role: 'customer' });
    expect(login.body.user.passwordHash).toBeUndefined();

    const me = await request(http)
      .get('/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(me.body.role).toBe('admin');
  });

  it('rejects duplicates, bad passwords and invalid input', async () => {
    await request(http)
      .post('/auth/register')
      .send({ name: 'x', email: 'kim@wooa.test', password: 'password123' })
      .expect(409);
    await request(http)
      .post('/auth/login')
      .send({ email: 'kim@wooa.test', password: 'wrong-password' })
      .expect(401);
    await request(http)
      .post('/auth/register')
      .send({ name: 'x', email: 'not-an-email', password: 'short' })
      .expect(400);
    await request(http).get('/auth/me').expect(401);
  });
});

describe('services', () => {
  it('seeds default packages', async () => {
    const res = await request(http).get('/services').expect(200);
    expect(res.body.map((s: any) => s.name)).toEqual([
      'Basic Wash',
      'Premium Wash',
      'Full Detailing',
    ]);
    basicId = res.body[0].id;
    premiumId = res.body[1].id;
  });

  it('only admins can manage packages', async () => {
    const body = { name: 'Engine Bay', price: 20000, durationMinutes: 30 };
    await request(http)
      .post('/services')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(body)
      .expect(403);
    const created = await request(http)
      .post('/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(201);
    await request(http)
      .patch(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false })
      .expect(200);
    const list = await request(http).get('/services').expect(200);
    expect(list.body.find((s: any) => s.id === created.body.id)).toBeUndefined();
  });
});

describe('bookings', () => {
  let bookingId: string;

  it('lists availability within opening hours', async () => {
    const res = await request(http)
      .get('/bookings/availability')
      .query({ date: day, serviceId: premiumId })
      .expect(200);
    // 09:00–18:00 starts for a 60 min wash, every 30 min
    expect(res.body).toHaveLength(19);
    expect(res.body[0]).toMatchObject({ startsAt: at(9), available: true, remaining: 2 });
    expect(res.body.at(-1).startsAt).toBe(at(18));
  });

  it('creates a booking and enforces bay capacity', async () => {
    const book = (token: string, startsAt: string, serviceId = premiumId) =>
      request(http)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceId, startsAt, vehicle: { plate: '12가 3456', model: 'Avante' } });

    const first = await book(customerToken, at(10)).expect(201);
    expect(first.body).toMatchObject({
      serviceName: 'Premium Wash',
      price: 35000,
      status: 'pending',
      endsAt: at(11),
      date: day,
    });
    bookingId = first.body.id;

    await book(otherToken, at(10, 30)).expect(201); // overlaps 10:30–11:00
    await book(customerToken, at(10, 30), basicId).expect(409); // both bays busy
    await book(customerToken, at(11), basicId).expect(201); // first one finished

    const avail = await request(http)
      .get('/bookings/availability')
      .query({ date: day, serviceId: basicId })
      .expect(200);
    const slot = (t: string) => avail.body.find((s: any) => s.startsAt === t);
    expect(slot(at(10))).toMatchObject({ remaining: 1, available: true });
    expect(slot(at(10, 30))).toMatchObject({ remaining: 0, available: false });
  });

  it('rejects invalid times', async () => {
    const book = (startsAt: string) =>
      request(http)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ serviceId: premiumId, startsAt, vehicle: { plate: '1234' } });
    await book(at(8)).expect(400); // before opening
    await book(at(18, 30)).expect(400); // would end after close
    await book(at(12, 15)).expect(400); // off-grid
    await book(new Date(Date.now() - 3600_000).toISOString()).expect(400); // past
  });

  it('keeps bookings private and lets admins manage them', async () => {
    const mine = await request(http)
      .get('/bookings/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(mine.body).toHaveLength(2);

    await request(http)
      .get('/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    const all = await request(http)
      .get('/bookings')
      .query({ date: day })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(all.body).toHaveLength(3);
    expect(all.body[0].customer).toMatchObject({ email: 'kim@wooa.test' });

    await request(http)
      .patch(`/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(http)
      .patch(`/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' })
      .expect(400); // pending -> completed not allowed
    await request(http)
      .patch(`/bookings/${bookingId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' })
      .expect(200);

    const cancelled = await request(http)
      .patch(`/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(cancelled.body.status).toBe('cancelled');

    // the freed bay is bookable again
    const avail = await request(http)
      .get('/bookings/availability')
      .query({ date: day, serviceId: basicId })
      .expect(200);
    expect(avail.body.find((s: any) => s.startsAt === at(10, 30)).remaining).toBe(1);
  });
});
