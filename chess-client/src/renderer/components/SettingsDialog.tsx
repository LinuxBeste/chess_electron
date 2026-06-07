import { useState, useReducer } from 'react';
import {
  type AppSettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  getLocalStorageKeys,
  clearLocalStorageKey,
  clearAllLocalData,
} from '../settings';
import { setSoundVolume } from '../sound';
import { store } from '../store';
import { t, setLanguage, getLanguage } from '../translate';
import { getLanguageNames } from '../locales';

interface Props {
  onClose: () => void;
}

type TabId = 'general' | 'board' | 'display' | 'gameplay' | 'clock' | 'advanced';

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
  const soundOptions = [
    { value: 'default', label: t('settings.options.default') },
    { value: 'click', label: t('settings.options.click') },
    { value: 'wood', label: t('settings.options.wood') },
    { value: 'none', label: t('settings.options.none') },
  ];

  const animSpeedOptions = [
    { value: 'fast', label: t('settings.options.fast') },
    { value: 'normal', label: t('settings.options.normal') },
    { value: 'slow', label: t('settings.options.slow') },
  ];

  const pieceAnimOptions = [
    { value: 'none', label: t('settings.options.none') },
    { value: 'slide', label: t('settings.options.slide') },
    { value: 'pop', label: t('settings.options.pop') },
  ];

  const pieceSetOptions = [
    { value: 'emoji', label: t('settings.options.emoji') },
    { value: 'svg', label: t('settings.options.svgDecorative') },
  ];

  return (
    <>
      <Section title={t('settings.general.sound')} />
      <ToggleRow
        label={t('settings.general.soundEffects')}
        desc={t('settings.general.soundEffectsDesc')}
        checked={settings.soundEnabled}
        onChange={(v) => onUpdate({ ...settings, soundEnabled: v })}
      />
      <SliderRow
        label={t('settings.general.soundVolume')}
        desc={t('settings.general.soundVolumeDesc')}
        value={settings.soundVolume}
        min={0}
        max={100}
        onChange={(v) => onUpdate({ ...settings, soundVolume: v })}
      />
      <SelectRow
        label={t('settings.general.moveSound')}
        desc={t('settings.general.moveSoundDesc')}
        options={soundOptions}
        value={settings.moveSound}
        onChange={(v) => onUpdate({ ...settings, moveSound: v as any })}
      />
      <SelectRow
        label={t('settings.general.captureSound')}
        desc={t('settings.general.captureSoundDesc')}
        options={soundOptions}
        value={settings.captureSound}
        onChange={(v) => onUpdate({ ...settings, captureSound: v as any })}
      />
      <ToggleRow
        label={t('settings.general.notifications')}
        desc={t('settings.general.notificationsDesc')}
        checked={settings.notificationEnabled}
        onChange={(v) => onUpdate({ ...settings, notificationEnabled: v })}
      />

      <Section title={t('settings.general.animations')} />
      <ToggleRow
        label={t('settings.general.animationsToggle')}
        desc={t('settings.general.animationsDesc')}
        checked={settings.animationsEnabled}
        onChange={(v) => onUpdate({ ...settings, animationsEnabled: v })}
      />
      <SelectRow
        label={t('settings.general.animationSpeed')}
        desc={t('settings.general.animationSpeedDesc')}
        options={animSpeedOptions}
        value={settings.moveAnimationSpeed}
        onChange={(v) => onUpdate({ ...settings, moveAnimationSpeed: v as any })}
      />
      <SelectRow
        label={t('settings.general.pieceAnimation')}
        desc={t('settings.general.pieceAnimationDesc')}
        options={pieceAnimOptions}
        value={settings.pieceAnimation}
        onChange={(v) => onUpdate({ ...settings, pieceAnimation: v as any })}
      />
      <ToggleRow
        label={t('settings.general.animateBoardFlip')}
        desc={t('settings.general.animateBoardFlipDesc')}
        checked={settings.animateBoardFlip}
        onChange={(v) => onUpdate({ ...settings, animateBoardFlip: v })}
      />
      <ToggleRow
        label={t('settings.general.reduceMotion')}
        desc={t('settings.general.reduceMotionDesc')}
        checked={settings.reduceMotion}
        onChange={(v) => onUpdate({ ...settings, reduceMotion: v })}
      />

      <Section title={t('settings.general.pieces')} />
      <SelectRow
        label={t('settings.general.pieceSet')}
        desc={t('settings.general.pieceSetDesc')}
        options={pieceSetOptions}
        value={settings.pieceSet}
        onChange={(v) => onUpdate({ ...settings, pieceSet: v as any })}
      />
      <ToggleRow
        label={t('settings.general.pieceDropShadow')}
        desc={t('settings.general.pieceDropShadowDesc')}
        checked={settings.pieceDropShadow}
        onChange={(v) => onUpdate({ ...settings, pieceDropShadow: v })}
      />

      <Section title={t('settings.general.language')} />
      <SelectRow
        label={t('settings.general.language')}
        desc={t('settings.general.languageDesc')}
        options={[
          { value: 'en', label: getLanguageNames().en },
          { value: 'de', label: getLanguageNames().de },
        ]}
        value={settings.language}
        onChange={(v) => onUpdate({ ...settings, language: v as 'en' | 'de' })}
      />
    </>
  );
}

function BoardTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  const themeOptions = [
    { value: 'default', label: t('settings.options.defaultPurple') },
    { value: 'classic', label: t('settings.options.classicWood') },
    { value: 'blue', label: t('settings.options.oceanBlue') },
    { value: 'green', label: t('settings.options.forestGreen') },
    { value: 'gray', label: t('settings.options.slateGray') },
    { value: 'amber', label: t('settings.options.amberGlow') },
  ];

  const boardStyleOptions = [
    { value: 'default', label: t('settings.options.default') },
    { value: 'rounded', label: t('settings.options.rounded') },
    { value: 'framed', label: t('settings.options.framed') },
  ];

  const boardSizeOptions = [
    { value: 'small', label: t('settings.options.small') },
    { value: 'medium', label: t('settings.options.medium') },
    { value: 'large', label: t('settings.options.large') },
  ];

  const coordStyleOptions = [
    { value: 'standard', label: t('settings.options.standard') },
    { value: 'none', label: t('settings.options.none') },
  ];

  return (
    <>
      <Section title={t('settings.board.themeStyle')} />
      <SelectRow
        label={t('settings.board.boardTheme')}
        desc={t('settings.board.boardThemeDesc')}
        options={themeOptions}
        value={settings.boardTheme}
        onChange={(v) => onUpdate({ ...settings, boardTheme: v as any })}
      />
      <SelectRow
        label={t('settings.board.boardStyle')}
        desc={t('settings.board.boardStyleDesc')}
        options={boardStyleOptions}
        value={settings.boardStyle}
        onChange={(v) => onUpdate({ ...settings, boardStyle: v as any })}
      />
      <SelectRow
        label={t('settings.board.boardSize')}
        desc={t('settings.board.boardSizeDesc')}
        options={boardSizeOptions}
        value={settings.boardSize}
        onChange={(v) => onUpdate({ ...settings, boardSize: v as any })}
      />
      <ToggleRow
        label={t('settings.board.boardBorder')}
        desc={t('settings.board.boardBorderDesc')}
        checked={settings.boardBorder}
        onChange={(v) => onUpdate({ ...settings, boardBorder: v })}
      />
      <SelectRow
        label={t('settings.board.coordinateStyle')}
        desc={t('settings.board.coordinateStyleDesc')}
        options={coordStyleOptions}
        value={settings.boardCoordinateStyle}
        onChange={(v) => onUpdate({ ...settings, boardCoordinateStyle: v as any })}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#888',
            marginBottom: 8,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          {t('settings.board.preview')}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 2,
            width: 140,
            height: 140,
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

      <Section title={t('settings.board.labelsInfo')} />
      <ToggleRow
        label={t('settings.board.showCoordinates')}
        desc={t('settings.board.showCoordinatesDesc')}
        checked={settings.showCoordinates}
        onChange={(v) => onUpdate({ ...settings, showCoordinates: v })}
      />
      <ToggleRow
        label={t('settings.board.highlightLastMove')}
        desc={t('settings.board.highlightLastMoveDesc')}
        checked={settings.highlightLastMove}
        onChange={(v) => onUpdate({ ...settings, highlightLastMove: v })}
      />
      <ToggleRow
        label={t('settings.board.highlightCheck')}
        desc={t('settings.board.highlightCheckDesc')}
        checked={settings.highlightCheck}
        onChange={(v) => onUpdate({ ...settings, highlightCheck: v })}
      />
      <ToggleRow
        label={t('settings.board.moveHistory')}
        desc={t('settings.board.moveHistoryDesc')}
        checked={settings.showMoveHistory}
        onChange={(v) => onUpdate({ ...settings, showMoveHistory: v })}
      />
      <ToggleRow
        label={t('settings.board.capturedPieces')}
        desc={t('settings.board.capturedPiecesDesc')}
        checked={settings.showCapturedPieces}
        onChange={(v) => onUpdate({ ...settings, showCapturedPieces: v })}
      />
      <ToggleRow
        label={t('settings.board.materialDifference')}
        desc={t('settings.board.materialDifferenceDesc')}
        checked={settings.showMaterialDifference}
        onChange={(v) => onUpdate({ ...settings, showMaterialDifference: v })}
      />
      <ToggleRow
        label={t('settings.board.moveArrows')}
        desc={t('settings.board.moveArrowsDesc')}
        checked={settings.showMoveArrows}
        onChange={(v) => onUpdate({ ...settings, showMoveArrows: v })}
      />
    </>
  );
}

function DisplayTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  const densityOptions = [
    { value: 'compact', label: t('settings.options.compact') },
    { value: 'normal', label: t('settings.options.normal') },
    { value: 'spacious', label: t('settings.options.spacious') },
  ];

  const backgroundOptions = [
    { value: 'default', label: t('settings.options.default') },
    { value: 'dots', label: t('settings.options.dots') },
    { value: 'grid', label: t('settings.options.grid') },
    { value: 'none', label: t('settings.options.none') },
  ];

  const clockStyleOptions = [
    { value: 'digital', label: t('settings.options.digital') },
    { value: 'minimal', label: t('settings.options.minimal') },
  ];

  const decimalOptions = [
    { value: '0', label: '0 (5:00)' },
    { value: '1', label: '1 (5:00.0)' },
    { value: '2', label: '2 (5:00.00)' },
  ];

  return (
    <>
      <Section title={t('settings.display.layout')} />
      <ToggleRow
        label={t('settings.display.alwaysWhiteBottom')}
        desc={t('settings.display.alwaysWhiteBottomDesc')}
        checked={settings.alwaysWhiteBottom}
        onChange={(v) => onUpdate({ ...settings, alwaysWhiteBottom: v })}
      />
      <ToggleRow
        label={t('settings.display.autoFlipBoard')}
        desc={t('settings.display.autoFlipBoardDesc')}
        checked={settings.autoFlipBoard}
        onChange={(v) => onUpdate({ ...settings, autoFlipBoard: v })}
      />
      <ToggleRow
        label={t('settings.display.compactMode')}
        desc={t('settings.display.compactModeDesc')}
        checked={settings.compactMode}
        onChange={(v) => onUpdate({ ...settings, compactMode: v })}
      />
      <SelectRow
        label={t('settings.display.uiDensity')}
        desc={t('settings.display.uiDensityDesc')}
        options={densityOptions}
        value={settings.uiDensity}
        onChange={(v) => onUpdate({ ...settings, uiDensity: v as any })}
      />
      <ToggleRow
        label={t('settings.display.showPlayerNames')}
        desc={t('settings.display.showPlayerNamesDesc')}
        checked={settings.showPlayerNames}
        onChange={(v) => onUpdate({ ...settings, showPlayerNames: v })}
      />
      <ToggleRow
        label={t('settings.display.showGameInfo')}
        desc={t('settings.display.showGameInfoDesc')}
        checked={settings.showGameInfo}
        onChange={(v) => onUpdate({ ...settings, showGameInfo: v })}
      />
      <ToggleRow
        label={t('settings.display.showResultPopup')}
        desc={t('settings.display.showResultPopupDesc')}
        checked={settings.showGameResultPopup}
        onChange={(v) => onUpdate({ ...settings, showGameResultPopup: v })}
      />

      <Section title={t('settings.display.visuals')} />
      <SelectRow
        label={t('settings.display.backgroundPattern')}
        desc={t('settings.display.backgroundPatternDesc')}
        options={backgroundOptions}
        value={settings.background}
        onChange={(v) => onUpdate({ ...settings, background: v as any })}
      />
      <ToggleRow
        label={t('settings.display.legalMoveHints')}
        desc={t('settings.display.legalMoveHintsDesc')}
        checked={settings.showLegalHints}
        onChange={(v) => onUpdate({ ...settings, showLegalHints: v })}
      />
      <ToggleRow
        label={t('settings.display.showThreats')}
        desc={t('settings.display.showThreatsDesc')}
        checked={settings.showThreats}
        onChange={(v) => onUpdate({ ...settings, showThreats: v })}
      />
      <ToggleRow
        label={t('settings.display.showOpponentClock')}
        desc={t('settings.display.showOpponentClockDesc')}
        checked={settings.showOpponentClock}
        onChange={(v) => onUpdate({ ...settings, showOpponentClock: v })}
      />

      <Section title={t('settings.display.clockDisplay')} />
      <SelectRow
        label={t('settings.display.clockStyle')}
        desc={t('settings.display.clockStyleDesc')}
        options={clockStyleOptions}
        value={settings.clockStyle}
        onChange={(v) => onUpdate({ ...settings, clockStyle: v as any })}
      />
      <SelectRow
        label={t('settings.display.decimalPlaces')}
        desc={t('settings.display.decimalPlacesDesc')}
        options={decimalOptions}
        value={String(settings.clockDecimalPlaces)}
        onChange={(v) => onUpdate({ ...settings, clockDecimalPlaces: Number(v) as 0 | 1 | 2 })}
      />
    </>
  );
}

function GameplayTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  const moveNotationOptions = [
    { value: 'short', label: t('settings.options.short') },
    { value: 'long', label: t('settings.options.long') },
  ];

  return (
    <>
      <Section title={t('settings.gameplay.moves')} />
      <ToggleRow
        label={t('settings.gameplay.autoPromoteQueen')}
        desc={t('settings.gameplay.autoPromoteQueenDesc')}
        checked={settings.autoPromoteQueen}
        onChange={(v) => onUpdate({ ...settings, autoPromoteQueen: v })}
      />
      <ToggleRow
        label={t('settings.gameplay.premove')}
        desc={t('settings.gameplay.premoveDesc')}
        checked={settings.premove}
        onChange={(v) => onUpdate({ ...settings, premove: v })}
      />
      <ToggleRow
        label={t('settings.gameplay.clickToMove')}
        desc={t('settings.gameplay.clickToMoveDesc')}
        checked={settings.clickToMove}
        onChange={(v) => onUpdate({ ...settings, clickToMove: v })}
      />
      <ToggleRow
        label={t('settings.gameplay.showMovePreview')}
        desc={t('settings.gameplay.showMovePreviewDesc')}
        checked={settings.showMovePreview}
        onChange={(v) => onUpdate({ ...settings, showMovePreview: v })}
      />
      <SelectRow
        label={t('settings.gameplay.moveNotation')}
        desc={t('settings.gameplay.moveNotationDesc')}
        options={moveNotationOptions}
        value={settings.moveNotation}
        onChange={(v) => onUpdate({ ...settings, moveNotation: v as any })}
      />
      <ToggleRow
        label={t('settings.gameplay.keyboardNavigation')}
        desc={t('settings.gameplay.keyboardNavigationDesc')}
        checked={settings.enableKeyboardNavigation}
        onChange={(v) => onUpdate({ ...settings, enableKeyboardNavigation: v })}
      />
      <ToggleRow
        label={t('settings.gameplay.openingBook')}
        desc={t('settings.gameplay.openingBookDesc')}
        checked={settings.enableOpeningBook}
        onChange={(v) => onUpdate({ ...settings, enableOpeningBook: v })}
      />

      <Section title={t('settings.gameplay.confirmation')} />
      <ToggleRow
        label={t('settings.gameplay.confirmResign')}
        desc={t('settings.gameplay.confirmResignDesc')}
        checked={settings.confirmResign}
        onChange={(v) => onUpdate({ ...settings, confirmResign: v })}
      />
      <ToggleRow
        label={t('settings.gameplay.confirmDraw')}
        desc={t('settings.gameplay.confirmDrawDesc')}
        checked={settings.confirmDraw}
        onChange={(v) => onUpdate({ ...settings, confirmDraw: v })}
      />
      <ToggleRow
        label={t('settings.gameplay.confirmAbort')}
        desc={t('settings.gameplay.confirmAbortDesc')}
        checked={settings.confirmAbort}
        onChange={(v) => onUpdate({ ...settings, confirmAbort: v })}
      />
      <ToggleRow
        label={t('settings.gameplay.autoNextGame')}
        desc={t('settings.gameplay.autoNextGameDesc')}
        checked={settings.autoNextGame}
        onChange={(v) => onUpdate({ ...settings, autoNextGame: v })}
      />

      <Section title={t('settings.gameplay.history')} />
      <ToggleRow
        label={t('settings.gameplay.showTimestamps')}
        desc={t('settings.gameplay.showTimestampsDesc')}
        checked={settings.showTimestampsInHistory}
        onChange={(v) => onUpdate({ ...settings, showTimestampsInHistory: v })}
      />
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
  const timePresets = [
    { min: 1, inc: 0, label: t('settings.clock.bullet1') },
    { min: 3, inc: 0, label: t('settings.clock.blitz3') },
    { min: 3, inc: 2, label: t('settings.clock.blitz32') },
    { min: 5, inc: 0, label: t('settings.clock.blitz5') },
    { min: 10, inc: 0, label: t('settings.clock.rapid10') },
    { min: 10, inc: 5, label: t('settings.clock.rapid105') },
    { min: 30, inc: 0, label: t('settings.clock.classical30') },
  ];

  return (
    <>
      <Section title={t('settings.clock.timeControl')} />
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
          <div className="settings-label" style={{ marginBottom: 4 }}>
            {t('settings.clock.initialTime')}
          </div>
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
          <div className="settings-label" style={{ marginBottom: 4 }}>
            {t('settings.clock.increment')}
          </div>
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

      <Section title={t('settings.clock.preview')} />
      <div style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 300,
            fontVariantNumeric: 'tabular-nums',
            color: '#e0e0e0',
            letterSpacing: '1px',
          }}
        >
          {formatClockPreview(settings.timeControlMinutes, settings.clockDecimalPlaces)}
        </div>
      </div>
    </>
  );
}

