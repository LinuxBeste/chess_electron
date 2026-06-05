/**
 * AppSettings defines all user-configurable preferences.
 *
 * The settings module is the single source of truth for theme, sound,
 * board style, and gameplay toggles. Settings are persisted to localStorage
 * and applied immediately to the DOM via data-* attributes on <html>.
 *
 * A cached copy avoids repeated JSON.parse on every getSetting() call.
 */

export interface AppSettings {
  /* ── General :: Sound ── */
  soundEnabled: boolean;
  soundVolume: number;
  moveSound: 'default' | 'click' | 'wood' | 'none';
  captureSound: 'default' | 'click' | 'wood' | 'none';
  notificationEnabled: boolean;

  /* ── General :: Animations ── */
  animationsEnabled: boolean;
  moveAnimationSpeed: 'fast' | 'normal' | 'slow';
  pieceAnimation: 'none' | 'slide' | 'pop';
  animateBoardFlip: boolean;
  reduceMotion: boolean;

  /* ── General :: Pieces ── */
  pieceSet: 'emoji' | 'svg';
  pieceDropShadow: boolean;

  /* ── Board :: Theme & Style ── */
  boardTheme: 'default' | 'classic' | 'blue' | 'green' | 'gray' | 'amber';
  boardStyle: 'default' | 'rounded' | 'framed';
  boardSize: 'small' | 'medium' | 'large';
  boardBorder: boolean;
  boardCoordinateStyle: 'standard' | 'none';

  /* ── Board :: Labels & Info ── */
  showCoordinates: boolean;
  highlightLastMove: boolean;
  highlightCheck: boolean;
  showMoveHistory: boolean;
  showCapturedPieces: boolean;
  showMaterialDifference: boolean;
  showMoveArrows: boolean;

  /* ── Display :: Layout ── */
  alwaysWhiteBottom: boolean;
  autoFlipBoard: boolean;
  compactMode: boolean;
  uiDensity: 'compact' | 'normal' | 'spacious';
  showPlayerNames: boolean;
  showGameInfo: boolean;
  showGameResultPopup: boolean;

  /* ── Display :: Visuals ── */
  background: 'default' | 'dots' | 'grid' | 'none';
  showLegalHints: boolean;
  showThreats: boolean;
  showOpponentClock: boolean;

  /* ── Display :: Clock ── */
  clockDecimalPlaces: 0 | 1 | 2;
  clockStyle: 'digital' | 'minimal';

  /* ── Gameplay :: Moves ── */
  autoPromoteQueen: boolean;
  premove: boolean;
  clickToMove: boolean;
  showMovePreview: boolean;
  moveNotation: 'short' | 'long';
  enableKeyboardNavigation: boolean;
  enableOpeningBook: boolean;

  /* ── Gameplay :: Confirmation ── */
  confirmResign: boolean;
  confirmDraw: boolean;
  confirmAbort: boolean;
  autoNextGame: boolean;

  /* ── Display :: History ── */
  showTimestampsInHistory: boolean;

  /* ── Clock :: Time Control ── */
  timeControlMinutes: number;
  timeControlIncrement: number;

  /* ── Advanced :: Server ── */
  alwaysAskServerUrl: boolean;

  /* ── Advanced :: Session ── */
  autoLogoutMinutes: number;
}

const SETTINGS_KEY = 'chess_settings';

