import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import StatsDialog from '../src/renderer/components/StatsDialog';
import * as api from '../src/renderer/api';

jest.mock('../src/renderer/api', () => ({
  getMe: jest.fn(),
}));

jest.mock('lucide-react', () => ({
  X: () => '✕',
}));

const mockGetMe = api.getMe as unknown as {
  mockResolvedValue: (v: unknown) => void;
  mockImplementation: (v: unknown) => void;
};

describe('StatsDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading state initially', () => {
    mockGetMe.mockImplementation(() => new Promise(() => {}));
    render(<StatsDialog onClose={() => {}} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  test('calls getMe on mount', () => {
    mockGetMe.mockResolvedValue({
      id: 'p1',
      username: 'test',
      displayName: '',
      isRegistered: true,
      createdAt: Date.now(),
      avatarUrl: null,
      stats: { wins: 10, losses: 5, draws: 3 },
    });
    render(<StatsDialog onClose={() => {}} />);
    expect(api.getMe).toHaveBeenCalled();
  });

  test('renders stats when loaded', async () => {
    mockGetMe.mockResolvedValue({
      id: 'p1',
      username: 'test',
      displayName: '',
      isRegistered: true,
      createdAt: Date.now(),
      avatarUrl: null,
      stats: { wins: 10, losses: 5, draws: 3 },
    });
    await act(async () => {
      render(<StatsDialog onClose={() => {}} />);
    });
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Wins')).toBeTruthy();
    expect(screen.getByText('Losses')).toBeTruthy();
    expect(screen.getByText('Draws')).toBeTruthy();
  });

  test('shows unregistered message when no stats', async () => {
    mockGetMe.mockResolvedValue({
      id: 'p1',
      username: 'test',
      displayName: '',
      isRegistered: false,
      createdAt: null,
      avatarUrl: null,
      stats: undefined,
    });
    await act(async () => {
      render(<StatsDialog onClose={() => {}} />);
    });
    expect(screen.getByText('Stats are only available for registered accounts.')).toBeTruthy();
    expect(screen.getByText('Log in or create an account to track your stats.')).toBeTruthy();
  });

  test('renders total games count', async () => {
    mockGetMe.mockResolvedValue({
      id: 'p1',
      username: 'test',
      displayName: '',
      isRegistered: true,
      createdAt: Date.now(),
      avatarUrl: null,
      stats: { wins: 10, losses: 5, draws: 3 },
    });
    await act(async () => {
      render(<StatsDialog onClose={() => {}} />);
    });
    expect(screen.getByText('Total: 18 games')).toBeTruthy();
  });

  test('calls onClose when overlay clicked', async () => {
    const onClose = jest.fn();
    mockGetMe.mockResolvedValue({
      id: 'p1',
      username: 'test',
      displayName: '',
      isRegistered: true,
      createdAt: Date.now(),
      avatarUrl: null,
      stats: { wins: 0, losses: 0, draws: 0 },
    });
    await act(async () => {
      render(<StatsDialog onClose={onClose} />);
    });
    const overlay = document.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when X button clicked', async () => {
    const onClose = jest.fn();
    mockGetMe.mockResolvedValue({
      id: 'p1',
      username: 'test',
      displayName: '',
      isRegistered: true,
      createdAt: Date.now(),
      avatarUrl: null,
      stats: { wins: 0, losses: 0, draws: 0 },
    });
    await act(async () => {
      render(<StatsDialog onClose={onClose} />);
    });
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });
});
