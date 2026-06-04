export interface AppSettings {
  soundEnabled: boolean;
  soundVolume: number;
  animationsEnabled: boolean;
  boardTheme: 'default' | 'classic' | 'blue' | 'green' | 'gray' | 'amber';
  alwaysWhiteBottom: boolean;
  showLegalHints: boolean;
  showCoordinates: boolean;
  highlightLastMove: boolean;
  autoPromoteQueen: boolean;
  moveAnimationSpeed: 'fast' | 'normal' | 'slow';
  confirmResign: boolean;
  confirmDraw: boolean;
  pieceSet: 'emoji' | 'svg';
}

const SETTINGS_KEY = 'chess_settings';

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

/* Apply saved theme on load */
applyTheme(loadSettings().boardTheme);
