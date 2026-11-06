import type { Car } from './schemas/car.schema';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon, Nov 16" for a YYYY-MM-DD date. */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const won = (n: number) => `₩${Math.round(n).toLocaleString('en-US')}`;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (month: string) => MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
const pay = (bank?: string) => (bank ? ` Pay by bank transfer to ${bank}.` : '');

interface Bill {
  plateNumber: string;
  month: string;
  amount: number;
  dueDate: string;
}

/** Texts for member notifications and SMS, shared by the API and the batch server. */
export const NotificationText = {
  invoiceIssued(b: Bill, bank?: string) {
    return {
      title: `${monthName(b.month)} bill: ${won(b.amount)}`,
      body: `Your ${monthName(b.month)} wash plan for ${b.plateNumber} is ${won(b.amount)}, due ${dayLabel(b.dueDate)}.${pay(bank)}`,
    };
  },
  paymentDue(b: Bill, bank?: string) {
    return {
      title: `Payment due ${dayLabel(b.dueDate)}`,
      body: `${won(b.amount)} for ${b.plateNumber} (${monthName(b.month)}) is due ${dayLabel(b.dueDate)}.${pay(bank)}`,
    };
  },
  paymentOverdue(b: Bill, bank?: string) {
    return {
      title: `Payment overdue: ${won(b.amount)}`,
      body: `We have not received ${won(b.amount)} for ${b.plateNumber} (${monthName(b.month)}), due ${dayLabel(b.dueDate)}.${pay(bank)} Ignore this if you already paid.`,
    };
  },
  reminder(car: Pick<Car, 'plateNumber' | 'buildingNumber' | 'parkingFloor'>, date: string, extras: string[]) {
    return {
      title: `Wash tomorrow: ${car.plateNumber}`,
      body:
        `We wash your car on ${dayLabel(date)} in building ${car.buildingNumber}, floor ${car.parkingFloor}.` +
        (extras.length ? ` Extras: ${extras.join(', ').toLowerCase()}.` : ''),
    };
  },
  washed(car: Pick<Car, 'plateNumber'>, date: string) {
    return { title: `${car.plateNumber} is washed`, body: `Your car was washed on ${dayLabel(date)}.` };
  },
};
