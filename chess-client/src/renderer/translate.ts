import logger from './logger';
import { en, de, type TranslationKeys } from './locales';
import { loadSettings } from './settings';

let current: TranslationKeys = en;
let currentLang: string = 'en';
let changeListeners: Array<() => void> = [];

/** Subscribe to language changes. Returns an unsubscribe function. */
export function onLanguageChange(listener: () => void): () => void {
  changeListeners.push(listener);
  return () => {
    changeListeners = changeListeners.filter((l) => l !== listener);
  };
}

// Switch the active locale and persist it
export function setLanguage(lang: string): void {
  currentLang = lang;
  current = lang === 'de' ? de : en;
  try {
    localStorage.setItem('chess_locale', lang);
  } catch {}
  changeListeners.forEach((l) => l());
  logger.info('Language changed', lang);
}

// Get the currently active language code
export function getLanguage(): string {
  return currentLang;
}

// Translate a dot-separated key, optionally interpolating vars
export function t(path: string, vars?: Record<string, string | number>): string {
  const keys = path.split('.');
  let value: unknown = current;
  for (const key of keys) {
    if (value === null || value === undefined) return path;
    value = (value as Record<string, unknown>)[key];
  }
  if (typeof value !== 'string') return path;
  if (vars) {
    return value.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
  }
  return value;
}

try {
  const settingsLang = loadSettings().language;
  if (settingsLang === 'de' || settingsLang === 'en') {
    setLanguage(settingsLang);
  } else {
    const saved = localStorage.getItem('chess_locale');
    if (saved === 'de' || saved === 'en') setLanguage(saved);
  }
  logger.info('Translation initialized', currentLang);
} catch (e) {
  logger.warn('Translation initialization failed', e);
}
