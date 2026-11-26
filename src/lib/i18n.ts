import { useCallback } from 'react';

import { getSettings, useSettings, type Language } from './settings';
import { ms } from './translations/ms';
import { ta } from './translations/ta';
import { zh } from './translations/zh';

export type { Language };

export const LANGUAGES: { code: Language; native: string; english: string }[] = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'ms', native: 'Bahasa Melayu', english: 'Malay' },
  { code: 'zh', native: '中文（简体）', english: 'Chinese, Simplified' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
];

const DICTIONARIES: Record<Language, Record<string, string>> = { en: {}, ms, zh, ta };

const LOCALES: Record<Language, string> = { en: 'en', ms: 'ms', zh: 'zh-CN', ta: 'ta' };

export type Params = Record<string, string | number>;

export function translate(language: Language, key: string, params?: Params) {
  let text = DICTIONARIES[language][key] ?? key;
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }
  return text;
}

export function t(key: string, params?: Params) {
  return translate(getSettings().language, key, params);
}

export function localeTag(language: Language = getSettings().language) {
  return LOCALES[language];
}

export function useT() {
  const { language } = useSettings();
  return useCallback((key: string, params?: Params) => translate(language, key, params), [language]);
}

export function useLocale() {
  const { language } = useSettings();
  return LOCALES[language];
}
