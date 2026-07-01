import { describe, test, expect, beforeAll } from '@jest/globals';
import * as db from '../src/db.js';

/* Helper: create a test user and return its ID */
async function makeUser(tag: string): Promise<string> {
  const id = 'db-test-' + tag + '-' + Date.now();
  const username = tag + '_' + id + '_user';
  await db.createUser(id, username, null, tag + ' Display');
  return id;
}

describe('db — users', () => {
  test('createUser and getUserById round-trip', async () => {
    const id = await makeUser('roundtrip');
    const user = await db.getUserById(id);
    expect(user).toBeDefined();
    expect(user!.username).toMatch(/^roundtrip_/);
    expect(user!.display_name).toBe('roundtrip Display');
  });

  test('getUserByUsername returns correct user', async () => {
    const id = 'db-test-byusername-' + Date.now();
    const username = 'byusername_' + id + '_user';
    await db.createUser(id, username, null, 'byusername Display');
    const user = await db.getUserByUsername(username);
    expect(user).toBeDefined();
    expect(user!.id).toBe(id);
  });

  test('getUserById returns undefined for non-existent', async () => {
    expect(await db.getUserById('no-such-id')).toBeUndefined();
  });

  test('getUsersByIds batch loads users', async () => {
    const id1 = await makeUser('batch1');
    const id2 = await makeUser('batch2');
    const map = await db.getUsersByIds([id1, id2, 'nonexistent']);
    expect(map.size).toBe(2);
    expect(map.get(id1)).toBeDefined();
    expect(map.get(id2)).toBeDefined();
    expect(map.has('nonexistent')).toBe(false);
  });

  test('updateUserDisplayName changes display name', async () => {
    const id = await makeUser('dispname');
    await db.updateUserDisplayName(id, 'New Display');
    const user = await db.getUserById(id);
    expect(user!.display_name).toBe('New Display');
  });

  test('updateUsername changes username', async () => {
    const id = await makeUser('rename');
    await db.updateUsername(id, 'renamed_user');
    const user = await db.getUserById(id);
    expect(user!.username).toBe('renamed_user');
  });

  test('updateUserAvatar sets avatar URL', async () => {
    const id = await makeUser('avatar');
    await db.updateUserAvatar(id, '/avatars/test.png');
    const user = await db.getUserById(id);
    expect(user!.avatar_url).toBe('/avatars/test.png');
  });

  test('updateUserAvatar clears avatar URL', async () => {
    const id = await makeUser('avatarclr');
    await db.updateUserAvatar(id, '/avatars/test.png');
    await db.updateUserAvatar(id, null);
    const user = await db.getUserById(id);
    expect(user!.avatar_url).toBeNull();
  });

  test('updateUserPasswordHash sets password hash', async () => {
    const id = await makeUser('password');
    await db.updateUserPasswordHash(id, 'abc123hash');
    const user = await db.getUserById(id);
    expect(user!.password_hash).toBe('abc123hash');
  });

  test('deleteUserRecord removes user', async () => {
    const id = await makeUser('delete');
    await db.deleteUserRecord(id);
    expect(await db.getUserById(id)).toBeUndefined();
  });

  test('deleteUserTokens removes all tokens for user', async () => {
    const id = await makeUser('deltok');
    await db.saveToken('token-1', id);
    await db.saveToken('token-2', id);
    await db.deleteUserTokens(id);
    expect(await db.getUserIdByToken('token-1')).toBeUndefined();
    expect(await db.getUserIdByToken('token-2')).toBeUndefined();
  });
});

describe('db — tokens', () => {
  test('saveToken and getUserIdByToken round-trip', async () => {
    const id = await makeUser('tokenrt');
    await db.saveToken('test-token-val', id);
    expect(await db.getUserIdByToken('test-token-val')).toBe(id);
  });

  test('deleteToken removes token', async () => {
    const id = await makeUser('tokendel');
    await db.saveToken('del-token', id);
    await db.deleteToken('del-token');
    expect(await db.getUserIdByToken('del-token')).toBeUndefined();
  });

  test('cleanupExpiredTokens removes old tokens', async () => {
    const id = await makeUser('tokenclean');
    await db.saveToken('old-token', id);
    /* Wait briefly so the token's created_at is in the past */
    await new Promise((r) => setTimeout(r, 10));
    const removed = await db.cleanupExpiredTokens(0);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await db.getUserIdByToken('old-token')).toBeUndefined();
  });
});

describe('db — bans', () => {
  test('saveBan and loadAllBans round-trip', async () => {
    await db.saveBan('ban-1', 'player-1', null);
    await db.saveBan('ban-2', null, '1.2.3.4');
    const bans = await db.loadAllBans();
    expect(bans.some((b) => b.id === 'ban-1')).toBe(true);
    expect(bans.some((b) => b.id === 'ban-2')).toBe(true);
  });

  test('deleteBanById removes ban', async () => {
    await db.saveBan('ban-del', 'player-del', null);
    await db.deleteBanById('ban-del');
    const bans = await db.loadAllBans();
    expect(bans.some((b) => b.id === 'ban-del')).toBe(false);
  });
});

