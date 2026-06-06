import { describe, test, expect, beforeEach } from '@jest/globals';
import { setLanguage, getLanguage, t } from '../src/renderer/translate';
import { getTranslations, getLanguageNames } from '../src/renderer/locales';

describe('translate', () => {
  beforeEach(() => {
    setLanguage('en');
  });

  test('getLanguage defaults to en', () => {
    expect(getLanguage()).toBe('en');
  });

  test('setLanguage changes language to de', () => {
    setLanguage('de');
    expect(getLanguage()).toBe('de');
  });

  test('setLanguage changes language back to en', () => {
    setLanguage('de');
    setLanguage('en');
    expect(getLanguage()).toBe('en');
  });

  test('t returns English text by default', () => {
    expect(t('login.quickPlay')).toBe('Quick Play');
    expect(t('common.you')).toBe('You');
  });

  test('t returns German text after setLanguage', () => {
    setLanguage('de');
    expect(t('login.quickPlay')).toBe('Schnellspiel');
    expect(t('common.you')).toBe('Du');
  });

  test('t returns path when key not found', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  test('t returns path for deeply missing key', () => {
    expect(t('login.quickPlay.nope')).toBe('login.quickPlay.nope');
  });

  test('t replaces single variable in template', () => {
    expect(t('stats.total', { count: 5 })).toBe('Total: 5 games');
  });

  test('t replaces multiple variables', () => {
    expect(t('localGame.wins', { color: 'White' })).toBe('White wins!');
  });

  test('t handles missing variable gracefully', () => {
    expect(t('stats.total', {})).toBe('Total: {count} games');
  });

  test('t reads non-template string correctly', () => {
    expect(t('login.quickPlayInfo')).toBe(
      'Quick play uses a display name only — no password, no saved stats.',
    );
  });
});

describe('locales', () => {
  test('getTranslations returns flat key-value map for en', () => {
    const flat = getTranslations('en');
    expect(flat['login.quickPlay']).toBe('Quick Play');
    expect(flat['common.you']).toBe('You');
    expect(flat['navbar.chess']).toBe('♚ Chess');
  });

  test('getTranslations returns flat key-value map for de', () => {
    const flat = getTranslations('de');
    expect(flat['login.quickPlay']).toBe('Schnellspiel');
    expect(flat['common.you']).toBe('Du');
    expect(flat['navbar.chess']).toBe('♚ Schach');
  });

  test('getTranslations for unknown locale falls back to English', () => {
    const flat = getTranslations('fr');
    expect(flat['login.quickPlay']).toBe('Quick Play');
  });

  test('getTranslations contains offline keys in en', () => {
    const flat = getTranslations('en');
    expect(flat['login.offlineMode']).toBe('Offline mode');
    expect(flat['login.offlineModeDesc']).toBe(
      'Play locally without a server. No stats, no history.',
    );
  });

  test('getTranslations contains offline keys in de', () => {
    const flat = getTranslations('de');
    expect(flat['login.offlineMode']).toBe('Offline-Modus');
    expect(flat['login.offlineModeDesc']).toBe(
      'Lokal spielen ohne Server. Keine Statistik, kein Verlauf.',
    );
  });

  test('getLanguageNames returns correct mapping', () => {
    const names = getLanguageNames();
    expect(names.en).toBe('English');
    expect(names.de).toBe('Deutsch');
  });
});
