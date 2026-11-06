export type Lang = 'ko' | 'en';
export const LANGS: Lang[] = ['ko', 'en'];
export const LANG_NAMES: Record<Lang, string> = { ko: '한국어', en: 'English' };

/** The device language: English phones get English, everything else Korean. */
export function detectLang(): Lang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return locale.toLowerCase().startsWith('en') ? 'en' : 'ko';
  } catch {
    return 'ko';
  }
}

export const isLang = (v: unknown): v is Lang => v === 'ko' || v === 'en';
