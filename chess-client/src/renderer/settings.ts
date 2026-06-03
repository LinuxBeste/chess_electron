/**
 * Settings manager — persists preferences to localStorage.
 * Includes a multi-tab settings dialog.
 */

export interface AppSettings {
  soundEnabled: boolean;
  animationsEnabled: boolean;
  boardTheme: 'default' | 'classic' | 'blue' | 'green';
  alwaysWhiteBottom: boolean;
  showLegalHints: boolean;
  moveAnimationSpeed: 'fast' | 'normal' | 'slow';
  confirmResign: boolean;
}

const SETTINGS_KEY = 'chess_settings';

const defaultSettings: AppSettings = {
  soundEnabled: true,
  animationsEnabled: true,
  boardTheme: 'default',
  alwaysWhiteBottom: false,
  showLegalHints: true,
  moveAnimationSpeed: 'normal',
  confirmResign: true,
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

/* ─── Settings Dialog ─── */

type TabId = 'general' | 'board' | 'display';

export function showSettingsDialog(): void {
  const settings = loadSettings();

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:2000;animation:fadeIn 200ms ease';

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 16px 48px rgba(0,0,0,0.5);width:440px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;animation:scaleIn 300ms cubic-bezier(0.34,1.56,0.64,1)';

  /* Header */
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0';
  const title = document.createElement('h2');
  title.style.cssText = 'font-size:20px;font-weight:700;color:#e0e0e0;letter-spacing:-0.3px';
  title.textContent = 'Settings';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '\u2715';
  closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:4px;transition:color 150ms ease';
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#e0e0e0');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#888');
  closeBtn.addEventListener('click', () => overlay.remove());
  header.appendChild(title);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  /* Tab bar */
  const tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:4px;padding:16px 24px 0;border-bottom:1px solid rgba(255,255,255,0.06)';

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'board', label: 'Board' },
    { id: 'display', label: 'Display' },
  ];

  const tabButtons: Record<string, HTMLButtonElement> = {};
  let activeTab: TabId = 'general';

  function switchTab(tabId: TabId): void {
    activeTab = tabId;
    for (const [id, btn] of Object.entries(tabButtons)) {
      btn.style.background = id === tabId ? 'rgba(79,142,247,0.15)' : 'transparent';
      btn.style.color = id === tabId ? '#4f8ef7' : '#888';
    }
    renderContent(tabId);
  }

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.textContent = tab.label;
    btn.style.cssText = 'padding:8px 16px;background:transparent;border:none;border-radius:6px 6px 0 0;font-size:13px;font-weight:500;cursor:pointer;transition:background 150ms ease,color 150ms ease;letter-spacing:0.3px;color:#888';
    btn.addEventListener('click', () => switchTab(tab.id));
    tabBar.appendChild(btn);
    tabButtons[tab.id] = btn;
  }
  dialog.appendChild(tabBar);

  /* Content area */
  const contentArea = document.createElement('div');
  contentArea.style.cssText = 'padding:24px;overflow-y:auto;flex:1;min-height:250px';

  function renderContent(tabId: TabId): void {
    contentArea.innerHTML = '';
    const s = loadSettings();

    switch (tabId) {
      case 'general':
        renderGeneralTab(contentArea, s);
        break;
      case 'board':
        renderBoardTab(contentArea, s);
        break;
      case 'display':
        renderDisplayTab(contentArea, s);
        break;
    }
  }

  dialog.appendChild(contentArea);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  /* Initialize first tab */
  switchTab('general');

  /* Close on overlay click */
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function createToggleRow(label: string, desc: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)';

  const textCol = document.createElement('div');
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:14px;font-weight:500;color:#e0e0e0;letter-spacing:0.2px';
  lbl.textContent = label;
  textCol.appendChild(lbl);
  if (desc) {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:12px;font-weight:300;color:#888;margin-top:2px';
    d.textContent = desc;
    textCol.appendChild(d);
  }
  row.appendChild(textCol);

  const toggle = document.createElement('div');
  toggle.style.cssText = `width:40px;height:22px;border-radius:11px;${checked ? 'background:#4f8ef7' : 'background:#333'};cursor:pointer;position:relative;flex-shrink:0;transition:background 150ms ease`;
  const knob = document.createElement('div');
  knob.style.cssText = `width:18px;height:18px;border-radius:50%;${checked ? 'background:#fff;left:20px' : 'background:#888;left:2px'};position:absolute;top:2px;transition:all 150ms ease`;
  toggle.appendChild(knob);

  let isChecked = checked;
  toggle.addEventListener('click', () => {
    isChecked = !isChecked;
    toggle.style.background = isChecked ? '#4f8ef7' : '#333';
    knob.style.left = isChecked ? '20px' : '2px';
    knob.style.background = isChecked ? '#fff' : '#888';
    onChange(isChecked);
  });

  row.appendChild(toggle);
  return row;
}

