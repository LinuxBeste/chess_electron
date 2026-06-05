import { describe, test, expect, beforeEach } from '@jest/globals';

const SETTINGS_KEY = 'chess_settings';

interface AppSettings {
  soundEnabled: boolean;
  soundVolume: number;
  animationsEnabled: boolean;
  boardTheme: string;
  alwaysWhiteBottom: boolean;
  showLegalHints: boolean;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  autoPromoteQueen: boolean;
  moveAnimationSpeed: string;
  confirmResign: boolean;
  confirmDraw: boolean;
  pieceSet: string;
  moveSound: string;
  captureSound: string;
  notificationEnabled: boolean;
  pieceAnimation: string;
  animateBoardFlip: boolean;
  reduceMotion: boolean;
  pieceDropShadow: boolean;
  boardStyle: string;
  boardSize: string;
  boardBorder: boolean;
  boardCoordinateStyle: string;
  highlightCheck: boolean;
  showMoveHistory: boolean;
  showCapturedPieces: boolean;
  showMaterialDifference: boolean;
  showMoveArrows: boolean;
  compactMode: boolean;
  uiDensity: string;
  showPlayerNames: boolean;
  showGameInfo: boolean;
  showGameResultPopup: boolean;
  autoFlipBoard: boolean;
  background: string;
  showThreats: boolean;
  showOpponentClock: boolean;
  clockStyle: string;
  clockDecimalPlaces: number;
  premove: boolean;
  clickToMove: boolean;
  showMovePreview: boolean;
  moveNotation: string;
  enableKeyboardNavigation: boolean;
  enableOpeningBook: boolean;
  confirmAbort: boolean;
  autoNextGame: boolean;
  showTimestampsInHistory: boolean;
  timeControlMinutes: number;
  timeControlIncrement: number;
}

const defaultSettings: AppSettings = {
  soundEnabled: true,
  soundVolume: 100,
  animationsEnabled: true,
  boardTheme: 'default',
  alwaysWhiteBottom: false,
  showLegalHints: true,
  showCoordinates: true,
  highlightLastMove: true,
  autoPromoteQueen: false,
  moveAnimationSpeed: 'normal',
  confirmResign: true,
  confirmDraw: false,
  pieceSet: 'svg',
  moveSound: 'default',
  captureSound: 'default',
  notificationEnabled: true,
  pieceAnimation: 'slide',
  animateBoardFlip: true,
  reduceMotion: false,
  pieceDropShadow: true,
  boardStyle: 'default',
  boardSize: 'medium',
  boardBorder: false,
  boardCoordinateStyle: 'standard',
  highlightCheck: true,
  showMoveHistory: true,
  showCapturedPieces: true,
  showMaterialDifference: true,
  showMoveArrows: true,
  compactMode: false,
  uiDensity: 'normal',
  showPlayerNames: true,
  showGameInfo: true,
  showGameResultPopup: true,
  autoFlipBoard: false,
  background: 'default',
  showThreats: false,
  showOpponentClock: true,
  clockStyle: 'digital',
  clockDecimalPlaces: 0,
  premove: false,
  clickToMove: false,
  showMovePreview: true,
  moveNotation: 'short',
  enableKeyboardNavigation: false,
  enableOpeningBook: false,
  confirmAbort: false,
  autoNextGame: false,
  showTimestampsInHistory: false,
  timeControlMinutes: 5,
  timeControlIncrement: 0,
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
    expect(defaultSettings.soundVolume).toBe(100);
    expect(defaultSettings.animationsEnabled).toBe(true);
    expect(defaultSettings.boardTheme).toBe('default');
    expect(defaultSettings.alwaysWhiteBottom).toBe(false);
    expect(defaultSettings.showLegalHints).toBe(true);
    expect(defaultSettings.showCoordinates).toBe(true);
    expect(defaultSettings.highlightLastMove).toBe(true);
    expect(defaultSettings.autoPromoteQueen).toBe(false);
    expect(defaultSettings.moveAnimationSpeed).toBe('normal');
    expect(defaultSettings.confirmResign).toBe(true);
    expect(defaultSettings.confirmDraw).toBe(false);
    expect(defaultSettings.pieceSet).toBe('svg');
    expect(defaultSettings.moveSound).toBe('default');
    expect(defaultSettings.captureSound).toBe('default');
    expect(defaultSettings.notificationEnabled).toBe(true);
    expect(defaultSettings.pieceAnimation).toBe('slide');
    expect(defaultSettings.animateBoardFlip).toBe(true);
    expect(defaultSettings.reduceMotion).toBe(false);
    expect(defaultSettings.pieceDropShadow).toBe(true);
    expect(defaultSettings.boardStyle).toBe('default');
    expect(defaultSettings.boardSize).toBe('medium');
    expect(defaultSettings.boardBorder).toBe(false);
    expect(defaultSettings.boardCoordinateStyle).toBe('standard');
    expect(defaultSettings.highlightCheck).toBe(true);
    expect(defaultSettings.showMoveHistory).toBe(true);
    expect(defaultSettings.showCapturedPieces).toBe(true);
    expect(defaultSettings.showMaterialDifference).toBe(true);
    expect(defaultSettings.showMoveArrows).toBe(true);
    expect(defaultSettings.compactMode).toBe(false);
    expect(defaultSettings.uiDensity).toBe('normal');
    expect(defaultSettings.showPlayerNames).toBe(true);
    expect(defaultSettings.showGameInfo).toBe(true);
    expect(defaultSettings.showGameResultPopup).toBe(true);
    expect(defaultSettings.autoFlipBoard).toBe(false);
    expect(defaultSettings.background).toBe('default');
    expect(defaultSettings.showThreats).toBe(false);
    expect(defaultSettings.showOpponentClock).toBe(true);
    expect(defaultSettings.clockStyle).toBe('digital');
    expect(defaultSettings.clockDecimalPlaces).toBe(0);
    expect(defaultSettings.premove).toBe(false);
    expect(defaultSettings.clickToMove).toBe(false);
    expect(defaultSettings.showMovePreview).toBe(true);
    expect(defaultSettings.moveNotation).toBe('short');
    expect(defaultSettings.enableKeyboardNavigation).toBe(false);
    expect(defaultSettings.enableOpeningBook).toBe(false);
    expect(defaultSettings.confirmAbort).toBe(false);
    expect(defaultSettings.autoNextGame).toBe(false);
    expect(defaultSettings.showTimestampsInHistory).toBe(false);
    expect(defaultSettings.timeControlMinutes).toBe(5);
    expect(defaultSettings.timeControlIncrement).toBe(0);
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
