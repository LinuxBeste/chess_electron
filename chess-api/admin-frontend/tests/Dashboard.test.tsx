import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabProvider } from '../src/TabContext';

vi.mock('../src/Toast', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../src/TabContext', async () => {
  const actual = await vi.importActual('../src/TabContext');
  return { ...actual, TabProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

vi.mock('../src/api', () => ({
  setToken: vi.fn(),
  getToken: () => null,
}));

const mockTabs: { key: string; label: string }[] = [];
let mockActive = 'overview';
const mockSetActive = vi.fn((k: string) => {
  mockActive = k;
});

vi.mock('../src/OverviewTab', () => ({ default: () => <div>Overview Content</div> }));

import Dashboard from '../src/Dashboard';

describe('Dashboard', () => {
  test('renders header with title and logout button', () => {
    render(<Dashboard onLogout={() => {}} />);
    expect(screen.getByText('Chess API Admin')).toBeTruthy();
    expect(screen.getByText('Logout')).toBeTruthy();
  });

  test('renders tab navigation with all tab labels', () => {
    render(<Dashboard onLogout={() => {}} />);
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Active Games')).toBeTruthy();
    expect(screen.getByText('Active Players')).toBeTruthy();
    expect(screen.getByText('Accounts')).toBeTruthy();
    expect(screen.getByText('Bans')).toBeTruthy();
    expect(screen.getByText('Logs')).toBeTruthy();
    expect(screen.getByText('Leaderboard')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
    expect(screen.getByText('Game Replay')).toBeTruthy();
    expect(screen.getByText('Tournaments')).toBeTruthy();
    expect(screen.getByText('Bot Games')).toBeTruthy();
    expect(screen.getByText('Broadcast')).toBeTruthy();
    expect(screen.getByText('Config')).toBeTruthy();
    expect(screen.getByText('DB Browser')).toBeTruthy();
    expect(screen.getByText('Reports')).toBeTruthy();
    expect(screen.getByText('WS Monitor')).toBeTruthy();
    expect(screen.getByText('Health')).toBeTruthy();
  });

  test('renders Overview tab by default', () => {
    render(<Dashboard onLogout={() => {}} />);
    expect(screen.getByText('Overview Content')).toBeTruthy();
  });

  test('calls onLogout when logout button clicked', () => {
    const onLogout = vi.fn();
    render(<Dashboard onLogout={onLogout} />);
    fireEvent.click(screen.getByText('Logout'));
    expect(onLogout).toHaveBeenCalled();
  });

  test('shows overview tab as active by default', () => {
    render(<Dashboard onLogout={() => {}} />);
    const overviewBtn = screen.getByText('Overview').closest('button')!;
    expect(overviewBtn.className).toContain('text-[#4a9eff]');
  });
});
