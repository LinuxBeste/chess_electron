import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

const mockCreateUser = jest.fn();
const mockSaveToken = jest.fn();
const mockGetUserByUsername = jest.fn();
const mockGetUserById = jest.fn();
const mockDeleteToken = jest.fn();
const mockUpdateUserDisplayName = jest.fn();
const mockUpdateUserPasswordHash = jest.fn();
const mockTransaction = jest.fn();
const mockLoadAllUsers = jest.fn();
const mockLoadAllTokens = jest.fn();
const mockUuidV4 = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerDebug = jest.fn();
const mockLoggerError = jest.fn();

jest.unstable_mockModule('uuid', () => ({
  v4: mockUuidV4,
}));

jest.unstable_mockModule('../src/db.js', () => ({
  createUser: mockCreateUser,
  saveToken: mockSaveToken,
  getUserByUsername: mockGetUserByUsername,
  getUserById: mockGetUserById,
  deleteToken: mockDeleteToken,
  updateUserDisplayName: mockUpdateUserDisplayName,
  updateUserPasswordHash: mockUpdateUserPasswordHash,
  transaction: mockTransaction,
  loadAllUsers: mockLoadAllUsers,
  loadAllTokens: mockLoadAllTokens,
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  default: { info: mockLoggerInfo, warn: mockLoggerWarn, debug: mockLoggerDebug, error: mockLoggerError },
}));

const player = await import('../src/player.js');

beforeEach(() => {
  jest.clearAllMocks();
  player.players.clear();
  player.tokenIndex.clear();
  player.tokenExpiry.clear();
  player.playerIps.clear();
  mockUuidV4.mockReturnValue('00000000-0000-0000-0000-000000000000');
});

describe('checkLoginLockout', () => {
  test('returns unlocked for unknown username', () => {
    expect(player.checkLoginLockout('unknown')).toEqual({ locked: false });
  });

  test('returns locked with remainingMs when locked', () => {
    player.recordFailedAttempt('user1');
    // repeat enough to trigger lock
    for (let i = 0; i < 4; i++) player.recordFailedAttempt('user1');
    const result = player.checkLoginLockout('user1');
    expect(result.locked).toBe(true);
    expect(result.remainingMs).toBeGreaterThan(0);
  });
});

describe('recordFailedAttempt / clearLoginAttempts / cleanupLoginAttempts', () => {
  test('recordFailedAttempt increments count', () => {
    player.recordFailedAttempt('user1');
    // trigger lockout
    for (let i = 0; i < 4; i++) player.recordFailedAttempt('user1');
    expect(player.checkLoginLockout('user1').locked).toBe(true);
  });

  test('clearLoginAttempts removes entry', () => {
    player.recordFailedAttempt('user1');
    player.clearLoginAttempts('user1');
    expect(player.checkLoginLockout('user1').locked).toBe(false);
  });

  test('cleanupLoginAttempts removes expired', () => {
    for (let i = 0; i < 5; i++) player.recordFailedAttempt('user1');
    expect(player.checkLoginLockout('user1').locked).toBe(true);
    player.cleanupLoginAttempts();
    // lockedUntil is in the future so should still be locked
    expect(player.checkLoginLockout('user1').locked).toBe(true);
  });
});

describe('hashPassword / verifyPassword', () => {
  test('hashPassword produces salt:hash format', () => {
    const hashed = player.hashPassword('mypassword');
    expect(hashed).toContain(':');
    const [salt, key] = hashed.split(':');
    expect(salt.length).toBe(32);
    expect(key.length).toBe(128);
  });

  test('verifyPassword returns true for correct password', () => {
    const hashed = player.hashPassword('mypassword');
    expect(player.verifyPassword('mypassword', hashed)).toBe(true);
  });

  test('verifyPassword returns false for wrong password', () => {
    const hashed = player.hashPassword('mypassword');
    expect(player.verifyPassword('wrongpassword', hashed)).toBe(false);
  });

  test('verifyPassword returns false for malformed stored hash', () => {
    expect(player.verifyPassword('pw', 'invalid')).toBe(false);
  });
});

