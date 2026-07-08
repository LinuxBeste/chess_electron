import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navigation from '../src/renderer/components/Navigation';
import { store } from '../src/renderer/store';

jest.mock('lucide-react', () => ({
  Swords: () => <span data-testid="icon-swords">⚔</span>,
  Trophy: () => <span data-testid="icon-trophy">🏆</span>,
  Archive: () => <span data-testid="icon-archive">🗄</span>,
  Award: () => <span data-testid="icon-award">🏅</span>,
  PenLine: () => <span data-testid="icon-pen">✏</span>,
  BarChart3: () => <span data-testid="icon-stats">📊</span>,
  ChevronLeft: () => <span data-testid="icon-chevron-left">◀</span>,
  ChevronRight: () => <span data-testid="icon-chevron-right">▶</span>,
}));

jest.mock('../src/renderer/components/StatsDialog', () => ({
  __esModule: true,
  default: ({ onClose: _onClose }: { onClose: () => void }) => <div data-testid="stats-dialog">Stats</div>,
}));

jest.mock('../src/renderer/api', () => ({
  getMe: jest.fn(),
}));

describe('Navigation', () => {
  beforeEach(() => {
    store.set('navOpen', true);
    store.set('navMinimized', false);
  });

  function renderNav() {
    return render(
      <MemoryRouter initialEntries={['/lobby']}>
        <Navigation />
      </MemoryRouter>,
    );
  }

  test('renders null when navOpen is false', () => {
    store.set('navOpen', false);
    const { container } = render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );
    expect(container.innerHTML).toBe('');
  });

  test('renders all nav items when open', () => {
    renderNav();
    expect(screen.getByText('Play')).toBeTruthy();
    expect(screen.getByText('Leaderboard')).toBeTruthy();
    expect(screen.getByText('Archive')).toBeTruthy();
    expect(screen.getByText('Tournaments')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
  });

  test('highlights active nav item', () => {
    renderNav();
    const playBtn = screen.getByText('Play').closest('button');
    expect(playBtn?.className).toContain('nav-active');
    expect(screen.getByText('Leaderboard').closest('button')?.className).not.toContain('nav-active');
  });

  test('minimize button sets navMinimized', () => {
    renderNav();
    fireEvent.click(screen.getByTitle('Minimize'));
    expect(store.get('navMinimized')).toBe(true);
  });

  test('minimized view shows expand button and icon-only items', () => {
    store.set('navMinimized', true);
    renderNav();
    expect(screen.getByTitle('Expand')).toBeTruthy();
    expect(screen.getByTitle('Play')).toBeTruthy();
    expect(screen.getByTitle('Leaderboard')).toBeTruthy();
  });

  test('expand button in minimized view expands nav', () => {
    store.set('navMinimized', true);
    renderNav();
    fireEvent.click(screen.getByTitle('Expand'));
    expect(store.get('navMinimized')).toBe(false);
  });

  test('renders nav-panel class when expanded', () => {
    const { container } = renderNav();
    const panel = container.querySelector('.nav-panel');
    expect(panel).toBeTruthy();
    expect(panel?.className).not.toContain('nav-minimized');
  });

  test('renders nav-minimized class when minimized', () => {
    store.set('navMinimized', true);
    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );
    const panel = container.querySelector('.nav-panel');
    expect(panel?.className).toContain('nav-minimized');
  });

  test('updates --nav-push-left on mount', () => {
    renderNav();
    expect(document.documentElement.style.getPropertyValue('--nav-push-left')).toBe('160px');
  });

  test('sets --nav-push-left to 44px when minimized', () => {
    store.set('navMinimized', true);
    renderNav();
    expect(document.documentElement.style.getPropertyValue('--nav-push-left')).toBe('44px');
  });

  test('sets --nav-push-left to 0px when closed', () => {
    store.set('navOpen', false);
    const { container } = render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>,
    );
    expect(document.documentElement.style.getPropertyValue('--nav-push-left')).toBe('0px');
  });
});
