import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

import { TONES, type Tone } from './reminders';

export type ThemeChoice = 'light' | 'dark' | 'system';

export type Language = 'en' | 'ms' | 'zh' | 'ta';

export type Settings = {
  theme: ThemeChoice;
  language: Language;
  tone: Tone;
  nudge: boolean;
};

const STORAGE_KEY = 'ez-split/settings/v1';

const DEFAULTS: Settings = { theme: 'system', language: 'en', tone: 'friendly', nudge: true };

const LANGUAGE_CODES: Language[] = ['en', 'ms', 'zh', 'ta'];

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeSettings(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let settings: Settings = { ...DEFAULTS };

function applyTheme() {
  try {
    Appearance.setColorScheme(settings.theme === 'system' ? 'unspecified' : settings.theme);
  } catch {
    // Not every platform can override the colour scheme.
  }
}

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      settings = {
        theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
        language: LANGUAGE_CODES.includes(parsed.language as Language) ? (parsed.language as Language) : DEFAULTS.language,
        tone: TONES.includes(parsed.tone as Tone) ? (parsed.tone as Tone) : DEFAULTS.tone,
        nudge: typeof parsed.nudge === 'boolean' ? parsed.nudge : DEFAULTS.nudge,
      };
    }
  } catch {
    settings = { ...DEFAULTS };
  }
  applyTheme();
  emit();
}

export function getSettings() {
  return settings;
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  applyTheme();
  emit();
  return settings;
}

export function useSettings() {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
