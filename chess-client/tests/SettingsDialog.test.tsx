import { describe, test, expect } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsDialog from '../src/renderer/components/SettingsDialog';
import { loadSettings } from '../src/renderer/settings';

describe('SettingsDialog', () => {
  test('renders with general tab active by default', () => {
    render(<SettingsDialog onClose={() => {}} />);
    expect(screen.getByText('Sound Effects')).toBeTruthy();
    expect(screen.getByText('Sound Volume')).toBeTruthy();
    expect(screen.getByText('Animations')).toBeTruthy();
    expect(screen.getByText('Piece Set')).toBeTruthy();
  });

  test('switches to board tab on click', () => {
    render(<SettingsDialog onClose={() => {}} />);
    fireEvent.click(screen.getByText('Board'));
    expect(screen.getByText('Board Theme')).toBeTruthy();
    expect(screen.getByText('Show Coordinates')).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  test('switches to display tab on click', () => {
    render(<SettingsDialog onClose={() => {}} />);
    fireEvent.click(screen.getByText('Display'));
    expect(screen.getByText('Always White at Bottom')).toBeTruthy();
    expect(screen.getByText('Show Legal Move Hints')).toBeTruthy();
    expect(screen.getByText('Highlight Last Move')).toBeTruthy();
  });

  test('switches to gameplay tab on click', () => {
    render(<SettingsDialog onClose={() => {}} />);
    fireEvent.click(screen.getByText('Gameplay'));
    expect(screen.getByText('Auto-Promote to Queen')).toBeTruthy();
    expect(screen.getByText('Confirm Resign')).toBeTruthy();
    expect(screen.getByText('Confirm Draw')).toBeTruthy();
  });

  test('calls onClose when close button clicked', () => {
    let closed = false;
    render(<SettingsDialog onClose={() => { closed = true; }} />);
    fireEvent.click(screen.getByText('✕'));
    expect(closed).toBe(true);
  });

  test('calls onClose when overlay clicked', () => {
    let closed = false;
    const { container } = render(<SettingsDialog onClose={() => { closed = true; }} />);
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(closed).toBe(true);
  });

  test('toggle sound changes setting', () => {
    render(<SettingsDialog onClose={() => {}} />);
    const toggle = screen.getByText('Sound Effects').closest('.settings-row')?.querySelector('.toggle');
    const initial = loadSettings().soundEnabled;
    fireEvent.click(toggle!);
    expect(loadSettings().soundEnabled).toBe(!initial);
  });

  test('reset to defaults button exists', () => {
    render(<SettingsDialog onClose={() => {}} />);
    expect(screen.getByText('Reset to Defaults')).toBeTruthy();
  });

  test('general tab has volume slider', () => {
    render(<SettingsDialog onClose={() => {}} />);
    const slider = document.querySelector('.settings-slider') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.value).toBe('100');
  });
});