export const defaultSettings: AppSettings = {
  /* ── General :: Sound ── */
  soundEnabled: true,
  soundVolume: 100,
  moveSound: 'default',
  captureSound: 'default',
  notificationEnabled: true,

  /* ── General :: Animations ── */
  animationsEnabled: true,
  moveAnimationSpeed: 'normal',
  pieceAnimation: 'slide',
  animateBoardFlip: true,
  reduceMotion: false,

  /* ── General :: Pieces ── */
  pieceSet: 'svg',
  pieceDropShadow: true,

  /* ── Board :: Theme & Style ── */
  boardTheme: 'default',
  boardStyle: 'default',
  boardSize: 'medium',
  boardBorder: false,
  boardCoordinateStyle: 'standard',

  /* ── Board :: Labels & Info ── */
  showCoordinates: true,
  highlightLastMove: true,
  highlightCheck: true,
  showMoveHistory: true,
  showCapturedPieces: true,
  showMaterialDifference: true,
  showMoveArrows: true,

  /* ── Display :: Layout ── */
  alwaysWhiteBottom: false,
  autoFlipBoard: false,
  compactMode: false,
  uiDensity: 'normal',
  showPlayerNames: true,
  showGameInfo: true,
  showGameResultPopup: true,

  /* ── Display :: Visuals ── */
  background: 'default',
  showLegalHints: true,
  showThreats: false,
  showOpponentClock: true,

  /* ── Display :: Clock ── */
  clockDecimalPlaces: 0,
  clockStyle: 'digital',

  /* ── Gameplay :: Moves ── */
  autoPromoteQueen: false,
  premove: false,
  clickToMove: false,
  showMovePreview: true,
  moveNotation: 'short',
  enableKeyboardNavigation: false,
  enableOpeningBook: false,

  /* ── Gameplay :: Confirmation ── */
  confirmResign: true,
  confirmDraw: false,
  confirmAbort: false,
  autoNextGame: false,

  /* ── Display :: History ── */
  showTimestampsInHistory: false,

  /* ── Clock :: Time Control ── */
  timeControlMinutes: 5,
  timeControlIncrement: 0,

  /* ── Advanced :: Server ── */
  alwaysAskServerUrl: false,

  /* ── Advanced :: Session ── */
  autoLogoutMinutes: 0,
};

let cachedSettings: AppSettings = { ...defaultSettings };

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      cachedSettings = { ...defaultSettings, ...JSON.parse(raw) };
      return cachedSettings;
    }
  } catch {}
  return cachedSettings;
}

export function saveSettings(settings: AppSettings): void {
  cachedSettings = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyTheme(settings.boardTheme);
  applyBoardStyle(settings.boardStyle);
  applyBackground(settings.background);
  applyBoardSize(settings.boardSize);
  applyCompactMode(settings.compactMode);
  applyReduceMotion(settings.reduceMotion);
  applyBoardBorder(settings.boardBorder);
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return loadSettings()[key];
}

export function applyTheme(theme: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  if (theme !== 'default') {
    root.setAttribute('data-theme', theme);
  }
}

export function applyBoardStyle(style: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-board-style');
  if (style !== 'default') {
    root.setAttribute('data-board-style', style);
  }
}

export function applyBackground(bg: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-background');
  if (bg !== 'default') {
    root.setAttribute('data-background', bg);
  }
}

export function applyBoardSize(size: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-board-size');
  if (size !== 'medium') root.setAttribute('data-board-size', size);
}

export function applyCompactMode(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) root.setAttribute('data-compact', 'true');
  else root.removeAttribute('data-compact');
}

export function applyReduceMotion(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) root.setAttribute('data-reduce-motion', 'true');
  else root.removeAttribute('data-reduce-motion');
}

export function getLocalStorageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

export function clearLocalStorageKey(key: string): void {
  localStorage.removeItem(key);
}

export function clearAllLocalData(): void {
  localStorage.clear();
}

export function applyBoardBorder(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) root.setAttribute('data-board-border', 'true');
  else root.removeAttribute('data-board-border');
}

/* Apply saved settings immediately on module load — prevents a flash
   of unstyled content before React mounts. */
const initial = loadSettings();
applyTheme(initial.boardTheme);
applyBoardStyle(initial.boardStyle);
applyBackground(initial.background);
applyBoardSize(initial.boardSize);
applyCompactMode(initial.compactMode);
applyReduceMotion(initial.reduceMotion);
applyBoardBorder(initial.boardBorder);
