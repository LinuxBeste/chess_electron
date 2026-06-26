import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { store } from '../src/renderer/store';

const mockSocketManager = {
  onLobbyChat: jest.fn(() => jest.fn()),
  onLobbyChatHistory: jest.fn(() => jest.fn()),
  onPrivateChat: jest.fn(() => jest.fn()),
  onPrivateChatHistory: jest.fn(() => jest.fn()),
  onGroupChat: jest.fn(() => jest.fn()),
  onGroupChatHistory: jest.fn(() => jest.fn()),
  onGroupMemberAdded: jest.fn(() => jest.fn()),
  onGroupMemberRemoved: jest.fn(() => jest.fn()),
  onGroupMemberPromoted: jest.fn(() => jest.fn()),
  onGroupMemberDemoted: jest.fn(() => jest.fn()),
  onGroupOwnershipTransferred: jest.fn(() => jest.fn()),
  onGroupMemberLeft: jest.fn(() => jest.fn()),
  onGroupDisbanded: jest.fn(() => jest.fn()),
  onConversationCreated: jest.fn(() => jest.fn()),
  onGroupCreated: jest.fn(() => jest.fn()),
  requestConversations: jest.fn(),
  requestLobbyChatHistory: jest.fn(),
  requestPrivateChatHistory: jest.fn(),
  requestGroupChatHistory: jest.fn(),
  sendLobbyChat: jest.fn(),
  sendPrivateChat: jest.fn(),
  sendGroupChat: jest.fn(),
  createGroup: jest.fn(),
  startPrivateConversation: jest.fn(),
  groupAddMember: jest.fn(),
  groupRemoveMember: jest.fn(),
  groupPromoteMember: jest.fn(),
  groupDemoteMember: jest.fn(),
  groupTransferOwnership: jest.fn(),
  groupLeave: jest.fn(),
  groupDisband: jest.fn(),
};

jest.mock('../src/renderer/socket', () => ({
  socketManager: mockSocketManager,
}));

jest.mock('../src/renderer/components/LobbyPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="lobby-panel">Lobby Panel</div>,
}));

jest.mock('../src/renderer/components/FriendsPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="friends-panel">Friends Panel</div>,
}));

