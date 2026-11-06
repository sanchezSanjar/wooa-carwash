import type { Lang } from './lang';
import type { ScheduleDay } from './types';

/** The shop runs on Korea time (UTC+9, no DST) regardless of the device's timezone. */
const SHOP_OFFSET_MS = 9 * 60 * 60_000;

const WEEKDAYS: Record<Lang, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ko: ['일', '월', '화', '수', '목', '금', '토'],
};
const WEEKDAYS_LONG: Record<Lang, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Mon" / "월" for 0–6. */
export const weekdayName = (weekday: number, lang: Lang) => WEEKDAYS[lang][weekday];
/** "Monday" / "월요일" for 0–6. */
export const weekdayLong = (weekday: number, lang: Lang) => WEEKDAYS_LONG[lang][weekday];

/** "010-1234-5678" from any Korean mobile format. */
export function formatPhone(phone: string) {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('82')) d = `0${d.slice(2)}`;
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d;
}

export const isMobile = (phone: string) => /^01[016789]\d{7,8}$/.test(formatPhone(phone).replace(/\D/g, ''));

/** "₩40,000" or "40,000원". */
export function formatKRW(amount: number, lang: Lang) {
  const n = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return lang === 'ko' ? `${n}원` : `₩${n}`;
}

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "Mon, Nov 16" or "11월 16일 (월)" for a YYYY-MM-DD date. */
export function formatDay(date: string, lang: Lang) {
  const d = utc(date);
  if (lang === 'ko') return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS.ko[d.getUTCDay()]})`;
  return `${WEEKDAYS.en[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** YYYY-MM-DD shop dates starting today. */
export function upcomingDates(count: number, from = new Date()): string[] {
  const start = new Date(from.getTime() + SHOP_OFFSET_MS);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i))
      .toISOString()
      .slice(0, 10),
  );
}

export function todayShopDate() {
  return upcomingDates(1)[0];
}

/** Parts of a date chip: weekday, day number and month ("Nov" / "11월"). */
export function dateChip(date: string, lang: Lang) {
  const d = utc(date);
  return {
    weekday: WEEKDAYS[lang][d.getUTCDay()],
    day: d.getUTCDate(),
    month: lang === 'ko' ? `${d.getUTCMonth() + 1}월` : MONTHS[d.getUTCMonth()],
    /** "Nov 16" / "11월 16일" */
    short: lang === 'ko' ? `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일` : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
  };
}

const ORDINAL: Record<Lang, string[]> = {
  en: ['', '1st', '2nd', '3rd', '4th'],
  ko: ['', '첫째', '둘째', '셋째', '넷째'],
};

/** "1st & 3rd Mon & Fri · 2nd & 4th Wed" / "첫째·셋째 주 월·금 · 둘째·넷째 주 수" */
export function scheduleSummary(schedule: ScheduleDay[], lang: Lang) {
  const groups = new Map<string, number[]>();
  for (const d of schedule) {
    const key = d.weeks.join(',');
    groups.set(key, [...(groups.get(key) ?? []), d.weekday]);
  }
  return [...groups.entries()]
    .map(([weeks, days]) => {
      const w = weeks.split(',').map(Number);
      if (lang === 'ko') {
        const names = days.map((d) => WEEKDAYS.ko[d]).join('·');
        return w.length === 4 ? `매주 ${names}요일` : `${w.map((n) => ORDINAL.ko[n]).join('·')} 주 ${names}요일`;
      }
      const names = days.map((d) => WEEKDAYS.en[d]).join(' & ');
      return w.length === 4 ? `Every ${names}` : `${w.map((n) => ORDINAL.en[n]).join(' & ')} ${names}`;
    })
    .join(' · ');
}

/** "November 2026" / "2026년 11월" for YYYY-MM. */
export function formatMonth(month: string, lang: Lang) {
  const m = Number(month.slice(5, 7));
  return lang === 'ko' ? `${month.slice(0, 4)}년 ${m}월` : `${MONTH_LONG[m - 1]} ${month.slice(0, 4)}`;
}

/** YYYY-MM shifted by n months. */
export function shiftMonth(month: string, n: number) {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Labels translated with t(). */
export const STATUS_LABEL = { planned: 'Planned', done: 'Washed', skipped: 'Skipped' } as const;
export const PAYMENT_METHOD_LABEL = { bank_transfer: 'Bank transfer', cash: 'Cash', card: 'Card', other: 'Other' } as const;

export interface ForecastFacts {
  pop: number;
  precipitation?: string;
  tempMin?: number | null;
  tempMax?: number | null;
  summary: string;
}

/** "Rain likely (70%) · 4–11°C" / "비 예상 (70%) · 4–11°C". Older data without details shows the stored summary. */
export function forecastSummary(f: ForecastFacts, lang: Lang) {
  if (!f.precipitation) return f.summary;
  const ko = lang === 'ko';
  const word =
    f.precipitation === 'snow' ? (ko ? '눈' : 'Snow') : f.precipitation === 'mixed' ? (ko ? '비 또는 눈' : 'Rain or snow') : ko ? '비' : 'Rain';
  const sky =
    f.precipitation !== 'none' || f.pop >= 60
      ? ko
        ? `${word} 예상 (${f.pop}%)`
        : `${word} likely (${f.pop}%)`
      : f.pop >= 30
        ? ko
          ? `비 올 확률 ${f.pop}%`
          : `Chance of rain ${f.pop}%`
        : ko
          ? '비 소식 없음'
          : 'Dry';
  const temps =
    f.tempMin !== null && f.tempMin !== undefined && f.tempMax !== null && f.tempMax !== undefined
      ? ` · ${Math.round(f.tempMin)}–${Math.round(f.tempMax)}°C`
      : '';
  return `${sky}${temps}`;
}
