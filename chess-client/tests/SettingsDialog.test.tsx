import { describe, test, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsDialog from '../src/renderer/components/SettingsDialog';
import { loadSettings } from '../src/renderer/settings';

jest.mock('lucide-react', () => ({
  X: () => '✕',
}));

describe('SettingsDialog', () => {
  test('renders with general tab active by default', () => {
    render(<SettingsDialog onClose={() => {}} />);
    expect(screen.getByText('Sound Effects')).toBeTruthy();
    expect(screen.getByText('Sound Volume')).toBeTruthy();
    expect(screen.getByText('Piece Set')).toBeTruthy();
  });

  test('switches to board tab on click', () => {
    render(<SettingsDialog onClose={() => {}} />);
    fireEvent.click(screen.getByText('Board'));
    expect(screen.getByText('Board Theme')).toBeTruthy();
    expect(screen.getByText('Board Style')).toBeTruthy();
    expect(screen.getByText('Board Size')).toBeTruthy();
    expect(screen.getByText('Show Coordinates')).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  test('switches to display tab on click', () => {
    render(<SettingsDialog onClose={() => {}} />);
    fireEvent.click(screen.getByText('Display'));
    expect(screen.getByText('Always White at Bottom')).toBeTruthy();
    expect(screen.getByText('Compact Mode')).toBeTruthy();
    expect(screen.getByText('Background Pattern')).toBeTruthy();
  });

  test('switches to gameplay tab on click', () => {
    render(<SettingsDialog onClose={() => {}} />);
    fireEvent.click(screen.getByText('Gameplay'));
    expect(screen.getByText('Auto-Promote to Queen')).toBeTruthy();
    expect(screen.getByText('Confirm Resign')).toBeTruthy();
    expect(screen.getByText('Confirm Draw')).toBeTruthy();
  });

  test('switches to clock tab on click', () => {
    render(<SettingsDialog onClose={() => {}} />);
    fireEvent.click(screen.getByText('Clock'));
    expect(screen.getByText('Time Control')).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  test('calls onClose when close button clicked', () => {
    let closed = false;
    render(
      <SettingsDialog
        onClose={() => {
          closed = true;
        }}
      />,
    );
    const dialog = screen.getByText('Sound Effects').closest('[style*="cursor: auto"]') || document.body;
    const buttons = dialog.querySelectorAll('button');
    const closeBtn = Array.from(buttons).find((b) => b.onclick?.toString().includes('onClose'));
    fireEvent.click(closeBtn || buttons[0]);
    expect(closed).toBe(true);
  });

  test('calls onClose when overlay clicked', () => {
    let closed = false;
    const { container } = render(
      <SettingsDialog
        onClose={() => {
          closed = true;
        }}
      />,
    );
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
