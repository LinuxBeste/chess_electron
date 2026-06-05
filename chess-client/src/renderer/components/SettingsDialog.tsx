/**
 * SettingsDialog — tabbed modal overlay for all user-configurable preferences.
 *
 * Each tab (General / Board / Display / Gameplay / Clock) renders its own
 * sub-component.  Tabs have sub-section headers so they can hold many settings
 * while remaining scannable.  The dialog is intentionally large to accommodate
 * the full set of options without cramming.
 */

import { useState, useReducer } from 'react';
import {
  type AppSettings, defaultSettings, loadSettings, saveSettings,
  getLocalStorageKeys, clearLocalStorageKey, clearAllLocalData,
} from '../settings';
import { setSoundVolume } from '../sound';
import { store } from '../store';

interface Props {
  onClose: () => void;
}

type TabId = 'general' | 'board' | 'display' | 'gameplay' | 'clock' | 'advanced';

const tabs: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'board', label: 'Board' },
  { id: 'display', label: 'Display' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'clock', label: 'Clock' },
  { id: 'advanced', label: 'Advanced' },
];

/* ─── Shared option lists ─── */

const themeOptions = [
  { value: 'default', label: 'Default (Purple)' },
  { value: 'classic', label: 'Classic Wood' },
  { value: 'blue', label: 'Ocean Blue' },
  { value: 'green', label: 'Forest Green' },
  { value: 'gray', label: 'Slate Gray' },
  { value: 'amber', label: 'Amber Glow' },
];

const animSpeedOptions = [
  { value: 'fast', label: 'Fast' },
  { value: 'normal', label: 'Normal' },
  { value: 'slow', label: 'Slow' },
];

const pieceSetOptions = [
  { value: 'emoji', label: 'Emoji' },
  { value: 'svg', label: 'SVG Decorative' },
];

const pieceAnimOptions = [
  { value: 'none', label: 'None' },
  { value: 'slide', label: 'Slide' },
  { value: 'pop', label: 'Pop' },
];

const boardStyleOptions = [
  { value: 'default', label: 'Default' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'framed', label: 'Framed' },
];

const boardSizeOptions = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const backgroundOptions = [
  { value: 'default', label: 'Default' },
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'none', label: 'None' },
];

const soundOptions = [
  { value: 'default', label: 'Default' },
  { value: 'click', label: 'Click' },
  { value: 'wood', label: 'Wood' },
  { value: 'none', label: 'None' },
];

const densityOptions = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'spacious', label: 'Spacious' },
];

const clockStyleOptions = [
  { value: 'digital', label: 'Digital' },
  { value: 'minimal', label: 'Minimal' },
];

const moveNotationOptions = [
  { value: 'short', label: 'Short (e4)' },
  { value: 'long', label: 'Long (e2-e4)' },
];

const coordStyleOptions = [
  { value: 'standard', label: 'Standard' },
  { value: 'none', label: 'None' },
];

const decimalOptions = [
  { value: '0', label: '0 (5:00)' },
  { value: '1', label: '1 (5:00.0)' },
  { value: '2', label: '2 (5:00.00)' },
];

const autoLogoutOptions = [
  { value: '0', label: 'Disabled' },
  { value: '1', label: '1 minute' },
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
];

const timePresets = [
  { min: 1, inc: 0, label: 'Bullet 1+0' },
  { min: 3, inc: 0, label: 'Blitz 3+0' },
  { min: 3, inc: 2, label: 'Blitz 3+2' },
  { min: 5, inc: 0, label: 'Blitz 5+0' },
  { min: 10, inc: 0, label: 'Rapid 10+0' },
  { min: 10, inc: 5, label: 'Rapid 10+5' },
  { min: 30, inc: 0, label: 'Classical 30+0' },
];

/* ─── Sub-section header ─── */
function Section({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#666',
        marginTop: 16,
        marginBottom: 4,
        paddingBottom: 4,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {title}
    </div>
  );
}

/* ─── Board colour utils for mini preview ─── */
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

/* ─── Reusable form controls ─── */

