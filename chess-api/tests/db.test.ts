import { describe, test, expect, beforeAll } from '@jest/globals';
import * as db from '../src/db';

/* Helper: create a test user and return its ID */
function makeUser(tag: string): string {
  const id = 'db-test-' + tag + '-' + Date.now();
  db.createUser(id, tag + '_user', null, tag + ' Display');
  return id;
}

describe('db — users', () => {
  test('createUser and getUserById round-trip', () => {
    const id = makeUser('roundtrip');
    const user = db.getUserById(id);
    expect(user).toBeDefined();
    expect(user!.username).toBe('roundtrip_user');
    expect(user!.display_name).toBe('roundtrip Display');
  });

  test('getUserByUsername returns correct user', () => {
    const id = makeUser('byusername');
    const user = db.getUserByUsername('byusername_user');
    expect(user).toBeDefined();
    expect(user!.id).toBe(id);
  });

  test('getUserById returns undefined for non-existent', () => {
    expect(db.getUserById('no-such-id')).toBeUndefined();
  });

  test('getUsersByIds batch loads users', () => {
    const id1 = makeUser('batch1');
    const id2 = makeUser('batch2');
    const map = db.getUsersByIds([id1, id2, 'nonexistent']);
    expect(map.size).toBe(2);
    expect(map.get(id1)).toBeDefined();
    expect(map.get(id2)).toBeDefined();
    expect(map.has('nonexistent')).toBe(false);
  });

  test('updateUserDisplayName changes display name', () => {
    const id = makeUser('dispname');
    db.updateUserDisplayName(id, 'New Display');
    const user = db.getUserById(id);
    expect(user!.display_name).toBe('New Display');
  });

  test('updateUsername changes username', () => {
    const id = makeUser('rename');
    db.updateUsername(id, 'renamed_user');
    const user = db.getUserById(id);
    expect(user!.username).toBe('renamed_user');
  });

  test('updateUserAvatar sets avatar URL', () => {
    const id = makeUser('avatar');
    db.updateUserAvatar(id, '/avatars/test.png');
    const user = db.getUserById(id);
    expect(user!.avatar_url).toBe('/avatars/test.png');
  });

  test('updateUserAvatar clears avatar URL', () => {
    const id = makeUser('avatarclr');
    db.updateUserAvatar(id, '/avatars/test.png');
    db.updateUserAvatar(id, null);
    const user = db.getUserById(id);
    expect(user!.avatar_url).toBeNull();
  });

  test('updateUserPasswordHash sets password hash', () => {
    const id = makeUser('password');
    db.updateUserPasswordHash(id, 'abc123hash');
    const user = db.getUserById(id);
    expect(user!.password_hash).toBe('abc123hash');
  });

  test('deleteUserRecord removes user', () => {
    const id = makeUser('delete');
    db.deleteUserRecord(id);
    expect(db.getUserById(id)).toBeUndefined();
  });

  test('deleteUserTokens removes all tokens for user', () => {
    const id = makeUser('deltok');
    db.saveToken('token-1', id);
    db.saveToken('token-2', id);
    db.deleteUserTokens(id);
    expect(db.getUserIdByToken('token-1')).toBeUndefined();
    expect(db.getUserIdByToken('token-2')).toBeUndefined();
  });
});

describe('db — tokens', () => {
  test('saveToken and getUserIdByToken round-trip', () => {
    const id = makeUser('tokenrt');
    db.saveToken('test-token-val', id);
    expect(db.getUserIdByToken('test-token-val')).toBe(id);
  });

  test('deleteToken removes token', () => {
    const id = makeUser('tokendel');
    db.saveToken('del-token', id);
    db.deleteToken('del-token');
    expect(db.getUserIdByToken('del-token')).toBeUndefined();
  });

  test('cleanupExpiredTokens removes old tokens', async () => {
    const id = makeUser('tokenclean');
    db.saveToken('old-token', id);
    /* Wait briefly so the token's created_at is in the past */
    await new Promise((r) => setTimeout(r, 10));
    const removed = db.cleanupExpiredTokens(0);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(db.getUserIdByToken('old-token')).toBeUndefined();
  });
});

