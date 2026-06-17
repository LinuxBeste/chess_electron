/**
 * Tests for the settings module (loadSettings, saveSettings, getSetting).
 *
 * These import from the real settings.ts module and use the jsdom-localStorage
 * mock provided by tests/setup.ts.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { loadSettings, saveSettings, getSetting, defaultSettings } from '../src/renderer/settings';

describe('settings module — getSetting', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('getSetting returns default value after loadSettings', () => {
    loadSettings();
    expect(getSetting('boardTheme')).toBe('default');
    expect(getSetting('soundEnabled')).toBe(true);
  });

  test('getSetting returns saved value', () => {
    loadSettings();
    const settings = { ...defaultSettings, boardTheme: 'classic' as const, soundEnabled: false as const };
    saveSettings(settings);
    expect(getSetting('boardTheme')).toBe('classic');
    expect(getSetting('soundEnabled')).toBe(false);
  });

  test('getSetting reads from cache without touching localStorage', () => {
    loadSettings();
    const settings = { ...defaultSettings, boardTheme: 'green' as const, soundEnabled: false as const };
    saveSettings(settings);

    /* Clear localStorage — getSetting should still return cached value */
    localStorage.clear();
    expect(getSetting('boardTheme')).toBe('green');
    expect(getSetting('soundEnabled')).toBe(false);
  });

  test('getSetting returns correct type for boolean setting', () => {
    loadSettings();
    expect(typeof getSetting('soundEnabled')).toBe('boolean');
  });

  test('getSetting returns correct type for string setting', () => {
    loadSettings();
    expect(typeof getSetting('boardTheme')).toBe('string');
  });
});
