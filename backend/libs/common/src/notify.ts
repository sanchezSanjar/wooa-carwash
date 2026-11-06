import type { Car } from './schemas/car.schema';
import { catalogName, dayLabel, forecastSummary, monthName, won, type ForecastFacts, type Lang } from './i18n';

export { dayLabel } from './i18n';

interface Bill {
  plateNumber: string;
  month: string;
  amount: number;
  dueDate: string;
}

export interface NoticeText {
  title: string;
  body: string;
}

const pay = (lang: Lang, bank?: string) =>
  bank ? (lang === 'ko' ? ` ${bank} 계좌로 입금해 주세요.` : ` Pay by bank transfer to ${bank}.`) : '';

/**
 * Texts for member notifications and SMS, shared by the API and the batch server.
 * Written in the member's language (Korean by default).
 */
export const NotificationText = {
  invoiceIssued(b: Bill, bank?: string, lang: Lang = 'ko'): NoticeText {
    const month = monthName(b.month, lang);
    const amount = won(b.amount, lang);
    const due = dayLabel(b.dueDate, lang);
    if (lang === 'ko') {
      return {
        title: `${month} 청구서: ${amount}`,
        body: `${b.plateNumber} 차량의 ${month} 세차 요금은 ${amount}이며, 납부 기한은 ${due}입니다.${pay(lang, bank)}`,
      };
    }
    return {
      title: `${month} bill: ${amount}`,
      body: `Your ${month} wash plan for ${b.plateNumber} is ${amount}, due ${due}.${pay(lang, bank)}`,
    };
  },
  paymentDue(b: Bill, bank?: string, lang: Lang = 'ko'): NoticeText {
    const month = monthName(b.month, lang);
    const amount = won(b.amount, lang);
    const due = dayLabel(b.dueDate, lang);
    if (lang === 'ko') {
      return {
        title: `납부 기한 ${due}`,
        body: `${b.plateNumber} 차량 ${month} 요금 ${amount}의 납부 기한은 ${due}입니다.${pay(lang, bank)}`,
      };
    }
    return {
      title: `Payment due ${due}`,
      body: `${amount} for ${b.plateNumber} (${month}) is due ${due}.${pay(lang, bank)}`,
    };
  },
  paymentOverdue(b: Bill, bank?: string, lang: Lang = 'ko'): NoticeText {
    const month = monthName(b.month, lang);
    const amount = won(b.amount, lang);
    const due = dayLabel(b.dueDate, lang);
    if (lang === 'ko') {
      return {
        title: `미납 안내: ${amount}`,
        body: `${b.plateNumber} 차량 ${month} 요금 ${amount}(납부 기한 ${due})이 아직 입금되지 않았습니다.${pay(lang, bank)} 이미 납부하셨다면 이 메시지는 무시해 주세요.`,
      };
    }
    return {
      title: `Payment overdue: ${amount}`,
      body: `We have not received ${amount} for ${b.plateNumber} (${month}), due ${due}.${pay(lang, bank)} Ignore this if you already paid.`,
    };
  },
  weather(car: Pick<Car, 'plateNumber'>, date: string, forecast: ForecastFacts, lang: Lang = 'ko'): NoticeText {
    const summary = forecastSummary(forecast, lang);
    const headline = summary.split(' · ')[0];
    if (lang === 'ko') {
      return {
        title: `세차일 날씨: ${headline}`,
        body:
          `${dayLabel(date, lang)}: ${summary}. ${car.plateNumber} 차량 세차는 예정대로 진행합니다. ` +
          '날씨 때문에 일정이 바뀌면 다시 알려 드리겠습니다.',
      };
    }
    return {
      title: `Weather for your wash: ${headline}`,
      body:
        `${dayLabel(date, lang)}: ${summary}. We still plan to wash ${car.plateNumber}; ` +
        'if we move the wash because of the weather, we will tell you.',
    };
  },
  reminder(
    car: Pick<Car, 'plateNumber' | 'buildingNumber' | 'parkingFloor'>,
    date: string,
    extras: string[],
    lang: Lang = 'ko',
  ): NoticeText {
    if (lang === 'ko') {
      return {
        title: `내일 세차: ${car.plateNumber}`,
        body:
          `${dayLabel(date, lang)}에 ${car.buildingNumber}동 ${car.parkingFloor}층 주차장에서 세차합니다.` +
          (extras.length ? ` 추가 서비스: ${extras.map((e) => catalogName(e, lang)).join(', ')}.` : ''),
      };
    }
    return {
      title: `Wash tomorrow: ${car.plateNumber}`,
      body:
        `We wash your car on ${dayLabel(date, lang)} in building ${car.buildingNumber}, floor ${car.parkingFloor}.` +
        (extras.length ? ` Extras: ${extras.join(', ').toLowerCase()}.` : ''),
    };
  },
  washed(car: Pick<Car, 'plateNumber'>, date: string, lang: Lang = 'ko'): NoticeText {
    if (lang === 'ko') return { title: `${car.plateNumber} 세차 완료`, body: `${dayLabel(date, lang)}에 세차를 마쳤습니다.` };
    return { title: `${car.plateNumber} is washed`, body: `Your car was washed on ${dayLabel(date, lang)}.` };
  },
  /** SMS verification code. */
  otp(code: string, lang: Lang = 'ko'): string {
    return lang === 'ko'
      ? `[Wooa Carwash] 인증번호는 ${code}입니다 (3분간 유효)`
      : `[Wooa Carwash] Your code is ${code} (valid for 3 minutes)`;
  },
};

/** SMS text for a notification. */
export const smsText = (text: NoticeText) => `[Wooa Carwash] ${text.body}`;