function AdvancedTab({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  const [refreshToken, dispatch] = useReducer((x: number) => x + 1, 0);
  const [confirmClear, setConfirmClear] = useState(false);

  const localKeys = getLocalStorageKeys();

  const autoLogoutOptions = [
    { value: '0', label: t('settings.options.disabled') },
    { value: '1', label: t('settings.options.min1') },
    { value: '5', label: t('settings.options.min5') },
    { value: '10', label: t('settings.options.min10') },
    { value: '15', label: t('settings.options.min15') },
    { value: '30', label: t('settings.options.min30') },
    { value: '60', label: t('settings.options.min60') },
  ];

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
      <Section title={t('settings.advanced.server')} />
      <ToggleRow
        label={t('settings.advanced.alwaysAskUrl')}
        desc={t('settings.advanced.alwaysAskUrlDesc')}
        checked={settings.alwaysAskServerUrl}
        onChange={(v) => onUpdate({ ...settings, alwaysAskServerUrl: v })}
      />

      <Section title={t('settings.advanced.session')} />
      <SelectRow
        label={t('settings.advanced.autoLogout')}
        desc={t('settings.advanced.autoLogoutDesc')}
        options={autoLogoutOptions}
        value={String(settings.autoLogoutMinutes)}
        onChange={(v) => onUpdate({ ...settings, autoLogoutMinutes: Number(v) })}
      />

      <Section title={t('settings.advanced.storedData')} />
      {dataRows.length === 0 ? (
        <div style={{ fontSize: 13, color: '#888', padding: '12px 0', textAlign: 'center' }}>
          {t('settings.advanced.noData')}
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
              <div
                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ccc' }}
              >
                {row.key}
                <span style={{ color: '#666', marginLeft: 8 }}>({row.size} B)</span>
              </div>
              <button
                className="btn btn-ghost btn-xs"
                style={{ flexShrink: 0, marginLeft: 8, fontSize: 10, padding: '2px 8px' }}
                onClick={() => handleClearKey(row.key)}
              >
                {t('settings.advanced.clear')}
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        {confirmClear ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-danger btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={handleClearAll}>
              {t('settings.advanced.confirmClearAll')}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ flex: 1, fontSize: 12 }}
              onClick={() => setConfirmClear(false)}
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', fontSize: 12, color: 'rgba(220,80,80,0.8)', borderColor: 'rgba(220,80,80,0.3)' }}
            onClick={() => setConfirmClear(true)}
          >
            {t('settings.advanced.clearAll')}
          </button>
        )}
      </div>
    </>
  );
}

export default function SettingsDialog({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: t('settings.tabs.general') },
    { id: 'board', label: t('settings.tabs.board') },
    { id: 'display', label: t('settings.tabs.display') },
    { id: 'gameplay', label: t('settings.tabs.gameplay') },
    { id: 'clock', label: t('settings.tabs.clock') },
    { id: 'advanced', label: t('settings.tabs.advanced') },
  ];

  function updateSettings(s: AppSettings) {
    setSettings(s);
    saveSettings(s);
    setSoundVolume(s.soundVolume);
    if (s.language !== getLanguage()) {
      setLanguage(s.language);
    }
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', letterSpacing: '-0.3px' }}>
            {t('settings.title')}
          </h2>
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

        <div style={{ padding: '8px 28px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'general' && <GeneralTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'board' && <BoardTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'display' && <DisplayTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'gameplay' && <GameplayTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'clock' && <ClockTab settings={settings} onUpdate={updateSettings} />}
          {activeTab === 'advanced' && <AdvancedTab settings={settings} onUpdate={updateSettings} />}
        </div>

        <div style={{ padding: '0 28px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={resetDefaults} style={{ width: '100%', fontSize: 12 }}>
            {t('settings.reset')}
          </button>
        </div>
      </div>
    </div>
  );
}
