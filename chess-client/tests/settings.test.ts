import { describe, test, expect, beforeEach } from '@jest/globals';

const SETTINGS_KEY = 'chess_settings';

interface AppSettings {
  soundEnabled: boolean;
  animationsEnabled: boolean;
  boardTheme: 'default' | 'classic' | 'blue' | 'green';
  alwaysWhiteBottom: boolean;
  showLegalHints: boolean;
  moveAnimationSpeed: 'fast' | 'normal' | 'slow';
  confirmResign: boolean;
}

const defaultSettings: AppSettings = {
  soundEnabled: true,
  animationsEnabled: true,
  boardTheme: 'default',
  alwaysWhiteBottom: false,
  showLegalHints: true,
  moveAnimationSpeed: 'normal',
  confirmResign: true,
};

function getLightColor(theme: string): string {
  switch (theme) {
    case 'classic': return '#f0d9b5';
    case 'blue': return '#dee3e6';
    case 'green': return '#eeeed2';
    case 'gray': return '#c8c8c8';
    case 'amber': return '#f5deb3';
    default: return '#3d3d52';
  }
}

function getDarkColor(theme: string): string {
  switch (theme) {
    case 'classic': return '#b58863';
    case 'blue': return '#8ca2ad';
    case 'green': return '#769656';
    case 'gray': return '#6b6b6b';
    case 'amber': return '#b8860b';
    default: return '#2c2c38';
  }
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...defaultSettings, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...defaultSettings };
}

function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}

describe('settings color functions', () => {
  test('getLightColor returns correct colors', () => {
    expect(getLightColor('default')).toBe('#3d3d52');
    expect(getLightColor('classic')).toBe('#f0d9b5');
    expect(getLightColor('blue')).toBe('#dee3e6');
    expect(getLightColor('green')).toBe('#eeeed2');
    expect(getLightColor('gray')).toBe('#c8c8c8');
    expect(getLightColor('amber')).toBe('#f5deb3');
  });

  test('getLightColor handles unknown theme with default', () => {
    expect(getLightColor('unknown')).toBe('#3d3d52');
    expect(getLightColor('')).toBe('#3d3d52');
  });

  test('getDarkColor returns correct colors', () => {
    expect(getDarkColor('default')).toBe('#2c2c38');
    expect(getDarkColor('classic')).toBe('#b58863');
    expect(getDarkColor('blue')).toBe('#8ca2ad');
    expect(getDarkColor('green')).toBe('#769656');
    expect(getDarkColor('gray')).toBe('#6b6b6b');
    expect(getDarkColor('amber')).toBe('#b8860b');
  });

  test('getDarkColor handles unknown theme with default', () => {
    expect(getDarkColor('unknown')).toBe('#2c2c38');
    expect(getDarkColor('')).toBe('#2c2c38');
  });

  test('light and dark colors differ for each theme', () => {
    for (const theme of ['default', 'classic', 'blue', 'green', 'gray', 'amber']) {
      expect(getLightColor(theme)).not.toBe(getDarkColor(theme));
    }
  });
});

describe('settings defaults', () => {
  test('default settings are correct', () => {
    expect(defaultSettings.soundEnabled).toBe(true);
    expect(defaultSettings.animationsEnabled).toBe(true);
    expect(defaultSettings.boardTheme).toBe('default');
    expect(defaultSettings.alwaysWhiteBottom).toBe(false);
    expect(defaultSettings.showLegalHints).toBe(true);
    expect(defaultSettings.moveAnimationSpeed).toBe('normal');
    expect(defaultSettings.confirmResign).toBe(true);
  });
});

describe('settings persistence', () => {
  beforeEach(() => {
    clearSettings();
  });

  test('loadSettings returns defaults when no saved settings', () => {
    const s = loadSettings();
    expect(s).toEqual(defaultSettings);
  });

  test('saveSettings persists to localStorage', () => {
    const modified: AppSettings = { ...defaultSettings, soundEnabled: false, boardTheme: 'green' };
    saveSettings(modified);
    const raw = localStorage.getItem(SETTINGS_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.soundEnabled).toBe(false);
    expect(parsed.boardTheme).toBe('green');
  });

  test('loadSettings merges saved values with defaults', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundEnabled: false }));
    const s = loadSettings();
    expect(s.soundEnabled).toBe(false);
    expect(s.animationsEnabled).toBe(true);
    expect(s.boardTheme).toBe('default');
  });

  test('loadSettings handles corrupted JSON gracefully', () => {
    localStorage.setItem(SETTINGS_KEY, 'not-json');
    const s = loadSettings();
    expect(s).toEqual(defaultSettings);
  });

  test('clearSettings removes saved data', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ soundEnabled: false }));
    clearSettings();
    const s = loadSettings();
    expect(s).toEqual(defaultSettings);
  });

  test('multiple saves overwrite previous values', () => {
    saveSettings({ ...defaultSettings, boardTheme: 'blue' });
    saveSettings({ ...defaultSettings, boardTheme: 'green' });
    const s = loadSettings();
    expect(s.boardTheme).toBe('green');
  });
});
