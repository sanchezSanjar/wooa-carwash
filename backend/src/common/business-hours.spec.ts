import {
  isValidSlotStart,
  localDate,
  localDayStart,
  localMinuteOfDay,
  slotStartsForDay,
} from './business-hours.js';

describe('business hours (Asia/Seoul)', () => {
  it('maps a shop date to the right UTC instant', () => {
    expect(localDayStart('2026-11-10').toISOString()).toBe('2026-11-09T15:00:00.000Z');
    expect(localDate(new Date('2026-11-09T15:00:00.000Z'))).toBe('2026-11-10');
    expect(localMinuteOfDay(new Date('2026-11-10T00:30:00.000Z'))).toBe(9 * 60 + 30);
  });

  it('rejects malformed dates', () => {
    expect(() => localDayStart('2026-13-45x')).toThrow();
  });

  it('builds slots that finish by closing time', () => {
    const slots = slotStartsForDay('2026-11-10', 180);
    expect(slots[0].toISOString()).toBe('2026-11-10T00:00:00.000Z'); // 09:00 KST
    expect(slots.at(-1)!.toISOString()).toBe('2026-11-10T07:00:00.000Z'); // 16:00 KST
  });

  it('validates slot starts', () => {
    expect(isValidSlotStart(new Date('2026-11-10T00:00:00.000Z'), 30)).toBe(true);
    expect(isValidSlotStart(new Date('2026-11-10T00:15:00.000Z'), 30)).toBe(false);
    expect(isValidSlotStart(new Date('2026-11-09T23:30:00.000Z'), 30)).toBe(false);
    expect(isValidSlotStart(new Date('2026-11-10T09:30:00.000Z'), 60)).toBe(false);
  });
});
