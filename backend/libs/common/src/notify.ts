import type { Car } from './schemas/car.schema';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon, Nov 16" for a YYYY-MM-DD date. */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Texts for member notifications, shared by the API and the batch server. */
export const NotificationText = {
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
