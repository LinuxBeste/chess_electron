import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LobbyPage from '../src/renderer/pages/LobbyPage';
import { store } from '../src/renderer/store';

jest.mock('../src/renderer/api', () => {
  const mockFn = () => Promise.resolve([]);
  return {
    getOpenGames: jest.fn().mockImplementation(mockFn),
    getActiveGames: jest.fn().mockImplementation(mockFn),
    getGame: jest.fn(),
    createGame: jest.fn(),
    joinGame: jest.fn(),
    setBaseUrl: jest.fn(),
  };
});

describe('LobbyPage — offline mode', () => {
  beforeEach(() => {
    store.set('token', null);
    store.set('playerId', null);
    store.set('username', 'TestPlayer');
    store.set('offline', false);
    store.set('currentGame', null);
  });

  async function renderPage() {
    let result: ReturnType<typeof render>;
    await act(async () => {
      result = render(
        <MemoryRouter>
          <LobbyPage />
        </MemoryRouter>,
      );
    });
    return result!;
  }

  test('shows open games heading when online', async () => {
    await renderPage();
    expect(screen.getByText('Open Games')).toBeTruthy();
  });

  test('shows live games heading when online', async () => {
    await renderPage();
    expect(screen.getByText('Live Games')).toBeTruthy();
  });

  test('shows no open games message when online and empty', async () => {
    await renderPage();
    expect(screen.getByText('No open games yet')).toBeTruthy();
  });

  test('hides open games when offline', async () => {
    store.set('offline', true);
    await renderPage();
    expect(screen.queryByText('Open Games')).toBeNull();
    expect(screen.queryByText('Live Games')).toBeNull();
  });

  test('hides open games section when offline', async () => {
    store.set('offline', true);
    await renderPage();
    expect(screen.queryByText('No open games')).toBeNull();
  });
});
