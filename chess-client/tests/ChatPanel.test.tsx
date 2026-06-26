import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
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

jest.mock('lucide-react', () => ({
  Hash: () => <span data-testid="icon-hash">#</span>,
  AtSign: () => <span data-testid="icon-at">@</span>,
  ArrowLeft: () => <span data-testid="icon-back">&larr;</span>,
  Plus: () => <span data-testid="icon-plus">+</span>,
  MessageCircle: () => <span data-testid="icon-msg">💬</span>,
  Settings: () => <span data-testid="icon-settings">⚙</span>,
  UserMinus: () => <span data-testid="icon-user-minus">-</span>,
  UserPlus: () => <span data-testid="icon-user-plus">+</span>,
  Crown: () => <span data-testid="icon-crown">👑</span>,
  Shield: () => <span data-testid="icon-shield">🛡</span>,
  ShieldOff: () => <span data-testid="icon-shield-off">⛔</span>,
  LogOut: () => <span data-testid="icon-logout">🚪</span>,
  Trash2: () => <span data-testid="icon-trash">🗑</span>,
  ArrowUpRight: () => <span data-testid="icon-up-right">↗</span>,
  Users: () => <span data-testid="icon-users">👥</span>,
  Swords: () => <span data-testid="icon-swords">⚔</span>,
  ChevronLeft: () => <span data-testid="icon-chevron-left">&lt;</span>,
  ChevronRight: () => <span data-testid="icon-chevron-right">&gt;</span>,
}));

import ChatPanel from '../src/renderer/components/ChatPanel';

function setConversations(
  convs: { id: string; type: string; name: string | null; lastMessageAt: number; unread: number; ownerId?: string }[],
) {
  store.set('conversations', convs as import('../src/types').ConversationInfo[]);
}

describe('ChatPanel — conversation list', () => {
  beforeEach(() => {
    store.set('playerId', 'p1');
    store.set('friends', []);
    store.set('conversations', []);
    store.set('sidebarOpen', true);
    jest.clearAllMocks();
  });

  test('shows empty state when no conversations', () => {
    setConversations([]);
    render(<ChatPanel />);
    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });
});

describe('ChatPanel — new group creation', () => {
  beforeEach(() => {
    store.set('playerId', 'p1');
    store.set('friends', []);
    store.set('conversations', []);
    store.set('wsStatus', 'connected');
    jest.clearAllMocks();
  });

  test('new group button opens create group form', () => {
    render(<ChatPanel />);
    const newGroupBtn = screen.getByTitle('New Group');
    expect(newGroupBtn).toBeTruthy();
    fireEvent.click(newGroupBtn);
    expect(screen.getByPlaceholderText('Group name...')).toBeTruthy();
  });

  test('create group form has input and submit button', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('New Group'));
    expect(screen.getByPlaceholderText('Group name...')).toBeTruthy();
    const newGroupEls = screen.getAllByText('New Group');
    expect(newGroupEls.length).toBe(2);
  });

  test('back button in create group form returns to list', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('New Group'));
    expect(screen.getByPlaceholderText('Group name...')).toBeTruthy();
    fireEvent.click(screen.getByTestId('icon-back'));
    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });

  test('typing name updates input', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('New Group'));
    const input = screen.getByPlaceholderText('Group name...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test Group' } });
    expect(input.value).toBe('Test Group');
  });

  test('create button with valid name calls socketManager.createGroup', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('New Group'));
    const input = screen.getByPlaceholderText('Group name...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My Group' } });
    fireEvent.click(screen.getAllByText('New Group')[1]);
    expect(mockSocketManager.createGroup).toHaveBeenCalledWith('My Group');
  });

  test('create with short name shows toast error', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('New Group'));
    const input = screen.getByPlaceholderText('Group name...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.click(screen.getAllByText('New Group')[1]);
    expect(mockSocketManager.createGroup).not.toHaveBeenCalled();
  });

  test('create with empty name does nothing', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('New Group'));
    fireEvent.click(screen.getAllByText('New Group')[1]);
    expect(mockSocketManager.createGroup).not.toHaveBeenCalled();
  });

  test('Enter key in input triggers createGroup', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('New Group'));
    const input = screen.getByPlaceholderText('Group name...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My Group' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSocketManager.createGroup).toHaveBeenCalledWith('My Group');
  });
});

describe('ChatPanel — group management', () => {
  beforeEach(() => {
    store.set('playerId', 'p1');
    store.set('friends', [
      { playerId: 'p2', username: 'bob', displayName: 'Bob', avatarUrl: null, isOnline: true, currentGameId: null },
    ]);
    store.set('conversations', [
      { id: 'group1', type: 'group', name: 'Test Group', lastMessageAt: 1000, unread: 0, ownerId: 'p1' },
    ]);
    jest.clearAllMocks();
  });

  test('group settings button appears for owner', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('Test Group'));
    expect(screen.getByTestId('icon-settings')).toBeTruthy();
  });

  test('manage group view shows member list header', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('Test Group'));
    fireEvent.click(screen.getByTestId('icon-settings'));
    expect(screen.getByText(/Members/)).toBeTruthy();
  });

  test('manage group back button returns to chat', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('Test Group'));
    fireEvent.click(screen.getByTestId('icon-settings'));
    fireEvent.click(screen.getByTestId('icon-back'));
    expect(screen.getByText('Test Group')).toBeTruthy();
  });

  test('disband group button visible for owner', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByText('Test Group'));
    fireEvent.click(screen.getByTestId('icon-settings'));
    expect(screen.getByText('Disband Group')).toBeTruthy();
  });
});

describe('ChatPanel — private conversations', () => {
  beforeEach(() => {
    store.set('playerId', 'p1');
    store.set('friends', [
      { playerId: 'p2', username: 'alice', displayName: 'Alice', avatarUrl: null, isOnline: true, currentGameId: null },
    ]);
    store.set('conversations', []);
    jest.clearAllMocks();
  });

  test('start conversation button opens search', () => {
    render(<ChatPanel />);
    const startBtn = screen.getByTitle('Start conversation');
    expect(startBtn).toBeTruthy();
    fireEvent.click(startBtn);
    expect(screen.getByPlaceholderText('Search friends...')).toBeTruthy();
  });

  test('search filters friends', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('Start conversation'));
    const search = screen.getByPlaceholderText('Search friends...') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'Ali' } });
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  test('clicking friend starts private conversation', () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle('Start conversation'));
    fireEvent.click(screen.getByText('Alice'));
    expect(mockSocketManager.startPrivateConversation).toHaveBeenCalledWith('p2');
  });
});
