/**
 * SettingsDialog — tabbed modal overlay for all user-configurable preferences.
 *
 * Each tab (General / Board / Display / Gameplay) renders its own sub-component
 * for organisational clarity. Settings are read from localStorage via loadSettings()
 * and written back via saveSettings(), which also triggers DOM theme updates.
 */

import { useState } from 'react';
import { type AppSettings, defaultSettings, loadSettings, saveSettings } from '../settings';
import { setSoundVolume } from '../sound';

interface Props {
  onClose: () => void;
}

type TabId = 'general' | 'board' | 'display' | 'gameplay' | 'clock';

/* Tab definitions drive both the tab bar and the conditional rendering below */
const tabs: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'board', label: 'Board' },
  { id: 'display', label: 'Display' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'clock', label: 'Clock' },
];

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

const backgroundOptions = [
  { value: 'default', label: 'Default' },
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
  { value: 'none', label: 'None' },
];

/* Board colour lookup — duplicated here from CSS custom properties so the
   mini preview grid in the Board tab can render server-side-colour squares */
function getLightColor(theme: string): string {
  switch (theme) {
    case 'classic':
      return '#f0d9b5';
    case 'blue':
      return '#dee3e6';
    case 'green':
      return '#eeeed2';
    case 'gray':
      return '#c8c8c8';
    case 'amber':
      return '#f5deb3';
    default:
      return '#3d3d52';
  }
}

function getDarkColor(theme: string): string {
  switch (theme) {
    case 'classic':
      return '#b58863';
    case 'blue':
      return '#8ca2ad';
    case 'green':
      return '#769656';
    case 'gray':
      return '#6b6b6b';
    case 'amber':
      return '#b8860b';
    default:
      return '#2c2c38';
  }
}

/* Reusable form controls — each renders a label + description + a single interactive widget.
   Grouped here instead of a generic library to keep the dependency tree flat. */
function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
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
  label,
  desc,
  options,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{label}</div>
        <div className="settings-desc">{desc}</div>
      </div>
      <select className="settings-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SliderRow({
  label,
  desc,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  desc: string;
  value: number;
  min: number;
  max: number;
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

function GeneralTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <ToggleRow
        label="Sound Effects"
        desc="Play sounds for moves, captures, and check"
        checked={settings.soundEnabled}
        onChange={(v) => onUpdate({ ...settings, soundEnabled: v })}
      />
      <SliderRow
        label="Sound Volume"
        desc="Master volume for game sounds"
        value={settings.soundVolume}
        min={0}
        max={100}
        onChange={(v) => onUpdate({ ...settings, soundVolume: v })}
      />
      <ToggleRow
        label="Animations"
        desc="Animate piece movement and transitions"
        checked={settings.animationsEnabled}
        onChange={(v) => onUpdate({ ...settings, animationsEnabled: v })}
      />
      <SelectRow
        label="Animation Speed"
        desc="How fast pieces slide"
        options={animSpeedOptions}
        value={settings.moveAnimationSpeed}
        onChange={(v) => onUpdate({ ...settings, moveAnimationSpeed: v as any })}
      />
      <SelectRow
        label="Piece Set"
        desc="Visual style for chess pieces"
        options={pieceSetOptions}
        value={settings.pieceSet}
        onChange={(v) => onUpdate({ ...settings, pieceSet: v as any })}
      />
      <SelectRow
        label="Piece Animation"
        desc="How pieces animate when moved"
        options={pieceAnimOptions}
        value={settings.pieceAnimation}
        onChange={(v) => onUpdate({ ...settings, pieceAnimation: v as any })}
      />
    </>
  );
}

function BoardTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <SelectRow
        label="Board Theme"
        desc="Color scheme for the chess board"
        options={themeOptions}
        value={settings.boardTheme}
        onChange={(v) => onUpdate({ ...settings, boardTheme: v as any })}
      />
      <SelectRow
        label="Board Style"
        desc="Visual style of the board squares"
        options={boardStyleOptions}
        value={settings.boardStyle}
        onChange={(v) => onUpdate({ ...settings, boardStyle: v as any })}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 300,
            color: '#888',
            marginBottom: 8,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}
        >
          Preview
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 2,
            width: 160,
            height: 160,
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              style={{
                background:
                  (Math.floor(i / 4) + (i % 4)) % 2 === 0
                    ? getLightColor(settings.boardTheme)
                    : getDarkColor(settings.boardTheme),
              }}
            />
          ))}
        </div>
      </div>
      <ToggleRow
        label="Show Coordinates"
        desc="Display rank and file labels on the board"
        checked={settings.showCoordinates}
        onChange={(v) => onUpdate({ ...settings, showCoordinates: v })}
      />
    </>
  );
}

function DisplayTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <ToggleRow
        label="Always White at Bottom"
        desc="Keep white pieces at bottom regardless of your color"
        checked={settings.alwaysWhiteBottom}
        onChange={(v) => onUpdate({ ...settings, alwaysWhiteBottom: v })}
      />
      <ToggleRow
        label="Show Legal Move Hints"
        desc="Display dots on valid destination squares"
        checked={settings.showLegalHints}
        onChange={(v) => onUpdate({ ...settings, showLegalHints: v })}
      />
      <ToggleRow
        label="Highlight Last Move"
        desc="Highlight the from and to squares of the last move"
        checked={settings.highlightLastMove}
        onChange={(v) => onUpdate({ ...settings, highlightLastMove: v })}
      />
      <SelectRow
        label="Background Pattern"
        desc="Decorative pattern behind the board"
        options={backgroundOptions}
        value={settings.background}
        onChange={(v) => onUpdate({ ...settings, background: v as any })}
      />
    </>
  );
}

function GameplayTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <ToggleRow
        label="Auto-Promote to Queen"
        desc="Skip promotion dialog, always promote to queen"
        checked={settings.autoPromoteQueen}
        onChange={(v) => onUpdate({ ...settings, autoPromoteQueen: v })}
      />
      <ToggleRow
        label="Confirm Resign"
        desc="Require double-click to resign"
        checked={settings.confirmResign}
        onChange={(v) => onUpdate({ ...settings, confirmResign: v })}
      />
      <ToggleRow
        label="Confirm Draw"
        desc="Require confirmation to agree to a draw"
        checked={settings.confirmDraw}
        onChange={(v) => onUpdate({ ...settings, confirmDraw: v })}
      />
    </>
  );
}

const decimalOptions = [
  { value: '0', label: '0 (5:00)' },
  { value: '1', label: '1 (5:00.0)' },
  { value: '2', label: '2 (5:00.00)' },
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

function ClockTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: 10 }}>
        Time Control
      </div>
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

      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: 10, marginTop: 8 }}>
        Display
      </div>
      <SelectRow
        label="Decimal places"
        desc="Show fractions of a second on the clock"
        options={decimalOptions}
        value={String(settings.clockDecimalPlaces)}
        onChange={(v) => onUpdate({ ...settings, clockDecimalPlaces: Number(v) as 0 | 1 | 2 })}
      />
      <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 300, color: '#888', marginBottom: 4 }}>Preview</div>
        <div style={{ fontSize: 24, fontWeight: 300, fontVariantNumeric: 'tabular-nums', color: '#e0e0e0', letterSpacing: '1px' }}>
          {formatClockPreview(settings.timeControlMinutes, settings.clockDecimalPlaces)}
        </div>
      </div>
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

export default function SettingsDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  /* Local copy of settings; changes are persisted immediately via saveSettings() */
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  function updateSettings(s: AppSettings) {
    setSettings(s);
    saveSettings(s);
    /* Volume changes take effect immediately — the sound module caches the value */
    setSoundVolume(s.soundVolume);
  }

  function resetDefaults() {
    updateSettings({ ...defaultSettings });
  }

  /* Close when clicking the dark backdrop, not when clicking inside the modal card */
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-card"
        style={{
          width: 460,
          maxWidth: '90vw',
          maxHeight: '80vh',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          cursor: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', letterSpacing: '-0.3px' }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div className="settings-tabs">
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

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {activeTab === 'general' && <GeneralTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'board' && <BoardTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'display' && <DisplayTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'gameplay' && <GameplayTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'clock' && <ClockTab settings={settings} onUpdate={updateSettings} />}
        </div>

        <div style={{ padding: '0 24px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={resetDefaults} style={{ width: '100%', fontSize: 12 }}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
