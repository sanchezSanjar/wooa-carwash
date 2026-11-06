import '@/global.css';

import { Platform } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Quiet, editorial palette: ink-black actions on white, a single green accent.
 * In dark mode the roles invert (light actions on near-black).
 */
export const Colors = {
  light: {
    text: '#14171A',
    textSecondary: '#5F6670',
    background: '#FFFFFF',
    surface: '#F6F7F8',
    card: '#FFFFFF',
    border: '#E2E5E9',
    primary: '#14171A',
    primaryText: '#FFFFFF',
    primarySoft: '#F1F3F5',
    accent: '#1E7F55',
    accentSoft: '#E4F4EC',
    danger: '#C93434',
    dangerSoft: '#FCECEC',
    success: '#1E7F55',
    successSoft: '#E4F4EC',
    warning: '#9A5B00',
    warningSoft: '#FFF2DB',
    muted: '#EEF0F2',
  },
  dark: {
    text: '#F2F3F5',
    textSecondary: '#A2A9B3',
    background: '#0E1012',
    surface: '#15181B',
    card: '#17191C',
    border: '#2A2E33',
    primary: '#F2F3F5',
    primaryText: '#0E1012',
    primarySoft: '#23272B',
    accent: '#5CCB93',
    accentSoft: '#163323',
    danger: '#FF6B6B',
    dangerSoft: '#3A1719',
    success: '#5CCB93',
    successSoft: '#163323',
    warning: '#F0B04A',
    warningSoft: '#33260F',
    muted: '#1E2125',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}

export const Fonts = Platform.select({
  web: { sans: 'var(--font-display)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' },
  ios: { sans: undefined, serif: 'Georgia', mono: 'Menlo' },
  default: { sans: undefined, serif: 'serif', mono: 'monospace' },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const MaxContentWidth = 1040;