describe('registerPlayer', () => {
  test('registers a player with password', async () => {
    mockCreateUser.mockResolvedValue(undefined);
    mockSaveToken.mockResolvedValue(undefined);
    const result = await player.registerPlayer('testuser', 'strongpassword123');
    expect(result.playerId).toBe('00000000-0000-0000-0000-000000000000');
    expect(result.isRegistered).toBe(true);
    expect(result.displayName).toBe('testuser');
    expect(mockCreateUser).toHaveBeenCalled();
    expect(mockSaveToken).toHaveBeenCalled();
    expect(player.players.has(result.playerId)).toBe(true);
  });

  test('registers a guest player without password', async () => {
    mockCreateUser.mockResolvedValue(undefined);
    mockSaveToken.mockResolvedValue(undefined);
    const result = await player.registerPlayer('guest');
    expect(result.isRegistered).toBe(false);
  });
});

describe('loginPlayer', () => {
  test('logs in with valid credentials', async () => {
    const hashed = player.hashPassword('mypassword');
    mockGetUserByUsername.mockResolvedValue({ id: 'p1', username: 'u1', password_hash: hashed, display_name: 'U1' });
    mockSaveToken.mockResolvedValue(undefined);
    const result = await player.loginPlayer('u1', 'mypassword');
    expect(result).toHaveProperty('success', true);
    expect((result as { success: boolean; playerId: string }).playerId).toBe('p1');
  });

  test('returns error for invalid username', async () => {
    mockGetUserByUsername.mockResolvedValue(null);
    const result = await player.loginPlayer('unknown', 'pw');
    expect(result).toEqual({ success: false, error: 'Invalid username or password' });
  });

  test('returns error for wrong password', async () => {
    mockGetUserByUsername.mockResolvedValue({
      id: 'p1',
      username: 'u1',
      password_hash: player.hashPassword('correct'),
      display_name: 'U1',
    });
    const result = await player.loginPlayer('u1', 'wrong');
    expect(result).toEqual({ success: false, error: 'Invalid username or password' });
  });
});

describe('authenticatePlayer', () => {
  test('returns player for valid token', () => {
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: ['tok1'], isRegistered: true });
    player.tokenIndex.set('tok1', 'p1');
    player.tokenExpiry.set('tok1', Date.now() + 3600000);
    const p = player.authenticatePlayer('tok1');
    expect(p).not.toBeNull();
    expect(p!.id).toBe('p1');
  });

  test('returns null for expired token', () => {
    player.tokenExpiry.set('tok1', Date.now() - 1000);
    player.tokenIndex.set('tok1', 'p1');
    expect(player.authenticatePlayer('tok1')).toBeNull();
  });

  test('returns null for non-existent token', () => {
    expect(player.authenticatePlayer('nonexistent')).toBeNull();
  });
});

describe('addToken', () => {
  test('adds token to existing player', () => {
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    const token = player.addToken('p1');
    expect(token).toBe('00000000-0000-0000-0000-000000000000');
    expect(player.players.get('p1')!.tokens).toContain(token);
  });

  test('returns null for non-existent player', () => {
    expect(player.addToken('nonexistent')).toBeNull();
  });
});

describe('logoutPlayer', () => {
  test('removes token and cleans up', async () => {
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: ['tok1'], isRegistered: true });
    player.tokenIndex.set('tok1', 'p1');
    player.tokenExpiry.set('tok1', Date.now() + 3600000);
    mockDeleteToken.mockResolvedValue(undefined);
    const result = await player.logoutPlayer('tok1');
    expect(result).toBe(true);
    expect(player.tokenIndex.has('tok1')).toBe(false);
    expect(player.players.get('p1')!.tokens).not.toContain('tok1');
  });

  test('returns false for unknown token', async () => {
    expect(await player.logoutPlayer('unknown')).toBe(false);
  });
});

