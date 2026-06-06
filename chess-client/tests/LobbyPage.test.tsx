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

  test('shows Local 1v1 card always', async () => {
    await renderPage();
    expect(screen.getByText('Local 1v1')).toBeTruthy();
    expect(screen.getByText('Start Local Game')).toBeTruthy();
  });

  test('shows open games, live games, create, join, spectate when online', async () => {
    await renderPage();
    expect(screen.getByText('Open Games')).toBeTruthy();
    expect(screen.getByText('Live Games')).toBeTruthy();
    expect(screen.getByText('Create Game')).toBeTruthy();
    expect(screen.getByText('Join by ID')).toBeTruthy();
    expect(screen.getByText('Spectate by ID')).toBeTruthy();
  });

  test('hides open games when offline', async () => {
    store.set('offline', true);
    await renderPage();
    expect(screen.queryByText('Open Games')).toBeNull();
    expect(screen.queryByText('Live Games')).toBeNull();
  });

  test('hides create game, join, spectate when offline', async () => {
    store.set('offline', true);
    await renderPage();
    expect(screen.queryByText('Create Game')).toBeNull();
    expect(screen.queryByText('Join by ID')).toBeNull();
    expect(screen.queryByText('Spectate by ID')).toBeNull();
  });

  test('still shows Local 1v1 when offline', async () => {
    store.set('offline', true);
    await renderPage();
    expect(screen.getByText('Local 1v1')).toBeTruthy();
    expect(screen.getByText('Start Local Game')).toBeTruthy();
  });
});
