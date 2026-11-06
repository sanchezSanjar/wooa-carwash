import * as SecureStore from 'expo-secure-store';

import { isLang, type Lang } from './lang';

/** Token storage on iOS/Android (Keychain / Keystore). */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync('wooa.token'),
  set: (value: string) => SecureStore.setItemAsync('wooa.token', value),
  clear: () => SecureStore.deleteItemAsync('wooa.token'),
};

/** The language the member picked. */
export const langStorage = {
  get: async (): Promise<Lang | null> => {
    const v = await SecureStore.getItemAsync('wooa.lang').catch(() => null);
    return isLang(v) ? v : null;
  },
  set: (lang: Lang) => SecureStore.setItemAsync('wooa.lang', lang).catch(() => undefined),
};