describe('updateDisplayName', () => {
  test('updates display name for registered player', async () => {
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'Old', tokens: [], isRegistered: true });
    mockUpdateUserDisplayName.mockResolvedValue(undefined);
    const result = await player.updateDisplayName('p1', 'NewName');
    expect(result).toEqual({ success: true });
    expect(player.players.get('p1')!.displayName).toBe('NewName');
    expect(mockUpdateUserDisplayName).toHaveBeenCalledWith('p1', 'NewName');
  });

  test('returns error for non-existent player', async () => {
    const result = await player.updateDisplayName('nonexistent', 'Name');
    expect(result).toEqual({ success: false, error: 'Player not found' });
  });
});

describe('changePassword', () => {
  test('changes password successfully', async () => {
    const oldHash = player.hashPassword('oldpass');
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    mockGetUserById.mockResolvedValue({ password_hash: oldHash });
    mockUpdateUserPasswordHash.mockResolvedValue(undefined);
    const result = await player.changePassword('p1', 'oldpass', 'newlongpassword');
    expect(result).toEqual({ success: true });
  });

  test('rejects unregistered player', async () => {
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: false });
    const result = await player.changePassword('p1', 'old', 'new');
    expect(result).toEqual({ success: false, error: 'Only registered users can change password' });
  });
});

describe('deleteAccount', () => {
  test('deletes account for registered player', async () => {
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: ['tok1'], isRegistered: true });
    player.tokenIndex.set('tok1', 'p1');
    player.tokenExpiry.set('tok1', Date.now() + 3600000);
    mockTransaction.mockImplementation(async (cb: (client: { query: jest.Mock }) => Promise<void>) => {
      await cb({ query: jest.fn().mockResolvedValue(undefined) });
    });
    const result = await player.deleteAccount('p1');
    expect(result).toEqual({ success: true });
    expect(player.players.has('p1')).toBe(false);
  });

  test('rejects unregistered player', async () => {
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: false });
    const result = await player.deleteAccount('p1');
    expect(result).toEqual({ success: false, error: 'Only registered users can delete their account' });
  });
});

describe('setPlayerIp / getPlayerIp', () => {
  test('round-trip', () => {
    player.setPlayerIp('p1', '1.2.3.4');
    expect(player.getPlayerIp('p1')).toBe('1.2.3.4');
  });

  test('getPlayerIp returns undefined for unknown', () => {
    expect(player.getPlayerIp('unknown')).toBeUndefined();
  });
});

describe('getPlayerById / getAllPlayers', () => {
  test('getPlayerById returns player', () => {
    player.players.set('p1', { id: 'p1', username: 'u1', displayName: 'U1', tokens: [], isRegistered: true });
    expect(player.getPlayerById('p1')?.username).toBe('u1');
  });

  test('getAllPlayers returns all players', () => {
    player.players.set('p1', { id: 'p1', username: '', displayName: '', tokens: [], isRegistered: false });
    player.players.set('p2', { id: 'p2', username: '', displayName: '', tokens: [], isRegistered: false });
    expect(player.getAllPlayers()).toHaveLength(2);
  });
});

describe('loadPersistedUsers', () => {
  test('loads users and tokens from DB', async () => {
    mockLoadAllUsers.mockResolvedValue([
      { id: 'p1', username: 'u1', display_name: 'U1' },
      { id: 'p2', username: 'u2', display_name: 'U2' },
    ]);
    mockLoadAllTokens.mockResolvedValue([
      { token: 'tok1', user_id: 'p1' },
      { token: 'tok2', user_id: 'p2' },
    ]);
    await player.loadPersistedUsers();
    expect(player.players.size).toBe(2);
    expect(player.tokenIndex.get('tok1')).toBe('p1');
  });
});
