import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LobbyPanel from '../src/renderer/components/LobbyPanel';
import { store } from '../src/renderer/store';

jest.mock('../src/renderer/api', () => ({
  createGame: jest.fn(),
  createBotGame: jest.fn(),
  joinGame: jest.fn(),
  getGame: jest.fn(),
}));

import * as api from '../src/renderer/api';

describe('LobbyPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.set('offline', false);
    store.set('currentGame', null);
  });

  function renderPanel() {
    return render(
      <MemoryRouter>
        <LobbyPanel />
      </MemoryRouter>,
    );
  }

  test('renders local 1v1 card', () => {
    renderPanel();
    expect(screen.getByText('Local 1v1')).toBeTruthy();
    expect(screen.getByText('Start Local Game')).toBeTruthy();
  });

  test('renders create game section when online', () => {
    renderPanel();
    expect(screen.getByText('Create Game')).toBeTruthy();
    expect(screen.getByText('New Game')).toBeTruthy();
  });

  test('renders play vs bot section when online', () => {
    renderPanel();
    expect(screen.getByText('Play vs Bot')).toBeTruthy();
    expect(screen.getByText('Start Bot Game')).toBeTruthy();
  });

  test('renders join by ID section when online', () => {
    renderPanel();
    expect(screen.getByText('Join by ID')).toBeTruthy();
  });

  test('renders spectate section when online', () => {
    renderPanel();
    expect(screen.getByText('Spectate by ID')).toBeTruthy();
  });

  test('hides online sections when offline', () => {
    store.set('offline', true);
    renderPanel();
    expect(screen.queryByText('Create Game')).toBeNull();
    expect(screen.queryByText('Play vs Bot')).toBeNull();
    expect(screen.queryByText('Join by ID')).toBeNull();
    expect(screen.queryByText('Spectate by ID')).toBeNull();
    expect(screen.getByText('Local 1v1')).toBeTruthy();
  });

  test('calls createGame on New Game button click', async () => {
    (api.createGame as unknown as jest.Mock<() => Promise<{ id: string }>>).mockResolvedValue({ id: 'g1' });
    renderPanel();
    await fireEvent.click(screen.getByText('New Game'));
    expect(api.createGame).toHaveBeenCalledWith('public');
  });

  test('toggles private game switch', () => {
    renderPanel();
    const toggle = document.querySelector('.toggle');
    expect(toggle?.className).not.toContain('active');
    fireEvent.click(toggle!);
    expect(toggle?.className).toContain('active');
  });

  test('calls createGame with private when toggle is on', async () => {
    (api.createGame as unknown as jest.Mock<() => Promise<{ id: string }>>).mockResolvedValue({ id: 'g2' });
    renderPanel();
    const toggle = document.querySelector('.toggle');
    fireEvent.click(toggle!);
    await fireEvent.click(screen.getByText('New Game'));
    expect(api.createGame).toHaveBeenCalledWith('private');
  });

  test('calls joinGame with entered ID', async () => {
    (api.createGame as unknown as jest.Mock<() => Promise<{ id: string }>>).mockResolvedValue({ id: 'g3' });
    renderPanel();
    const inputs = screen.getAllByPlaceholderText('Paste game ID...');
    const joinInput = inputs[0];
    fireEvent.change(joinInput, { target: { value: 'abc123' } });
    fireEvent.click(screen.getByText('Join'));
    expect(api.joinGame).toHaveBeenCalledWith('abc123');
  });

  test('join input triggers on Enter key', async () => {
    (api.joinGame as unknown as jest.Mock<() => Promise<{ id: string }>>).mockResolvedValue({ id: 'g4' });
    renderPanel();
    const inputs = screen.getAllByPlaceholderText('Paste game ID...');
    const joinInput = inputs[0];
    fireEvent.change(joinInput, { target: { value: 'gid-enter' } });
    fireEvent.keyDown(joinInput, { key: 'Enter' });
    expect(api.joinGame).toHaveBeenCalledWith('gid-enter');
  });

  test('calls spectateGame with entered ID', async () => {
    (api.getGame as unknown as jest.Mock<() => Promise<{ id: string }>>).mockResolvedValue({ id: 'g6' });
    renderPanel();
    const inputs = screen.getAllByPlaceholderText('Paste game ID...');
    const spectateInput = inputs[1];
    fireEvent.change(spectateInput, { target: { value: 'spec-1' } });
    fireEvent.click(screen.getByText('Spectate'));
    expect(api.getGame).toHaveBeenCalledWith('spec-1');
  });
});
