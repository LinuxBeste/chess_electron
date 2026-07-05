import { describe, test, expect, beforeEach } from '@jest/globals';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../src/renderer/components/Navbar';
import { store } from '../src/renderer/store';

describe('Navbar', () => {
  beforeEach(() => {
    store.set('token', null);
    store.set('username', null);
    store.set('offline', false);
    store.set('wsStatus', 'disconnected');
  });

  function renderNavbar() {
    return render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
  }

  test('shows brand when logged out', () => {
    renderNavbar();
    expect(screen.getByText(/chess/i)).toBeTruthy();
  });

  test('shows no user section when logged out', () => {
    renderNavbar();
    expect(screen.queryByText('Logout')).toBeNull();
    expect(screen.getByTitle('Settings')).toBeTruthy();
    expect(screen.queryByTitle('History')).toBeNull();
  });

  test('shows username and all buttons when online', () => {
    store.set('token', 'abc123');
    store.set('username', 'OnlinePlayer');
    renderNavbar();
    expect(screen.getByText('OnlinePlayer')).toBeTruthy();
    expect(screen.getByTitle('Settings')).toBeTruthy();
    expect(screen.getByTitle('History')).toBeTruthy();
    expect(screen.getByTitle('Logout')).toBeTruthy();
  });

  test('shows connection dot when online', () => {
    store.set('token', 'abc');
    store.set('username', 'Player');
    renderNavbar();
    const playerSpan = screen.getByText('Player').parentElement!;
    const dot = playerSpan.querySelector('.navbar-dot');
    expect(dot).toBeTruthy();
    expect(dot!.className).toContain('navbar-dot');
  });

  test('shows username and settings/logout but no history when offline', () => {
    store.set('offline', true);
    store.set('username', 'OfflinePlayer');
    renderNavbar();
    expect(screen.getByText('OfflinePlayer')).toBeTruthy();
    expect(screen.getByTitle('Settings')).toBeTruthy();
    expect(screen.getByTitle('Logout')).toBeTruthy();
    expect(screen.queryByTitle('History')).toBeNull();
  });

  test('offline mode username has offline dot', () => {
    store.set('offline', true);
    store.set('username', 'OfflinePlayer');
    renderNavbar();
    const playerSpan = screen.getByText('OfflinePlayer').parentElement!;
    const dot = playerSpan.querySelector('.navbar-dot');
    expect(dot).toBeTruthy();
    expect(dot!.className).toContain('offline');
  });

  test('switching from offline to online shows history', () => {
    store.set('offline', true);
    store.set('username', 'Player');
    const { rerender } = render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    expect(screen.queryByTitle('History')).toBeNull();

    act(() => {
      store.set('offline', false);
      store.set('token', 'abc');
    });
    rerender(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );
    expect(screen.getByTitle('History')).toBeTruthy();
  });

  test('removes user section when username is cleared', () => {
    store.set('token', 'abc');
    store.set('username', 'Player');
    renderNavbar();
    expect(screen.getByText('Player')).toBeTruthy();

    act(() => {
      store.set('token', null);
      store.set('username', null);
      store.set('offline', false);
      store.set('playerId', null);
    });
    expect(screen.queryByText('Player')).toBeNull();
    expect(screen.queryByTitle('Logout')).toBeNull();
  });
});
