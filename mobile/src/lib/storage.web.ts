import { isLang, type Lang } from './lang';

/** Token storage on the website. */
const KEY = 'wooa.token';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const tokenStorage = {
  get: async () => safe(() => window.localStorage.getItem(KEY), null),
  set: async (value: string) => safe(() => window.localStorage.setItem(KEY, value), undefined),
  clear: async () => safe(() => window.localStorage.removeItem(KEY), undefined),
};

/** The language the member picked. */
export const langStorage = {
  get: async (): Promise<Lang | null> => {
    const v = safe(() => window.localStorage.getItem('wooa.lang'), null);
    return isLang(v) ? v : null;
  },
  set: async (lang: Lang) => safe(() => window.localStorage.setItem('wooa.lang', lang), undefined),
};
