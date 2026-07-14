import { describe, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import ShortcutsTab from '../src/renderer/components/ShortcutsTab';

describe('ShortcutsTab', () => {
  test('renders the intro text', () => {
    render(<ShortcutsTab />);
    expect(screen.getByText(/press the key combination/i)).toBeTruthy();
  });

  test('renders all three category sections', () => {
    render(<ShortcutsTab />);
    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.getByText('Game')).toBeTruthy();
    expect(screen.getByText('Navigation')).toBeTruthy();
  });

  test('renders known shortcut labels', () => {
    render(<ShortcutsTab />);
    expect(screen.getByText('Command Palette')).toBeTruthy();
    expect(screen.getByText('Flip Board')).toBeTruthy();
    expect(screen.getByText('Go to Lobby')).toBeTruthy();
  });

  test('renders key combos as kbd elements', () => {
    render(<ShortcutsTab />);
    expect(screen.getByText('Ctrl+K / ?')).toBeTruthy();
    expect(screen.getByText('F')).toBeTruthy();
  });

  test('renders description text for shortcuts', () => {
    render(<ShortcutsTab />);
    expect(screen.getByText(/open the command palette/i)).toBeTruthy();
    expect(screen.getByText(/rotate the board/i)).toBeTruthy();
  });
});
