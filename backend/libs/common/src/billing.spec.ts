import { dueDateFor, invoiceLines, monthBounds, washesInMonth } from './billing';

const everyMonday = [{ weekday: 1, weeks: [1, 2, 3, 4] }];
const sub = {
  tariffName: 'Standard',
  tariffPrice: 70000,
  washesPerMonth: 4,
  extras: [{ name: 'Interior vacuuming', price: 5000 }],
  schedule: everyMonday,
  startDate: '2026-11-01',
};

describe('billing', () => {
  it('knows month bounds', () => {
    expect(monthBounds('2026-02')).toEqual({ first: '2026-02-01', last: '2026-02-28' });
    expect(monthBounds('2026-12').last).toBe('2026-12-31');
  });

  it('bills a full month', () => {
    expect(invoiceLines(sub, '2026-12')).toEqual([
      { label: 'Standard plan', amount: 70000, kind: 'plan', name: 'Standard', washes: 4, washesPerMonth: 4 },
      { label: 'Interior vacuuming × 4', amount: 20000, kind: 'extra', name: 'Interior vacuuming', washes: 4 },
    ]);
  });

  it('prorates a plan that starts mid-month by the washes left', () => {
    // Mondays in Nov 2026: 2, 9, 16, 23 (30th is a 5th Monday). Start on the 12th: 16 and 23 left.
    expect(washesInMonth(everyMonday, '2026-11', '2026-11-12')).toBe(2);
    expect(invoiceLines({ ...sub, startDate: '2026-11-12' }, '2026-11')).toEqual([
      { label: 'Standard plan (2 of 4 washes)', amount: 35000, kind: 'plan', name: 'Standard', washes: 2, washesPerMonth: 4 },
      { label: 'Interior vacuuming × 2', amount: 10000, kind: 'extra', name: 'Interior vacuuming', washes: 2 },
    ]);
    expect(invoiceLines({ ...sub, startDate: '2026-11-27' }, '2026-11')).toEqual([]); // no wash left
    expect(invoiceLines({ ...sub, startDate: '2026-12-01' }, '2026-11')).toEqual([]); // not started
  });

  it('sets the due date', () => {
    expect(dueDateFor('2026-11', '2026-11-01', 10)).toBe('2026-11-10');
    expect(dueDateFor('2026-11', '2026-11-12', 10)).toBe('2026-11-19'); // at least a week
    expect(dueDateFor('2026-11', '2026-11-28', 10)).toBe('2026-12-05');
  });
});
