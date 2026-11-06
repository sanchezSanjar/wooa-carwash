import * as SecureStore from 'expo-secure-store';

/** Token storage on iOS/Android (Keychain / Keystore). */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync('wooa.token'),
  set: (value: string) => SecureStore.setItemAsync('wooa.token', value),
  clear: () => SecureStore.deleteItemAsync('wooa.token'),
};