describe('db — stats', () => {
  test('addWin / addLoss / addDraw update user table', async () => {
    const id = await makeUser('stats');
    await db.addWin(id);
    await db.addLoss(id);
    await db.addDraw(id);
    const user = await db.getUserById(id);
    expect(user!.wins).toBe(1);
    expect(user!.losses).toBe(1);
    expect(user!.draws).toBe(1);
  });

  test('updatePlayerRating sets rating', async () => {
    const id = await makeUser('rating');
    await db.updatePlayerRating(id, 1500);
    const rating = await db.getPlayerRating(id);
    expect(rating).toBe(1500);
  });

  test('updateWinLossDraw handles win/loss/draw', async () => {
    const id = await makeUser('wld');
    await db.updateWinLossDraw(id, 'win');
    await db.updateWinLossDraw(id, 'loss');
    await db.updateWinLossDraw(id, 'draw');
    const user = await db.getUserById(id);
    expect(user!.wins).toBeGreaterThanOrEqual(1);
    expect(user!.losses).toBeGreaterThanOrEqual(1);
    expect(user!.draws).toBeGreaterThanOrEqual(1);
  });

  test('updateUserStats sets exact values', async () => {
    const id = await makeUser('exact');
    await db.updateUserStats(id, 5, 3, 1);
    const user = await db.getUserById(id);
    expect(user!.wins).toBe(5);
    expect(user!.losses).toBe(3);
    expect(user!.draws).toBe(1);
  });

  test('getPlayerWinLossDraw counts from completed_games', async () => {
    const w = await makeUser('pwl_w');
    const b = await makeUser('pwl_b');
    await db.saveCompletedGame('pwl-game-1', w, b, 'W', 'B', 'white', 'resign', '1-0', null, 'e4', '', null, 'blitz');
    const stats = await db.getPlayerWinLossDraw(w);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
  });
});

describe('db — friends', () => {
  test('createFriendRequest and getFriendRequest', async () => {
    const from = await makeUser('freq_from');
    const to = await makeUser('freq_to');
    const reqId = await db.createFriendRequest(from, to);
    const req = await db.getFriendRequest(reqId);
    expect(req).toBeDefined();
    expect(req!.from_user_id).toBe(from);
    expect(req!.to_user_id).toBe(to);
  });

  test('hasPendingRequest detects existing request', async () => {
    const from = await makeUser('pend_from');
    const to = await makeUser('pend_to');
    await db.createFriendRequest(from, to);
    expect(await db.hasPendingRequest(from, to)).toBe(true);
    /* hasPendingRequest checks both directions */
    expect(await db.hasPendingRequest(to, from)).toBe(true);
  });

  test('addFriendRelationship and getFriendIds', async () => {
    const a = await makeUser('friend_a');
    const b = await makeUser('friend_b');
    await db.addFriendRelationship(a, b);
    const friends = await db.getFriendIds(a);
    expect(friends).toContain(b);
  });

  test('removeFriendRelationship removes friend', async () => {
    const a = await makeUser('unfr_a');
    const b = await makeUser('unfr_b');
    await db.addFriendRelationship(a, b);
    await db.removeFriendRelationship(a, b);
    const friends = await db.getFriendIds(a);
    expect(friends).not.toContain(b);
  });

  test('areFriends returns true for friends', async () => {
    const a = await makeUser('aref_a');
    const b = await makeUser('aref_b');
    await db.addFriendRelationship(a, b);
    expect(await db.areFriends(a, b)).toBe(true);
    expect(await db.areFriends(b, a)).toBe(true);
    const aref_c = await makeUser('aref_c');
    expect(await db.areFriends(a, aref_c)).toBe(false);
  });

  test('getFriendStatus returns correct statuses', async () => {
    const a = await makeUser('fstat_a');
    const b = await makeUser('fstat_b');
    const c = await makeUser('fstat_c');
    await db.addFriendRelationship(a, b);
    expect(await db.getFriendStatus(a, b)).toBe('friends');
    expect(await db.getFriendStatus(b, c)).toBe('none');
    await db.createFriendRequest(c, a);
    expect(await db.getFriendStatus(a, c)).toBe('incoming');
    expect(await db.getFriendStatus(c, a)).toBe('outgoing');
  });
});

