import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from './settings';

export type Colors = {
  PURPLE: string;
  PURPLE_DARK: string;
  PURPLE_TINT: string;
  ON_PURPLE: string;
  INK: string;
  MUTED: string;
  BORDER: string;
  TRACK: string;
  PANEL: string;
  BG: string;
  SURFACE: string;
  PILL_GRAY: string;
  GREEN: string;
  GREEN_BAR: string;
  GREEN_TINT: string;
  AMBER: string;
  AMBER_TINT: string;
  RED: string;
  RED_TINT: string;
  SKELETON: string;
  OVERLAY: string;
};

export const LIGHT: Colors = {
  PURPLE: '#9B87F0',
  PURPLE_DARK: '#5B3FD8',
  PURPLE_TINT: '#F0ECFD',
  ON_PURPLE: '#1A1530',
  INK: '#1A1530',
  MUTED: '#6B6880',
  BORDER: '#E6E3F0',
  TRACK: '#EFECF8',
  PANEL: '#F8F7FB',
  BG: '#FFFFFF',
  SURFACE: '#FFFFFF',
  PILL_GRAY: '#EFEFEF',
  GREEN: '#1B6B35',
  GREEN_BAR: '#1E7B3A',
  GREEN_TINT: '#E6F4EA',
  AMBER: '#9A4A06',
  AMBER_TINT: '#FFF1DD',
  RED: '#B42318',
  RED_TINT: '#FDECEA',
  SKELETON: '#E8E6EF',
  OVERLAY: 'rgba(0, 0, 0, 0.4)',
};

export const DARK: Colors = {
  PURPLE: '#9B87F0',
  PURPLE_DARK: '#B7A8FF',
  PURPLE_TINT: '#2B2655',
  ON_PURPLE: '#1A1530',
  INK: '#FFFFFF',
  MUTED: '#A9A5BE',
  BORDER: '#2E2C44',
  TRACK: '#2E2C44',
  PANEL: '#1A1927',
  BG: '#12111A',
  SURFACE: '#1C1B2B',
  PILL_GRAY: '#2A2840',
  GREEN: '#6FD58B',
  GREEN_BAR: '#4FBF70',
  GREEN_TINT: '#173424',
  AMBER: '#F4B26B',
  AMBER_TINT: '#3A2A14',
  RED: '#FF8A7A',
  RED_TINT: '#3A2024',
  SKELETON: '#2A2840',
  OVERLAY: 'rgba(0, 0, 0, 0.6)',
};

export function useIsDark() {
  const { theme } = useSettings();
  const system = useColorScheme();
  return theme === 'dark' || (theme === 'system' && system === 'dark');
}

export function useColors(): Colors {
  const dark = useIsDark();
  return useMemo(() => (dark ? DARK : LIGHT), [dark]);
}
