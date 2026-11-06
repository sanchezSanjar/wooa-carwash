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