import Sidebar from '../src/renderer/components/Sidebar';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe('Sidebar', () => {
  beforeEach(() => {
    store.set('sidebarOpen', false);
    store.set('sidebarMinimized', false);
    store.set('sidebarPosition', 'right');
    store.set('sidebarTab', 'chat');
    store.set('conversations', []);
    store.set('unreadCount', 0);
    store.set('playerId', 'p1');
    setViewportWidth(1200);
  });

  test('renders null when sidebarOpen is false', () => {
    const { container } = render(<Sidebar />);
    expect(container.innerHTML).toBe('');
  });

  test('renders with tabs when sidebarOpen is true', () => {
    store.set('sidebarOpen', true);
    render(<Sidebar />);
    const lobbies = screen.getAllByText('Lobby');
    expect(lobbies.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Chat')).toBeTruthy();
    expect(screen.getByText('Friends')).toBeTruthy();
  });

  test('shows chat tab as active by default', () => {
    store.set('sidebarOpen', true);
    render(<Sidebar />);
    const tabs = document.querySelectorAll('.sidebar-tab');
    let chatActive = false;
    tabs.forEach((t) => {
      if (t.textContent?.includes('Chat') && t.className.includes('sidebar-tab-active')) {
        chatActive = true;
      }
    });
    expect(chatActive).toBe(true);
  });

  test('switches to lobby tab on click', () => {
    store.set('sidebarOpen', true);
    const { container } = render(<Sidebar />);
    const lobbyTabs = container.querySelectorAll('.sidebar-tab');
    let lobbyBtn: HTMLElement | null = null;
    lobbyTabs.forEach((t) => {
      if (t.textContent?.includes('Lobby')) lobbyBtn = t as HTMLElement;
    });
    fireEvent.click(lobbyBtn!);
    expect(store.get('sidebarTab')).toBe('play');
  });

  test('switches to friends tab on click', () => {
    store.set('sidebarOpen', true);
    render(<Sidebar />);
    fireEvent.click(screen.getByText('Friends'));
    expect(store.get('sidebarTab')).toBe('friends');
  });

  test('renders lobby panel when play tab is active', () => {
    store.set('sidebarOpen', true);
    store.set('sidebarTab', 'play');
    render(<Sidebar />);
    expect(screen.getByTestId('lobby-panel')).toBeTruthy();
  });

  test('renders friends panel when friends tab is active', () => {
    store.set('sidebarOpen', true);
    store.set('sidebarTab', 'friends');
    render(<Sidebar />);
    expect(screen.getByTestId('friends-panel')).toBeTruthy();
  });

  test('minimized view shows icon tabs', () => {
    store.set('sidebarOpen', true);
    store.set('sidebarMinimized', true);
    render(<Sidebar />);
    expect(screen.getByTitle('Lobby')).toBeTruthy();
    expect(screen.getByTitle('Chat')).toBeTruthy();
    expect(screen.getByTitle('Friends')).toBeTruthy();
  });

  test('minimized expand button expands sidebar', () => {
    store.set('sidebarOpen', true);
    store.set('sidebarMinimized', true);
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle('Expand'));
    expect(store.get('sidebarMinimized')).toBe(false);
  });

  test('clicking minimized chat tab opens and shows chat', () => {
    store.set('sidebarOpen', true);
    store.set('sidebarMinimized', true);
    store.set('sidebarTab', 'friends');
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle('Chat'));
    expect(store.get('sidebarTab')).toBe('chat');
    expect(store.get('sidebarMinimized')).toBe(false);
  });

  test('minimize button in full sidebar minimizes it', () => {
    store.set('sidebarOpen', true);
    render(<Sidebar />);
    const minimizeBtn = screen.getByTitle('Minimize');
    expect(minimizeBtn).toBeTruthy();
    fireEvent.click(minimizeBtn);
    expect(store.get('sidebarMinimized')).toBe(true);
  });

  test('shows unread badge on chat tab', () => {
    store.set('sidebarOpen', true);
    store.set('unreadCount', 5);
    render(<Sidebar />);
    const badges = document.querySelectorAll('.sidebar-badge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  test('shows 99+ badge for large unread count', () => {
    store.set('sidebarOpen', true);
    store.set('unreadCount', 150);
    render(<Sidebar />);
    const badges = document.querySelectorAll('.sidebar-badge');
    let found = false;
    badges.forEach((b) => {
      if (b.textContent === '99+') found = true;
    });
    expect(found).toBe(true);
  });

  test('shows unread badge in minimized mode', () => {
    store.set('sidebarOpen', true);
    store.set('sidebarMinimized', true);
    store.set('unreadCount', 3);
    render(<Sidebar />);
    const badges = document.querySelectorAll('.sidebar-mini-badge');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  test('Escape key closes the sidebar', () => {
    store.set('sidebarOpen', true);
    render(<Sidebar />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(store.get('sidebarOpen')).toBe(false);
  });

  test('Escape key does nothing when sidebar is minimized', () => {
    store.set('sidebarOpen', true);
    store.set('sidebarMinimized', true);
    render(<Sidebar />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(store.get('sidebarOpen')).toBe(true);
  });

  test('mobile view shows bottom sheet layout', () => {
    setViewportWidth(500);
    store.set('sidebarOpen', true);
    const { container } = render(<Sidebar />);
    expect(container.querySelector('.sidebar-bottom-sheet')).toBeTruthy();
  });

  test('mobile view has overlay', () => {
    setViewportWidth(500);
    store.set('sidebarOpen', true);
    render(<Sidebar />);
    expect(document.querySelector('.sidebar-overlay')).toBeTruthy();
  });

  test('clicking overlay closes sidebar on mobile', () => {
    setViewportWidth(500);
    store.set('sidebarOpen', true);
    render(<Sidebar />);
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(store.get('sidebarOpen')).toBe(false);
  });

  test('left position adds sidebar-left class', () => {
    store.set('sidebarOpen', true);
    store.set('sidebarPosition', 'left');
    const { container } = render(<Sidebar />);
    expect(container.querySelector('.sidebar-left')).toBeTruthy();
  });
});
