import { addDays, isValidDate, today, weekday, weekdayOccurrence } from './dates';
import { isWashDay, upcomingWashDates, validateSchedule } from './schedule';

const MON = 1;
const TUE = 2;
const WED = 3;
const FRI = 5;

describe('dates', () => {
  it('uses Korea time for today', () => {
    expect(today(new Date('2026-11-06T15:30:00Z'))).toBe('2026-11-07');
  });

  it('computes weekday and its occurrence in the month', () => {
    // November 2026: the 2nd is a Monday
    expect(weekday('2026-11-02')).toBe(MON);
    expect(weekdayOccurrence('2026-11-02')).toBe(1);
    expect(weekdayOccurrence('2026-11-16')).toBe(3);
    expect(weekdayOccurrence('2026-11-30')).toBe(5);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('rejects impossible dates', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-02-28')).toBe(true);
  });
});

describe('schedules', () => {
  const fortnightMonday = [{ weekday: MON, weeks: [1, 3] }];
  const everyTuesday = [{ weekday: TUE, weeks: [1, 2, 3, 4] }];
  const sixTimes = [
    { weekday: MON, weeks: [1, 3] },
    { weekday: FRI, weeks: [1, 3] },
    { weekday: WED, weeks: [2, 4] },
  ];

  it('accepts the three tariff examples', () => {
    expect(validateSchedule(fortnightMonday, 2)).toBeNull();
    expect(validateSchedule(everyTuesday, 4)).toBeNull();
    expect(validateSchedule(sixTimes, 6)).toBeNull();
  });

  it('rejects schedules that do not match the tariff', () => {
    expect(validateSchedule(fortnightMonday, 4)).toMatch(/4 washes/);
    expect(validateSchedule([{ weekday: MON, weeks: [1, 2] }], 2)).toMatch(/Weeks must be/);
    expect(validateSchedule([], 2)).toMatch(/at least one/);
    expect(
      validateSchedule(
        [
          { weekday: MON, weeks: [1, 3] },
          { weekday: MON, weeks: [2, 4] },
        ],
        4,
      ),
    ).toMatch(/only be chosen once/);
  });

  it('washes exactly the tariff count every month and skips 5th occurrences', () => {
    for (const [schedule, perMonth] of [
      [fortnightMonday, 2],
      [everyTuesday, 4],
      [sixTimes, 6],
    ] as const) {
      for (const month of ['2026-11', '2026-12', '2027-01', '2027-02']) {
        let count = 0;
        for (let d = 1; d <= 31; d++) {
          const date = `${month}-${String(d).padStart(2, '0')}`;
          if (isValidDate(date) && isWashDay([...schedule], date)) count++;
        }
        expect(count).toBe(perMonth);
      }
    }
    expect(isWashDay(fortnightMonday, '2026-11-30')).toBe(false); // 5th Monday
  });

  it('lists upcoming washes from the start date', () => {
    expect(upcomingWashDates(fortnightMonday, '2026-11-03', '2026-11-01', 3)).toEqual([
      '2026-11-16',
      '2026-12-07',
      '2026-12-21',
    ]);
  });
});
