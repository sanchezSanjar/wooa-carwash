import '@/global.css';

import { Platform } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const Colors = {
  light: {
    text: '#0B1B2B',
    textSecondary: '#5B6B7C',
    background: '#F4F7FB',
    card: '#FFFFFF',
    border: '#DCE3EC',
    primary: '#1565E8',
    primaryText: '#FFFFFF',
    primarySoft: '#E3EDFD',
    danger: '#D93636',
    dangerSoft: '#FDECEC',
    success: '#16834A',
    successSoft: '#E3F6EB',
    warning: '#A86400',
    warningSoft: '#FFF3DC',
    muted: '#EEF2F7',
  },
  dark: {
    text: '#EAF1F8',
    textSecondary: '#9AABBD',
    background: '#07111C',
    card: '#0F1D2C',
    border: '#1F3146',
    primary: '#4A8DFF',
    primaryText: '#FFFFFF',
    primarySoft: '#13294A',
    danger: '#FF6B6B',
    dangerSoft: '#3A1719',
    success: '#4CCB85',
    successSoft: '#10301F',
    warning: '#F0B04A',
    warningSoft: '#33260F',
    muted: '#152536',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
}

export const Fonts = Platform.select({
  web: { sans: 'var(--font-display)', mono: 'var(--font-mono)' },
  default: { sans: undefined, mono: 'monospace' },
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

export const MaxContentWidth = 960;
