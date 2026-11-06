import { Alert, Platform } from 'react-native';

import { currentLang } from './api';
import { translate } from './i18n';

/** Cross-platform yes/no confirmation (Alert on native, window.confirm on web). */
export function confirm(title: string, message: string, confirmLabel = translate(currentLang(), 'OK')): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: translate(currentLang(), 'Back'), style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