describe('db — bans', () => {
  test('saveBan and loadAllBans round-trip', () => {
    db.saveBan('ban-1', 'player-1', null);
    db.saveBan('ban-2', null, '1.2.3.4');
    const bans = db.loadAllBans();
    expect(bans.some((b) => b.id === 'ban-1')).toBe(true);
    expect(bans.some((b) => b.id === 'ban-2')).toBe(true);
  });

  test('deleteBanById removes ban', () => {
    db.saveBan('ban-del', 'player-del', null);
    db.deleteBanById('ban-del');
    const bans = db.loadAllBans();
    expect(bans.some((b) => b.id === 'ban-del')).toBe(false);
  });
});

describe('db — stats', () => {
  test('addWin / addLoss / addDraw update user table', () => {
    const id = makeUser('stats');
    db.addWin(id);
    db.addLoss(id);
    db.addDraw(id);
    const user = db.getUserById(id);
    expect(user!.wins).toBe(1);
    expect(user!.losses).toBe(1);
    expect(user!.draws).toBe(1);
  });

  test('updatePlayerRating sets rating', () => {
    const id = makeUser('rating');
    db.updatePlayerRating(id, 1500);
    const rating = db.getPlayerRating(id);
    expect(rating).toBe(1500);
  });

  test('updateWinLossDraw handles win/loss/draw', () => {
    const id = makeUser('wld');
    db.updateWinLossDraw(id, 'win');
    db.updateWinLossDraw(id, 'loss');
    db.updateWinLossDraw(id, 'draw');
    const user = db.getUserById(id);
    expect(user!.wins).toBeGreaterThanOrEqual(1);
    expect(user!.losses).toBeGreaterThanOrEqual(1);
    expect(user!.draws).toBeGreaterThanOrEqual(1);
  });

  test('updateUserStats sets exact values', () => {
    const id = makeUser('exact');
    db.updateUserStats(id, 5, 3, 1);
    const user = db.getUserById(id);
    expect(user!.wins).toBe(5);
    expect(user!.losses).toBe(3);
    expect(user!.draws).toBe(1);
  });

  test('getPlayerWinLossDraw counts from completed_games', () => {
    const w = makeUser('pwl_w');
    const b = makeUser('pwl_b');
    db.saveCompletedGame('pwl-game-1', w, b, 'W', 'B', 'white', 'resign', '1-0', null, 'e4', '', null, 'blitz');
    const stats = db.getPlayerWinLossDraw(w);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(0);
  });
});

describe('db — friends', () => {
  test('createFriendRequest and getFriendRequest', () => {
    const from = makeUser('freq_from');
    const to = makeUser('freq_to');
    const reqId = db.createFriendRequest(from, to);
    const req = db.getFriendRequest(reqId);
    expect(req).toBeDefined();
    expect(req!.from_user_id).toBe(from);
    expect(req!.to_user_id).toBe(to);
  });

  test('hasPendingRequest detects existing request', () => {
    const from = makeUser('pend_from');
    const to = makeUser('pend_to');
    db.createFriendRequest(from, to);
    expect(db.hasPendingRequest(from, to)).toBe(true);
    /* hasPendingRequest checks both directions */
    expect(db.hasPendingRequest(to, from)).toBe(true);
  });

  test('addFriendRelationship and getFriendIds', () => {
    const a = makeUser('friend_a');
    const b = makeUser('friend_b');
    db.addFriendRelationship(a, b);
    const friends = db.getFriendIds(a);
    expect(friends).toContain(b);
  });

  test('removeFriendRelationship removes friend', () => {
    const a = makeUser('unfr_a');
    const b = makeUser('unfr_b');
    db.addFriendRelationship(a, b);
    db.removeFriendRelationship(a, b);
    const friends = db.getFriendIds(a);
    expect(friends).not.toContain(b);
  });

  test('areFriends returns true for friends', () => {
    const a = makeUser('aref_a');
    const b = makeUser('aref_b');
    db.addFriendRelationship(a, b);
    expect(db.areFriends(a, b)).toBe(true);
    expect(db.areFriends(b, a)).toBe(true);
    expect(db.areFriends(a, makeUser('aref_c'))).toBe(false);
  });

  test('getFriendStatus returns correct statuses', () => {
    const a = makeUser('fstat_a');
    const b = makeUser('fstat_b');
    const c = makeUser('fstat_c');
    db.addFriendRelationship(a, b);
    expect(db.getFriendStatus(a, b)).toBe('friends');
    expect(db.getFriendStatus(b, c)).toBe('none');
    db.createFriendRequest(c, a);
    expect(db.getFriendStatus(a, c)).toBe('incoming');
    expect(db.getFriendStatus(c, a)).toBe('outgoing');
  });
});