function createSelectRow(label: string, desc: string, options: { value: string; label: string }[], selected: string, onChange: (v: string) => void): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04)';

  const textCol = document.createElement('div');
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:14px;font-weight:500;color:#e0e0e0;letter-spacing:0.2px';
  lbl.textContent = label;
  textCol.appendChild(lbl);
  if (desc) {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:12px;font-weight:300;color:#888;margin-top:2px';
    d.textContent = desc;
    textCol.appendChild(d);
  }
  row.appendChild(textCol);

  const select = document.createElement('select');
  select.style.cssText = 'padding:8px 12px;background:#222228;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e0e0e0;font-size:13px;outline:none;cursor:pointer';
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === selected) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  row.appendChild(select);
  return row;
}

const themeOptions = [
  { value: 'default', label: 'Default (Purple)' },
  { value: 'classic', label: 'Classic Wood' },
  { value: 'blue', label: 'Ocean Blue' },
  { value: 'green', label: 'Forest Green' },
  { value: 'gray', label: 'Slate Gray' },
  { value: 'amber', label: 'Amber Glow' },
];

function renderGeneralTab(area: HTMLElement, settings: AppSettings): void {
  area.appendChild(createToggleRow('Sound Effects', 'Play sounds for moves, captures, and check', settings.soundEnabled, (v) => {
    const s = loadSettings(); s.soundEnabled = v; saveSettings(s);
  }));
  area.appendChild(createToggleRow('Animations', 'Animate piece movement and transitions', settings.animationsEnabled, (v) => {
    const s = loadSettings(); s.animationsEnabled = v; saveSettings(s);
  }));
  area.appendChild(createSelectRow('Animation Speed', 'How fast pieces slide', [
    { value: 'fast', label: 'Fast' },
    { value: 'normal', label: 'Normal' },
    { value: 'slow', label: 'Slow' },
  ], settings.moveAnimationSpeed, (v) => {
    const s = loadSettings(); s.moveAnimationSpeed = v as any; saveSettings(s);
  }));
  area.appendChild(createToggleRow('Confirm Resign', 'Require double-click to resign', settings.confirmResign, (v) => {
    const s = loadSettings(); s.confirmResign = v; saveSettings(s);
  }));
}

function renderBoardTab(area: HTMLElement, settings: AppSettings): void {
  area.appendChild(createSelectRow('Board Theme', 'Color scheme for the chess board', themeOptions, settings.boardTheme, (v) => {
    const s = loadSettings(); s.boardTheme = v as any; saveSettings(s);
    /* Refresh preview */
    renderBoardTab(area, loadSettings());
  }));

  const preview = document.createElement('div');
  preview.style.cssText = 'margin-top:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:2px;width:160px;height:160px;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)';

  const theme = settings.boardTheme;
  for (let i = 0; i < 16; i++) {
    const sq = document.createElement('div');
    const light = (Math.floor(i / 4) + i % 4) % 2 === 0;
    sq.style.cssText = `background:${light ? getLightColor(theme) : getDarkColor(theme)}`;
    preview.appendChild(sq);
  }

  const previewWrapper = document.createElement('div');
  previewWrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;margin-top:16px';
  const previewLabel = document.createElement('div');
  previewLabel.style.cssText = 'font-size:11px;font-weight:300;color:#888;margin-bottom:8px;letter-spacing:0.3px;text-transform:uppercase';
  previewLabel.textContent = 'Preview';
  previewWrapper.appendChild(previewLabel);
  previewWrapper.appendChild(preview);
  area.appendChild(previewWrapper);
}

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

function renderDisplayTab(area: HTMLElement, settings: AppSettings): void {
  area.appendChild(createToggleRow('Always White at Bottom', 'Keep white pieces at bottom regardless of your color', settings.alwaysWhiteBottom, (v) => {
    const s = loadSettings(); s.alwaysWhiteBottom = v; saveSettings(s);
  }));
  area.appendChild(createToggleRow('Show Legal Move Hints', 'Display dots on valid destination squares', settings.showLegalHints, (v) => {
    const s = loadSettings(); s.showLegalHints = v; saveSettings(s);
  }));
}
