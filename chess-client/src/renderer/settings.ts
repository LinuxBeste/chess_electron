import { store } from './store';
import logger from './logger';

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

  /* ── General :: Language ── */
  language: 'en' | 'de';

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
  sidebarPosition: 'left' | 'right';
  showPlayerNames: boolean;
  showGameInfo: boolean;
  showGameResultPopup: boolean;

  /* ── Display :: Visuals ── */
  uiTheme: 'default' | 'slate';
  background: 'default' | 'dots' | 'grid' | 'none';
  showLegalHints: boolean;
  showThreats: boolean;
  showEvalBar: boolean;
  showOpponentClock: boolean;
  fullscreenMode: boolean;

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
  confirmMove: boolean;
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

// Default values for all user-configurable settings
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

  /* ── General :: Language ── */
  language: 'en',

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
  sidebarPosition: 'right',
  showPlayerNames: true,
  showGameInfo: true,
  showGameResultPopup: true,

  /* ── Display :: Visuals ── */
  uiTheme: 'default',
  background: 'default',
  showLegalHints: true,
  showThreats: false,
  showEvalBar: false,
  showOpponentClock: true,
  fullscreenMode: false,

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
  confirmMove: false,
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

// Load settings from localStorage, merging with defaults
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      cachedSettings = { ...defaultSettings, ...JSON.parse(raw) };
      logger.info('Settings loaded from localStorage');
      return cachedSettings;
    }
    logger.info('No saved settings found, using defaults');
  } catch (e) {
    logger.warn('Failed to parse settings from localStorage, using defaults', e);
  }
  return cachedSettings;
}

// Persist settings to localStorage and apply all visual themes
export function saveSettings(settings: AppSettings): void {
  cachedSettings = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  logger.info('Settings saved', {
    theme: settings.boardTheme,
    soundEnabled: settings.soundEnabled,
    language: settings.language,
  });
  applyUiTheme(settings.uiTheme);
  applyTheme(settings.boardTheme);
  applyBoardStyle(settings.boardStyle);
  applyBackground(settings.background);
  applyBoardSize(settings.boardSize);
  applyCompactMode(settings.compactMode);
  applyReduceMotion(settings.reduceMotion);
  applyBoardBorder(settings.boardBorder);
  store.set('sidebarPosition', settings.sidebarPosition);
}

// Get a single setting value from the cached settings
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return cachedSettings[key];
}

// Apply board theme via data-theme attribute on <html>
export function applyTheme(theme: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  if (theme !== 'default') {
    root.setAttribute('data-theme', theme);
  }
  logger.info('Theme applied', theme);
}

// Apply board visual style via data-board-style attribute
export function applyBoardStyle(style: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-board-style');
  if (style !== 'default') {
    root.setAttribute('data-board-style', style);
  }
  logger.info('Board style applied', style);
}

// Apply background pattern via data-background attribute
export function applyBackground(bg: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-background');
  if (bg !== 'default') {
    root.setAttribute('data-background', bg);
  }
  logger.info('Background applied', bg);
}

// Apply board size via data-board-size attribute
export function applyBoardSize(size: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-board-size');
  if (size !== 'medium') root.setAttribute('data-board-size', size);
  logger.info('Board size applied', size);
}

// Toggle compact UI mode via data-compact attribute
export function applyCompactMode(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) root.setAttribute('data-compact', 'true');
  else root.removeAttribute('data-compact');
  logger.info('Compact mode', enabled ? 'enabled' : 'disabled');
}

// Toggle reduced motion via data-reduce-motion attribute
export function applyReduceMotion(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) root.setAttribute('data-reduce-motion', 'true');
  else root.removeAttribute('data-reduce-motion');
  logger.info('Reduce motion', enabled ? 'enabled' : 'disabled');
}

// List all keys currently stored in localStorage
export function getLocalStorageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

// Remove a single key from localStorage
export function clearLocalStorageKey(key: string): void {
  localStorage.removeItem(key);
  logger.info('LocalStorage key cleared', key);
}

// Clear all localStorage data (logout/uninstall)
export function clearAllLocalData(): void {
  localStorage.clear();
  logger.info('All local data cleared');
}

// Apply UI color theme via data-ui-theme attribute
export function applyUiTheme(theme: string): void {
  const root = document.documentElement;
  root.removeAttribute('data-ui-theme');
  if (theme !== 'default') {
    root.setAttribute('data-ui-theme', theme);
  }
  logger.info('UI theme applied', theme);
}

// Toggle board border via data-board-border attribute
export function applyBoardBorder(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) root.setAttribute('data-board-border', 'true');
  else root.removeAttribute('data-board-border');
  logger.info('Board border', enabled ? 'enabled' : 'disabled');
}

/* Apply saved settings immediately on module load — prevents a flash
   of unstyled content before React mounts. */
const initial = loadSettings();
logger.info('Applying initial settings on module load', {
  theme: initial.boardTheme,
  language: initial.language,
  soundEnabled: initial.soundEnabled,
});
applyUiTheme(initial.uiTheme);
applyTheme(initial.boardTheme);
applyBoardStyle(initial.boardStyle);
applyBackground(initial.background);
applyBoardSize(initial.boardSize);
applyCompactMode(initial.compactMode);
applyReduceMotion(initial.reduceMotion);
applyBoardBorder(initial.boardBorder);