describe('db — completed games', () => {
  test('saveCompletedGame and getArchivedGames', async () => {
    const w = await makeUser('arch_w');
    const b = await makeUser('arch_b');
    await db.saveCompletedGame(
      'game-arch-1',
      w,
      b,
      'White Display',
      'Black Display',
      'white',
      'resign',
      '1-0',
      null,
      'e4 e5',
      '',
      null,
      'blitz',
    );
    const games = await db.getArchivedGames(1, 10);
    expect(games.rows.length).toBeGreaterThanOrEqual(1);
    expect(games.rows.some((g) => g.id === 'game-arch-1')).toBe(true);
  });

  test('getArchivedGame returns specific game', async () => {
    const w = await makeUser('arch2_w');
    const b = await makeUser('arch2_b');
    await db.saveCompletedGame(
      'game-arch-2',
      w,
      b,
      'White 2',
      'Black 2',
      'black',
      'checkmate',
      '0-1',
      'checkmate',
      'e4 e5',
      '',
      null,
      'blitz',
    );
    const game = await db.getArchivedGame('game-arch-2');
    expect(game).toBeDefined();
    expect(game!.result).toBe('0-1');
  });

  test('deleteArchivedGame removes game', async () => {
    const w = await makeUser('arch3_w');
    const b = await makeUser('arch3_b');
    await db.saveCompletedGame(
      'game-arch-3',
      w,
      b,
      'White 3',
      'Black 3',
      null,
      'draw',
      '½-½',
      null,
      '',
      '',
      null,
      'blitz',
    );
    await db.deleteArchivedGame('game-arch-3');
    expect(await db.getArchivedGame('game-arch-3')).toBeUndefined();
  });
});

describe('db — tournaments', () => {
  test('createTournament and getTournament', async () => {
    const creator = await makeUser('tourn_c');
    const { id } = await db.createTournament('test-tourn', creator, 8, false);
    const t = await db.getTournament(id);
    expect(t).toBeDefined();
    expect(t!.name).toBe('test-tourn');
  });

  test('getPublicTournaments returns public tournaments', async () => {
    const creator = await makeUser('tourn_pub');
    const { id } = await db.createTournament('pub-tourn', creator, 4, false);
    const list = await db.getPublicTournaments();
    expect(list.some((t) => t.id === id)).toBe(true);
  });

  test('addTournamentParticipant and getParticipantCount', async () => {
    const creator = await makeUser('tp_creator');
    const p1 = await makeUser('tp_p1');
    const { id } = await db.createTournament('tp-tourn', creator, 8, false);
    const u1 = await db.getUserById(p1);
    await db.addTournamentParticipant(id, p1, u1!.display_name, 1);
    expect(await db.getParticipantCount(id)).toBe(1);
    expect(await db.isTournamentParticipant(id, p1)).toBe(true);
    expect(await db.isTournamentParticipant(id, 'nobody')).toBe(false);
  });

  test('removeTournamentParticipant removes player', async () => {
    const creator = await makeUser('tp2_creator');
    const p = await makeUser('tp2_p');
    const { id } = await db.createTournament('tp2-tourn', creator, 8, false);
    const up = await db.getUserById(p);
    await db.addTournamentParticipant(id, p, up!.display_name, 1);
    await db.removeTournamentParticipant(id, p);
    expect(await db.isTournamentParticipant(id, p)).toBe(false);
  });

  test('updateTournamentStatus changes status', async () => {
    const creator = await makeUser('tstat_c');
    const { id } = await db.createTournament('tstat-tourn', creator, 4, false);
    await db.updateTournamentStatus(id, 'started');
    const t = await db.getTournament(id);
    expect(t!.status).toBe('started');
  });

  test('deleteTournament removes tournament', async () => {
    const creator = await makeUser('tdel_c');
    const { id } = await db.createTournament('tdel-tourn', creator, 4, false);
    await db.deleteTournament(id);
    expect(await db.getTournament(id)).toBeUndefined();
  });
});

describe('db — migrations and utilities', () => {
  test('getDb returns a database pool', () => {
    const d = db.getDb();
    expect(d).toBeDefined();
    expect(typeof d.query).toBe('function');
  });

  test('loadAllUsers returns all users', async () => {
    const users = await db.loadAllUsers();
    expect(Array.isArray(users)).toBe(true);
  });

  test('leaderboard returns ordered results', async () => {
    const id = await makeUser('lb_user');
    await db.updatePlayerRating(id, 2000);
    const lb = await db.getLeaderboard(10, 0);
    expect(lb.rows.length).toBeGreaterThanOrEqual(1);
  });

  test('setSetting / getSetting round-trip', async () => {
    await db.setSetting('test_key', 'test_value');
    const val = await db.getSetting('test_key');
    expect(val).toBe('test_value');
  });

  test('getSetting returns undefined for missing key', async () => {
    const val = await db.getSetting('no_such_key_' + Date.now());
    expect(val).toBeUndefined();
  });

  test('setSetting overwrites existing value', async () => {
    await db.setSetting('overwrite_key', 'first');
    await db.setSetting('overwrite_key', 'second');
    const val = await db.getSetting('overwrite_key');
    expect(val).toBe('second');
  });

  test('createWarning stores and retrieves warning', async () => {
    const userId = await makeUser('warn_user');
    const wid = 'w-test-' + Date.now();
    await db.createWarning(wid, userId, 'Test warning');
    const pool = db.getDb();
    const { rows } = await pool.query('SELECT * FROM warnings WHERE id = $1', [wid]);
    expect(rows.length).toBe(1);
    expect(rows[0].user_id).toBe(userId);
    expect(rows[0].message).toBe('Test warning');
  });
});