describe('db — completed games', () => {
  test('saveCompletedGame and getArchivedGames', () => {
    const w = makeUser('arch_w');
    const b = makeUser('arch_b');
    db.saveCompletedGame(
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
    const games = db.getArchivedGames(1, 10);
    expect(games.rows.length).toBeGreaterThanOrEqual(1);
    expect(games.rows.some((g) => g.id === 'game-arch-1')).toBe(true);
  });

  test('getArchivedGame returns specific game', () => {
    const w = makeUser('arch2_w');
    const b = makeUser('arch2_b');
    db.saveCompletedGame(
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
    const game = db.getArchivedGame('game-arch-2');
    expect(game).toBeDefined();
    expect(game!.result).toBe('0-1');
  });

  test('deleteArchivedGame removes game', () => {
    const w = makeUser('arch3_w');
    const b = makeUser('arch3_b');
    db.saveCompletedGame('game-arch-3', w, b, 'White 3', 'Black 3', null, 'draw', '½-½', null, '', '', null, 'blitz');
    db.deleteArchivedGame('game-arch-3');
    expect(db.getArchivedGame('game-arch-3')).toBeUndefined();
  });
});

describe('db — tournaments', () => {
  test('createTournament and getTournament', () => {
    const creator = makeUser('tourn_c');
    const { id } = db.createTournament('test-tourn', creator, 8, false);
    const t = db.getTournament(id);
    expect(t).toBeDefined();
    expect(t!.name).toBe('test-tourn');
  });

  test('getPublicTournaments returns public tournaments', () => {
    const creator = makeUser('tourn_pub');
    const { id } = db.createTournament('pub-tourn', creator, 4, false);
    const list = db.getPublicTournaments();
    expect(list.some((t) => t.id === id)).toBe(true);
  });

  test('addTournamentParticipant and getParticipantCount', () => {
    const creator = makeUser('tp_creator');
    const p1 = makeUser('tp_p1');
    const { id } = db.createTournament('tp-tourn', creator, 8, false);
    const u1 = db.getUserById(p1);
    db.addTournamentParticipant(id, p1, u1!.display_name, 1);
    expect(db.getParticipantCount(id)).toBe(1);
    expect(db.isTournamentParticipant(id, p1)).toBe(true);
    expect(db.isTournamentParticipant(id, 'nobody')).toBe(false);
  });

  test('removeTournamentParticipant removes player', () => {
    const creator = makeUser('tp2_creator');
    const p = makeUser('tp2_p');
    const { id } = db.createTournament('tp2-tourn', creator, 8, false);
    const up = db.getUserById(p);
    db.addTournamentParticipant(id, p, up!.display_name, 1);
    db.removeTournamentParticipant(id, p);
    expect(db.isTournamentParticipant(id, p)).toBe(false);
  });

  test('updateTournamentStatus changes status', () => {
    const creator = makeUser('tstat_c');
    const { id } = db.createTournament('tstat-tourn', creator, 4, false);
    db.updateTournamentStatus(id, 'started');
    const t = db.getTournament(id);
    expect(t!.status).toBe('started');
  });

  test('deleteTournament removes tournament', () => {
    const creator = makeUser('tdel_c');
    const { id } = db.createTournament('tdel-tourn', creator, 4, false);
    db.deleteTournament(id);
    expect(db.getTournament(id)).toBeUndefined();
  });
});

describe('db — migrations and utilities', () => {
  test('getDb returns a database instance', () => {
    const d = db.getDb();
    expect(d).toBeDefined();
    expect(typeof d.prepare).toBe('function');
  });

  test('loadAllUsers returns all users', () => {
    const users = db.loadAllUsers();
    expect(Array.isArray(users)).toBe(true);
  });

  test('leaderboard returns ordered results', () => {
    const id = makeUser('lb_user');
    db.updatePlayerRating(id, 2000);
    const lb = db.getLeaderboard(10, 0);
    expect(lb.rows.length).toBeGreaterThanOrEqual(1);
  });
});
