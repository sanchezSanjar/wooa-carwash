import { dayLabel, forecastSummary, pickLang, translateMessage, won } from './i18n';
import { NotificationText } from './notify';

describe('i18n', () => {
  it('reads the language from Accept-Language', () => {
    expect(pickLang('ko-KR,ko;q=0.9,en;q=0.8')).toBe('ko');
    expect(pickLang('en-US')).toBe('en');
    expect(pickLang(undefined)).toBe('en');
  });

  it('formats dates, money and weather in both languages', () => {
    expect(dayLabel('2026-11-16', 'en')).toBe('Mon, Nov 16');
    expect(dayLabel('2026-11-16', 'ko')).toBe('11월 16일 (월)');
    expect(won(40000, 'en')).toBe('₩40,000');
    expect(won(40000, 'ko')).toBe('40,000원');
    const rain = { pop: 70, precipitation: 'rain', tempMin: 4, tempMax: 11 };
    expect(forecastSummary(rain, 'en')).toBe('Rain likely (70%) · 4–11°C');
    expect(forecastSummary(rain, 'ko')).toBe('비 예상 (70%) · 4–11°C');
    expect(forecastSummary({ pop: 10, precipitation: 'none' }, 'ko')).toBe('비 소식 없음');
  });

  it('translates API messages, including ones with numbers', () => {
    expect(translateMessage('Car not found', 'ko')).toBe('차량을 찾을 수 없습니다');
    expect(translateMessage('Wrong code. 2 attempt(s) left.', 'ko')).toBe('인증번호가 올바르지 않습니다. 2번 더 시도할 수 있습니다.');
    expect(translateMessage('Car not found', 'en')).toBe('Car not found');
    expect(translateMessage('Something new', 'ko')).toBe('Something new');
  });

  it('writes notices in the member language', () => {
    const car = { plateNumber: '12가 3456', buildingNumber: '101', parkingFloor: 'B2' };
    expect(NotificationText.reminder(car, '2026-11-16', ['실내 청소'], 'ko')).toEqual({
      title: '내일 세차: 12가 3456',
      body: '11월 16일 (월)에 101동 B2층 주차장에서 세차합니다. 추가 서비스: 실내 청소.',
    });
    expect(NotificationText.washed(car, '2026-11-16', 'en').body).toBe('Your car was washed on Mon, Nov 16.');
  });
});