function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{label}</div>
        <div className="settings-desc">{desc}</div>
      </div>
      <div className={`toggle ${checked ? 'active' : ''}`} onClick={() => onChange(!checked)}>
        <div className="toggle-knob" />
      </div>
    </div>
  );
}

function SelectRow({
  label, desc, options, value, onChange,
}: {
  label: string; desc: string; options: { value: string; label: string }[];
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{label}</div>
        <div className="settings-desc">{desc}</div>
      </div>
      <select className="settings-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SliderRow({
  label, desc, value, min, max, onChange,
}: {
  label: string; desc: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{label}</div>
        <div className="settings-desc">{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          className="settings-slider"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e0', minWidth: 32, textAlign: 'right' }}>
          {value}%
        </span>
      </div>
    </div>
  );
}

/* ─── Tab panels ─── */

function GeneralTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <Section title="Sound" />
      <ToggleRow label="Sound Effects" desc="Play sounds for moves, captures, and check" checked={settings.soundEnabled} onChange={(v) => onUpdate({ ...settings, soundEnabled: v })} />
      <SliderRow label="Sound Volume" desc="Master volume for game sounds" value={settings.soundVolume} min={0} max={100} onChange={(v) => onUpdate({ ...settings, soundVolume: v })} />
      <SelectRow label="Move Sound" desc="Sound style when a piece is moved" options={soundOptions} value={settings.moveSound} onChange={(v) => onUpdate({ ...settings, moveSound: v as any })} />
      <SelectRow label="Capture Sound" desc="Sound style when a piece is captured" options={soundOptions} value={settings.captureSound} onChange={(v) => onUpdate({ ...settings, captureSound: v as any })} />
      <ToggleRow label="Notifications" desc="Show browser notifications for game events" checked={settings.notificationEnabled} onChange={(v) => onUpdate({ ...settings, notificationEnabled: v })} />

      <Section title="Animations" />
      <ToggleRow label="Animations" desc="Animate piece movement and transitions" checked={settings.animationsEnabled} onChange={(v) => onUpdate({ ...settings, animationsEnabled: v })} />
      <SelectRow label="Animation Speed" desc="How fast pieces slide" options={animSpeedOptions} value={settings.moveAnimationSpeed} onChange={(v) => onUpdate({ ...settings, moveAnimationSpeed: v as any })} />
      <SelectRow label="Piece Animation" desc="How pieces animate when moved" options={pieceAnimOptions} value={settings.pieceAnimation} onChange={(v) => onUpdate({ ...settings, pieceAnimation: v as any })} />
      <ToggleRow label="Animate Board Flip" desc="Animate rotation when switching sides" checked={settings.animateBoardFlip} onChange={(v) => onUpdate({ ...settings, animateBoardFlip: v })} />
      <ToggleRow label="Reduce Motion" desc="Disable all non-essential animations" checked={settings.reduceMotion} onChange={(v) => onUpdate({ ...settings, reduceMotion: v })} />

      <Section title="Pieces" />
      <SelectRow label="Piece Set" desc="Visual style for chess pieces" options={pieceSetOptions} value={settings.pieceSet} onChange={(v) => onUpdate({ ...settings, pieceSet: v as any })} />
      <ToggleRow label="Piece Drop Shadow" desc="Soft shadow under pieces for depth" checked={settings.pieceDropShadow} onChange={(v) => onUpdate({ ...settings, pieceDropShadow: v })} />
    </>
  );
}

function BoardTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <Section title="Theme & Style" />
      <SelectRow label="Board Theme" desc="Color scheme for the chess board" options={themeOptions} value={settings.boardTheme} onChange={(v) => onUpdate({ ...settings, boardTheme: v as any })} />
      <SelectRow label="Board Style" desc="Visual style of the board squares" options={boardStyleOptions} value={settings.boardStyle} onChange={(v) => onUpdate({ ...settings, boardStyle: v as any })} />
      <SelectRow label="Board Size" desc="Overall size of the board" options={boardSizeOptions} value={settings.boardSize} onChange={(v) => onUpdate({ ...settings, boardSize: v as any })} />
      <ToggleRow label="Board Border" desc="Show a border frame around the board" checked={settings.boardBorder} onChange={(v) => onUpdate({ ...settings, boardBorder: v })} />
      <SelectRow label="Coordinate Style" desc="Format for rank/file labels on the board" options={coordStyleOptions} value={settings.boardCoordinateStyle} onChange={(v) => onUpdate({ ...settings, boardCoordinateStyle: v as any })} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Preview</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2, width: 140, height: 140, borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} style={{ background: (Math.floor(i / 4) + (i % 4)) % 2 === 0 ? getLightColor(settings.boardTheme) : getDarkColor(settings.boardTheme) }} />
          ))}
        </div>
      </div>

      <Section title="Labels & Info" />
      <ToggleRow label="Show Coordinates" desc="Display rank and file labels on the board" checked={settings.showCoordinates} onChange={(v) => onUpdate({ ...settings, showCoordinates: v })} />
      <ToggleRow label="Highlight Last Move" desc="Highlight the from and to squares of the last move" checked={settings.highlightLastMove} onChange={(v) => onUpdate({ ...settings, highlightLastMove: v })} />
      <ToggleRow label="Highlight Check" desc="Highlight the king when in check" checked={settings.highlightCheck} onChange={(v) => onUpdate({ ...settings, highlightCheck: v })} />
      <ToggleRow label="Move History" desc="Show the move history panel" checked={settings.showMoveHistory} onChange={(v) => onUpdate({ ...settings, showMoveHistory: v })} />
      <ToggleRow label="Captured Pieces" desc="Display captured pieces next to the board" checked={settings.showCapturedPieces} onChange={(v) => onUpdate({ ...settings, showCapturedPieces: v })} />
      <ToggleRow label="Material Difference" desc="Show material advantage count" checked={settings.showMaterialDifference} onChange={(v) => onUpdate({ ...settings, showMaterialDifference: v })} />
      <ToggleRow label="Move Arrows" desc="Show arrows from the last move" checked={settings.showMoveArrows} onChange={(v) => onUpdate({ ...settings, showMoveArrows: v })} />
    </>
  );
}

function DisplayTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <Section title="Layout" />
      <ToggleRow label="Always White at Bottom" desc="Keep white pieces at bottom regardless of your color" checked={settings.alwaysWhiteBottom} onChange={(v) => onUpdate({ ...settings, alwaysWhiteBottom: v })} />
      <ToggleRow label="Auto-Flip Board" desc="Automatically flip board after each move" checked={settings.autoFlipBoard} onChange={(v) => onUpdate({ ...settings, autoFlipBoard: v })} />
      <ToggleRow label="Compact Mode" desc="Tighter spacing for a more condensed UI" checked={settings.compactMode} onChange={(v) => onUpdate({ ...settings, compactMode: v })} />
      <SelectRow label="UI Density" desc="Overall spacing and sizing of the interface" options={densityOptions} value={settings.uiDensity} onChange={(v) => onUpdate({ ...settings, uiDensity: v as any })} />
      <ToggleRow label="Show Player Names" desc="Display player names on the game screen" checked={settings.showPlayerNames} onChange={(v) => onUpdate({ ...settings, showPlayerNames: v })} />
      <ToggleRow label="Show Game Info" desc="Display game status and result info" checked={settings.showGameInfo} onChange={(v) => onUpdate({ ...settings, showGameInfo: v })} />
      <ToggleRow label="Show Result Popup" desc="Show a popup when the game ends" checked={settings.showGameResultPopup} onChange={(v) => onUpdate({ ...settings, showGameResultPopup: v })} />

      <Section title="Visuals" />
      <SelectRow label="Background Pattern" desc="Decorative pattern behind the board" options={backgroundOptions} value={settings.background} onChange={(v) => onUpdate({ ...settings, background: v as any })} />
      <ToggleRow label="Legal Move Hints" desc="Display dots on valid destination squares" checked={settings.showLegalHints} onChange={(v) => onUpdate({ ...settings, showLegalHints: v })} />
      <ToggleRow label="Show Threats" desc="Highlight squares attacked by the opponent" checked={settings.showThreats} onChange={(v) => onUpdate({ ...settings, showThreats: v })} />
      <ToggleRow label="Show Opponent Clock" desc="Always display the opponent's remaining time" checked={settings.showOpponentClock} onChange={(v) => onUpdate({ ...settings, showOpponentClock: v })} />

      <Section title="Clock Display" />
      <SelectRow label="Clock Style" desc="Visual style of the clock display" options={clockStyleOptions} value={settings.clockStyle} onChange={(v) => onUpdate({ ...settings, clockStyle: v as any })} />
      <SelectRow label="Decimal Places" desc="Show fractions of a second on the clock" options={decimalOptions} value={String(settings.clockDecimalPlaces)} onChange={(v) => onUpdate({ ...settings, clockDecimalPlaces: Number(v) as 0 | 1 | 2 })} />
    </>
  );
}

function GameplayTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <Section title="Moves" />
      <ToggleRow label="Auto-Promote to Queen" desc="Skip promotion dialog, always promote to queen" checked={settings.autoPromoteQueen} onChange={(v) => onUpdate({ ...settings, autoPromoteQueen: v })} />
      <ToggleRow label="Premove" desc="Queue a move to play as soon as it's your turn" checked={settings.premove} onChange={(v) => onUpdate({ ...settings, premove: v })} />
      <ToggleRow label="Click to Move" desc="Click source then destination (no drag)" checked={settings.clickToMove} onChange={(v) => onUpdate({ ...settings, clickToMove: v })} />
      <ToggleRow label="Show Move Preview" desc="Preview the piece on the destination before confirming" checked={settings.showMovePreview} onChange={(v) => onUpdate({ ...settings, showMovePreview: v })} />
      <SelectRow label="Move Notation" desc="Format for the move history list" options={moveNotationOptions} value={settings.moveNotation} onChange={(v) => onUpdate({ ...settings, moveNotation: v as any })} />
      <ToggleRow label="Keyboard Navigation" desc="Navigate the board with arrow keys" checked={settings.enableKeyboardNavigation} onChange={(v) => onUpdate({ ...settings, enableKeyboardNavigation: v })} />
      <ToggleRow label="Opening Book" desc="Show opening names during the game" checked={settings.enableOpeningBook} onChange={(v) => onUpdate({ ...settings, enableOpeningBook: v })} />

      <Section title="Confirmation" />
      <ToggleRow label="Confirm Resign" desc="Require double-click to resign" checked={settings.confirmResign} onChange={(v) => onUpdate({ ...settings, confirmResign: v })} />
      <ToggleRow label="Confirm Draw" desc="Require confirmation to agree to a draw" checked={settings.confirmDraw} onChange={(v) => onUpdate({ ...settings, confirmDraw: v })} />
      <ToggleRow label="Confirm Abort" desc="Require confirmation to abort a game" checked={settings.confirmAbort} onChange={(v) => onUpdate({ ...settings, confirmAbort: v })} />
      <ToggleRow label="Auto Next Game" desc="Automatically start a new game after the current one ends" checked={settings.autoNextGame} onChange={(v) => onUpdate({ ...settings, autoNextGame: v })} />

      <Section title="History" />
      <ToggleRow label="Show Timestamps" desc="Show move timestamps in the history panel" checked={settings.showTimestampsInHistory} onChange={(v) => onUpdate({ ...settings, showTimestampsInHistory: v })} />
    </>
  );
}

function formatClockPreview(minutes: number, decimals: number): string {
  const totalSec = minutes * 60;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const dec = decimals > 0 ? '.' + '0'.repeat(decimals) : '';
  return `${m}:${String(s).padStart(2, '0')}${dec}`;
}

function ClockTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <Section title="Time Control" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {timePresets.map((p) => {
          const active = settings.timeControlMinutes === p.min && settings.timeControlIncrement === p.inc;
          return (
            <button
              key={p.label}
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => onUpdate({ ...settings, timeControlMinutes: p.min, timeControlIncrement: p.inc })}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="settings-label" style={{ marginBottom: 4 }}>Initial time (min)</div>
          <input
            className="input"
            type="number"
            min={0.1}
            max={180}
            step={1}
            value={settings.timeControlMinutes}
            onChange={(e) => onUpdate({ ...settings, timeControlMinutes: Math.max(0.1, Number(e.target.value)) })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div className="settings-label" style={{ marginBottom: 4 }}>Increment (sec)</div>
          <input
            className="input"
            type="number"
            min={0}
            max={60}
            step={1}
            value={settings.timeControlIncrement}
            onChange={(e) => onUpdate({ ...settings, timeControlIncrement: Math.max(0, Number(e.target.value)) })}
          />
        </div>
      </div>

      <Section title="Preview" />
      <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 300, fontVariantNumeric: 'tabular-nums', color: '#e0e0e0', letterSpacing: '1px' }}>
          {formatClockPreview(settings.timeControlMinutes, settings.clockDecimalPlaces)}
        </div>
      </div>
    </>
  );
}

/* ─── Advanced tab ─── */
function AdvancedTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  const [refreshToken, dispatch] = useReducer((x: number) => x + 1, 0);
  const [confirmClear, setConfirmClear] = useState(false);

  const localKeys = getLocalStorageKeys();

  function handleClearAll() {
    clearAllLocalData();
    setConfirmClear(false);
    dispatch();
  }

  function handleClearKey(key: string) {
    clearLocalStorageKey(key);
    dispatch();
  }

  const dataRows = localKeys.map((key) => {
    const raw = localStorage.getItem(key) || '';
    const size = new Blob([raw]).size;
    return { key, size };
  });

  return (
    <>
      <Section title="Server" />
      <ToggleRow
        label="Always ask for server URL"
        desc="Show the server URL field on every login instead of remembering it"
        checked={settings.alwaysAskServerUrl}
        onChange={(v) => onUpdate({ ...settings, alwaysAskServerUrl: v })}
      />

      <Section title="Session" />
      <SelectRow
        label="Auto logout"
        desc="Automatically log out after inactivity"
        options={autoLogoutOptions}
        value={String(settings.autoLogoutMinutes)}
        onChange={(v) => onUpdate({ ...settings, autoLogoutMinutes: Number(v) })}
      />

      <Section title="Stored Data" />
      {dataRows.length === 0 ? (
        <div style={{ fontSize: 13, color: '#888', padding: '12px 0', textAlign: 'center' }}>
          No local data stored
        </div>
      ) : (
        <div style={{ marginTop: 4 }}>
          {dataRows.map((row) => (
            <div
              key={row.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                fontSize: 12,
              }}
            >
              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ccc' }}>
                {row.key}
                <span style={{ color: '#666', marginLeft: 8 }}>({row.size} B)</span>
              </div>
              <button
                className="btn btn-ghost btn-xs"
                style={{ flexShrink: 0, marginLeft: 8, fontSize: 10, padding: '2px 8px' }}
                onClick={() => handleClearKey(row.key)}
              >
                Clear
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        {confirmClear ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={handleClearAll}>
              Confirm Clear All
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', fontSize: 12, color: 'rgba(220,80,80,0.8)', borderColor: 'rgba(220,80,80,0.3)' }}
            onClick={() => setConfirmClear(true)}
          >
            Clear All Local Data
          </button>
        )}
      </div>
    </>
  );
}

/* ─── Root component ─── */

export default function SettingsDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  function updateSettings(s: AppSettings) {
    setSettings(s);
    saveSettings(s);
    setSoundVolume(s.soundVolume);
  }

  function resetDefaults() {
    updateSettings({ ...defaultSettings });
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-card"
        style={{
          width: 640,
          maxWidth: '95vw',
          maxHeight: '90vh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          cursor: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', letterSpacing: '-0.3px' }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="settings-tabs" style={{ padding: '16px 28px 0' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ padding: '8px 28px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'general' && <GeneralTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'board' && <BoardTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'display' && <DisplayTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'gameplay' && <GameplayTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'clock' && <ClockTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'advanced' && <AdvancedTab settings={settings} onUpdate={updateSettings} />}
        </div>

        {/* Footer */}
        <div style={{ padding: '0 28px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={resetDefaults} style={{ width: '100%', fontSize: 12 }}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
