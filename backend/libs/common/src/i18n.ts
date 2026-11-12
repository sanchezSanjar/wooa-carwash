/** Languages members can use. Korean is the default; English is for foreign residents. */
export type Lang = 'ko' | 'en';
export const LANGS: readonly Lang[] = ['ko', 'en'];

/** The shop's name as customers see it. */
export const brand = (lang: Lang) => (lang === 'ko' ? '우아세차' : 'Wooa Carwash');

/** Language from an Accept-Language header ("ko-KR,ko;q=0.9" → ko). Anything that is not Korean is English. */
export function pickLang(header?: string | string[] | null): Lang {
  const value = (Array.isArray(header) ? header[0] : header) ?? '';
  return value.trim().toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

const WEEKDAYS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ko: ['일', '월', '화', '수', '목', '금', '토'] };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Short weekday of a YYYY-MM-DD date: "Mon" / "월". */
export function weekdayName(date: string, lang: Lang = 'en'): string {
  return WEEKDAYS[lang][new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** "Mon, Nov 16" or "11월 16일 (월)" for a YYYY-MM-DD date. */
export function dayLabel(date: string, lang: Lang = 'en'): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (lang === 'ko') return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS.ko[d.getUTCDay()]})`;
  return `${WEEKDAYS.en[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "November" or "11월" for YYYY-MM. */
export function monthName(month: string, lang: Lang = 'en'): string {
  const n = Number(month.slice(5, 7));
  if (!n) return month;
  return lang === 'ko' ? `${n}월` : MONTHS_LONG[n - 1];
}

/** "₩12,000" or "12,000원". */
export function won(amount: number, lang: Lang = 'en'): string {
  const n = Math.round(amount).toLocaleString('en-US');
  return lang === 'ko' ? `${n}원` : `₩${n}`;
}

export interface ForecastFacts {
  pop: number;
  precipitation: string;
  tempMin?: number | null;
  tempMax?: number | null;
}

/** "Rain likely (70%) · 4–11°C" / "비 예상 (70%) · 4–11°C". */
export function forecastSummary(f: ForecastFacts, lang: Lang = 'en'): string {
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

/** Korean names of the plans and extras the API creates on first start. Names an admin types stay as typed. */
export const KO_CATALOG: Record<string, string> = {
  Basic: '베이직',
  Standard: '스탠다드',
  Premium: '프리미엄',
  'Interior vacuuming': '실내 진공 청소',
  'Perfume change': '방향제 교체',
  'Anti-rain polish': '유리 발수 코팅',
  'Tire shine': '타이어 광택',
};

/** A plan or extra name in the member's language. */
export const catalogName = (name: string, lang: Lang) => (lang === 'ko' ? (KO_CATALOG[name] ?? name) : name);

/** Korean for the API's error messages. Unknown messages stay in English. */
const KO_MESSAGES: Record<string, string> = {
  'This phone number already has an account': '이미 가입된 전화번호입니다',
  'This phone number or email already has an account': '이미 가입된 전화번호 또는 이메일입니다',
  'This phone number or email is used by another account': '다른 계정에서 사용 중인 전화번호 또는 이메일입니다',
  'Wrong phone number or password': '전화번호 또는 비밀번호가 올바르지 않습니다',
  'This account is blocked': '이용이 정지된 계정입니다',
  'This reset link has expired. Start again.': '재설정 시간이 만료되었습니다. 처음부터 다시 시도해 주세요.',
  'Please log in again': '다시 로그인해 주세요',
  Unauthorized: '로그인이 필요합니다',
  Forbidden: '권한이 없습니다',
  'Forbidden resource': '권한이 없습니다',
  'Not Found': '찾을 수 없습니다',
  'Internal server error': '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  'This phone number already has an account. Log in or reset your password.':
    '이미 가입된 전화번호입니다. 로그인하거나 비밀번호를 재설정해 주세요.',
  'The code has expired. Request a new one.': '인증번호가 만료되었습니다. 새 인증번호를 요청해 주세요.',
  'Verify your phone number with the SMS code first': '먼저 문자 인증번호로 전화번호를 인증해 주세요',
  'Too many codes requested. Try again later.': '인증번호 요청이 너무 많습니다. 나중에 다시 시도해 주세요.',
  'Too many requests. Try again in a minute.': '요청이 너무 많습니다. 1분 후에 다시 시도해 주세요.',
  'Too many wrong passwords. Try again in 15 minutes or reset your password.':
    '비밀번호를 여러 번 틀렸습니다. 15분 후에 다시 시도하거나 비밀번호를 재설정해 주세요.',
  'Wait a minute before requesting another code.': '1분 후에 다시 요청해 주세요.',
  'Could not send the SMS. Please try again.': '문자를 보내지 못했습니다. 다시 시도해 주세요.',
  'Cancel this car’s subscription before removing it': '차량을 삭제하려면 먼저 구독을 해지해 주세요',
  'Only admins can add cars for others': '다른 회원의 차량은 관리자만 등록할 수 있습니다',
  'Member not found': '회원을 찾을 수 없습니다',
  'A car with this plate number is already registered': '이미 등록된 차량 번호입니다',
  'Car not found': '차량을 찾을 수 없습니다',
  'Tariff not found': '요금제를 찾을 수 없습니다',
  'One of the extra services is not available': '선택한 추가 서비스 중 이용할 수 없는 항목이 있습니다',
  'Extra service not found': '추가 서비스를 찾을 수 없습니다',
  'Invalid start date': '시작 날짜가 올바르지 않습니다',
  'Attach an .xlsx file': '.xlsx 파일을 첨부해 주세요',
  'The file is too large (2 MB at most)': '파일이 너무 큽니다 (최대 2MB)',
  'This is not a readable .xlsx file. Export a day sheet and edit that file.':
    '읽을 수 없는 .xlsx 파일입니다. 일일 작업표를 내보낸 파일을 수정해서 올려 주세요.',
  'No day tabs found. Use a file exported from the day sheet.': '날짜 탭이 없습니다. 일일 작업표에서 내보낸 파일을 사용해 주세요.',
  'Too many days in one import': '한 번에 가져올 수 있는 날짜 수를 넘었습니다',
  'Invalid date in the import': '가져온 파일에 올바르지 않은 날짜가 있습니다',
  'Choose another day': '다른 날짜를 선택해 주세요',
  'This car is not on that day': '이 차량은 해당 날짜에 없습니다',
  'A car on the sheet has no active plan': '작업표에 이용 중인 요금제가 없는 차량이 있습니다',
  'The same wash is on the sheet twice': '같은 세차가 작업표에 두 번 들어 있습니다',
  'Assigned washer not found': '배정한 세차 담당자를 찾을 수 없습니다',
  'Invalid date': '날짜가 올바르지 않습니다',
  'Bill not found': '청구서를 찾을 수 없습니다',
  'This tariff is not available': '이용할 수 없는 요금제입니다',
  'startDate is not a valid date': '시작 날짜가 올바르지 않습니다',
  'startDate cannot be in the past': '시작 날짜는 오늘 이후여야 합니다',
  'This car already has an active subscription': '이 차량은 이미 이용 중인 구독이 있습니다',
  'Only active subscriptions can be changed': '이용 중인 구독만 변경할 수 있습니다',
  'This subscription is already cancelled': '이미 해지된 구독입니다',
  'Subscription not found': '구독을 찾을 수 없습니다',
  'This car is not scheduled for a wash on that date': '이 차량은 해당 날짜에 세차 일정이 없습니다',
  'This plan is cancelled': '해지된 플랜입니다',
  'A wash can only be recorded on or after its day': '세차 결과는 세차 당일부터 기록할 수 있습니다',
  'The current password is wrong': '현재 비밀번호가 올바르지 않습니다',
  'The password is too long. Use at most 72 letters (24 in Korean).': '비밀번호가 너무 깁니다. 영문 72자(한글 24자)까지 사용할 수 있습니다.',
  'You can’t change your own role': '내 역할은 직접 바꿀 수 없습니다',
  'You can’t block your own account': '내 계정은 직접 정지할 수 없습니다',
  'Attach a photo': '사진을 첨부해 주세요',
  'Only images can be uploaded': '이미지 파일만 올릴 수 있습니다',
  'This file is not a readable image': '읽을 수 없는 이미지 파일입니다',
  'Photo not found': '사진을 찾을 수 없습니다',
  'Only the car owner can review this wash': '차량 소유자만 후기를 남길 수 있습니다',
  'You can rate a wash once it is done': '세차가 끝난 뒤에 평가할 수 있습니다',
  'Choose at least one wash day': '세차 요일을 하나 이상 선택해 주세요',
  'Invalid weekday': '요일이 올바르지 않습니다',
  'Each weekday can only be chosen once': '같은 요일은 한 번만 선택할 수 있습니다',
  'Weeks must be 1st & 3rd, 2nd & 4th, or every week': '주차는 첫째·셋째 주, 둘째·넷째 주 또는 매주 중에서 선택해 주세요',
  'month must be YYYY-MM': '월은 YYYY-MM 형식이어야 합니다',
  'phone must be a Korean mobile number like 010-1234-5678': '전화번호는 010-1234-5678 같은 휴대전화 번호여야 합니다',
};

/** Messages with numbers or names in them. */
const KO_PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^Wrong code\. (\d+) attempt\(s\) left\.$/, (n) => `인증번호가 올바르지 않습니다. ${n}번 더 시도할 수 있습니다.`],
  [/^A car is not scheduled on (\S+)$/, (d) => `${d}에 세차 일정이 없는 차량이 있습니다`],
  [/^startDate must be within (\d+) days$/, (n) => `시작 날짜는 ${n}일 이내여야 합니다`],
  [/^At most (\d+) photos per wash$/, (n) => `세차 한 번에 사진은 최대 ${n}장까지 올릴 수 있습니다`],
  [/^Reviews are open for (\d+) days after the wash$/, (n) => `후기는 세차 후 ${n}일 동안 남길 수 있습니다`],
  [
    /^This tariff includes (\d+) washes per month, but the chosen days give (\d+)$/,
    (a, b) => `이 요금제는 월 ${a}회 세차인데, 선택한 요일로는 ${b}회입니다`,
  ],
];

/** The API's error message in the member's language. */
export function translateMessage(message: string, lang: Lang): string {
  if (lang === 'en') return message;
  const exact = KO_MESSAGES[message];
  if (exact) return exact;
  for (const [re, make] of KO_PATTERNS) {
    const m = message.match(re);
    if (m) return make(...m.slice(1));
  }
  return message;
}
