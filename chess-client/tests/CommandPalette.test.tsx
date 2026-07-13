import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from '../src/renderer/components/CommandPalette';
import { store } from '../src/renderer/store';
import { loadSettings } from '../src/renderer/settings';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...(jest.requireActual('react-router-dom') as Record<string, unknown>),
  useNavigate: () => mockNavigate,
}));

function renderPalette(overrides: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  const onClose = jest.fn();
  const onOpenSettings = jest.fn();
  const onOpenHistory = jest.fn();
  const result = render(
    <MemoryRouter>
      <CommandPalette onClose={onClose} onOpenSettings={onOpenSettings} onOpenHistory={onOpenHistory} {...overrides} />
    </MemoryRouter>,
  );
  return { ...result, onClose, onOpenSettings, onOpenHistory };
}

describe('CommandPalette', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    store.set('token', null);
    store.set('username', null);
    store.set('playerId', null);
    store.set('offline', false);
    window.location.hash = '';
  });

  describe('rendering', () => {
    test('shows input and prompt', () => {
      renderPalette();
      expect(screen.getByPlaceholderText('Type a command...')).toBeTruthy();
      expect(screen.getByText('>')).toBeTruthy();
      expect(screen.getByText('Esc')).toBeTruthy();
    });

    test('shows default commands when logged out', () => {
      renderPalette();
      expect(screen.getByText('Start Local Game')).toBeTruthy();
      expect(screen.getByText('Go to Lobby')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
      expect(screen.getByText('Login / Sign In')).toBeTruthy();
    });

    test('shows commands grouped by category', () => {
      renderPalette();
      expect(screen.getByText('Create')).toBeTruthy();
      expect(screen.getByText('Navigate')).toBeTruthy();
      expect(screen.getByText('Actions')).toBeTruthy();
    });

    test('shows history and logout when logged in', () => {
      store.set('token', 'abc');
      store.set('username', 'Player');
      renderPalette();
      expect(screen.getByText('History')).toBeTruthy();
      expect(screen.getByText('Logout')).toBeTruthy();
    });

    test('shows My Profile when playerId is set', () => {
      store.set('token', 'abc');
      store.set('username', 'Player');
      store.set('playerId', '42');
      renderPalette();
      expect(screen.getByText('My Profile')).toBeTruthy();
    });

    test('shows game commands on game page', () => {
      window.location.hash = '#/game/abc123';
      renderPalette();
      expect(screen.getByText('Resign')).toBeTruthy();
      expect(screen.getByText('Offer Draw')).toBeTruthy();
      expect(screen.getByText('Copy Game ID')).toBeTruthy();
    });

    test('hides game commands on non-game page', () => {
      renderPalette();
      expect(screen.queryByText('Resign')).toBeNull();
      expect(screen.queryByText('Offer Draw')).toBeNull();
    });
  });

  describe('search filtering', () => {
    test('filters commands by query', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.change(input, { target: { value: 'Lobby' } });
      expect(screen.getByText('Go to Lobby')).toBeTruthy();
      expect(screen.queryByText('Start Local Game')).toBeNull();
    });

    test('shows no results message for unmatched query', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.change(input, { target: { value: 'xyznonexistent' } });
      expect(screen.getByText('No matching commands')).toBeTruthy();
    });

    test('search is case insensitive', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.change(input, { target: { value: 'lobby' } });
      expect(screen.getByText('Go to Lobby')).toBeTruthy();
    });

    test('typing "login" finds the login command', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.change(input, { target: { value: 'login' } });
      expect(screen.getByText('Login / Sign In')).toBeTruthy();
    });

    test('typing "logout" finds the logout command', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.change(input, { target: { value: 'logout' } });
      expect(screen.getByText('Logout')).toBeTruthy();
    });

    test('resets selection index on filter', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.change(input, { target: { value: 'Lobby' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
    });
  });

  describe('keyboard navigation', () => {
    test('arrow down moves active selection forward', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      const items = () => document.querySelectorAll('.cmd-item');

      expect(items()[0].className).toContain('cmd-active');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(items()[0].className).not.toContain('cmd-active');
      expect(items()[1].className).toContain('cmd-active');
    });

    test('arrow up moves active selection backward', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      const items = () => document.querySelectorAll('.cmd-item');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(items()[2].className).toContain('cmd-active');

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(items()[1].className).toContain('cmd-active');
    });

    test('arrow up at top stays on first item', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      const items = () => document.querySelectorAll('.cmd-item');
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(items()[0].className).toContain('cmd-active');
    });

    test('enter executes selected command', () => {
      const { onClose } = renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
      expect(onClose).toHaveBeenCalled();
    });

    test('escape closes palette', () => {
      const { onClose } = renderPalette();
      const input = screen.getByPlaceholderText('Type a command...');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('mouse interaction', () => {
    test('clicking overlay closes palette', () => {
      const { onClose } = renderPalette();
      const overlay = document.querySelector('.cmd-overlay')!;
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    });

    test('clicking inside palette does not close', () => {
      const { onClose } = renderPalette();
      const palette = document.querySelector('.cmd-palette')!;
      fireEvent.click(palette);
      expect(onClose).not.toHaveBeenCalled();
    });

    test('clicking a command executes its action', () => {
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Go to Lobby'));
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
      expect(onClose).toHaveBeenCalled();
    });

    test('hovering a command highlights it', () => {
      renderPalette();
      const items = document.querySelectorAll('.cmd-item');
      fireEvent.mouseEnter(items[2]);
      expect(items[2].className).toContain('cmd-active');
    });
  });

  describe('command execution', () => {
    test('local game navigates to /local', () => {
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Start Local Game'));
      expect(mockNavigate).toHaveBeenCalledWith('/local');
      expect(onClose).toHaveBeenCalled();
    });

    test('lobby navigates to /lobby', () => {
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Go to Lobby'));
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
      expect(onClose).toHaveBeenCalled();
    });

    test('settings triggers onOpenSettings', () => {
      const { onClose, onOpenSettings } = renderPalette();
      fireEvent.click(screen.getByText('Settings'));
      expect(onOpenSettings).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    test('history triggers onOpenHistory', () => {
      store.set('token', 'abc');
      store.set('username', 'Player');
      const { onClose, onOpenHistory } = renderPalette();
      fireEvent.click(screen.getByText('History'));
      expect(onOpenHistory).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    test('profile navigates to /profile/:id', () => {
      store.set('playerId', '99');
      store.set('token', 'abc');
      store.set('username', 'Player');
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('My Profile'));
      expect(mockNavigate).toHaveBeenCalledWith('/profile/99');
      expect(onClose).toHaveBeenCalled();
    });

    test('logout clears session and navigates to /login', () => {
      store.set('token', 'abc');
      store.set('username', 'Player');
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Logout'));
      expect(store.get('token')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
      expect(onClose).toHaveBeenCalled();
    });

    test('sign in navigates to /login', () => {
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Login / Sign In'));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
      expect(onClose).toHaveBeenCalled();
    });

    test('logout always shows and navigates to /login when not logged in', () => {
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Logout'));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
      expect(onClose).toHaveBeenCalled();
    });

    test('new game navigates to /lobby', () => {
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('New Game'));
      expect(mockNavigate).toHaveBeenCalledWith('/lobby');
      expect(onClose).toHaveBeenCalled();
    });

    test('sidebar toggle opens minimized sidebar', () => {
      store.set('sidebarMinimized', true);
      store.set('sidebarOpen', true);
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Toggle Sidebar'));
      expect(store.get('sidebarOpen')).toBe(true);
      expect(store.get('sidebarMinimized')).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });

    test('sidebar toggle opens closed sidebar', () => {
      store.set('sidebarOpen', false);
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Toggle Sidebar'));
      expect(store.get('sidebarOpen')).toBe(true);
      expect(onClose).toHaveBeenCalled();
    });

    test('sidebar toggle closes open sidebar', () => {
      store.set('sidebarOpen', true);
      store.set('sidebarMinimized', false);
      const { onClose } = renderPalette();
      fireEvent.click(screen.getByText('Toggle Sidebar'));
      expect(store.get('sidebarOpen')).toBe(false);
      expect(onClose).toHaveBeenCalled();
    });

    test('toggle sound flips soundEnabled setting', () => {
      const before = loadSettings().soundEnabled;
      renderPalette();
      fireEvent.click(screen.getByText('Toggle Sound'));
      const after = loadSettings().soundEnabled;
      expect(after).toBe(!before);
    });

    test('toggle compact mode flips compactMode setting', () => {
      const before = loadSettings().compactMode;
      renderPalette();
      fireEvent.click(screen.getByText('Toggle Compact Mode'));
      const after = loadSettings().compactMode;
      expect(after).toBe(!before);
    });
  });

  describe('login state', () => {
    test('logout command is always present', () => {
      renderPalette();
      expect(screen.getByText('Logout')).toBeTruthy();
    });

    test('history command is absent when not logged in', () => {
      renderPalette();
      expect(screen.queryByText('History')).toBeNull();
    });

    test('both history and logout show when offline', () => {
      store.set('offline', true);
      store.set('username', 'Player');
      renderPalette();
      expect(screen.getByText('Logout')).toBeTruthy();
    });

    test('sign in appears when logged out', () => {
      renderPalette();
      expect(screen.getByText('Login / Sign In')).toBeTruthy();
    });
  });
});
