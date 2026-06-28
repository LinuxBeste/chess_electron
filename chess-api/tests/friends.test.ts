import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockDb = {
  getUserByUsername: jest.fn(),
  areFriends: jest.fn(),
  hasPendingRequest: jest.fn(),
  createFriendRequest: jest.fn(),
  getPendingIncomingRequests: jest.fn(),
  getPendingOutgoingRequests: jest.fn(),
  getUsersByIds: jest.fn(),
  getFriendRequest: jest.fn(),
  updateFriendRequestStatus: jest.fn(),
  addFriendRelationship: jest.fn(),
  removeFriendRelationship: jest.fn(),
  searchUsers: jest.fn(),
};

const mockGame = {
  broadcastFriendRequest: jest.fn(),
  broadcastFriendRequestAccepted: jest.fn(),
  broadcastFriendRequestDeclined: jest.fn(),
  broadcastFriendRemoved: jest.fn(),
  getFriendList: jest.fn(),
  getPlayerById: jest.fn(),
};

const mockLogger = { info: jest.fn(), error: jest.fn() };

jest.unstable_mockModule('../src/db.js', () => mockDb);
jest.unstable_mockModule('../src/game.js', () => mockGame);
jest.unstable_mockModule('../src/logger.js', () => ({ default: mockLogger }));

let authPlayer: any = { id: 'me', username: 'meuser', displayName: 'Me', tokens: ['tok'], isRegistered: true };

jest.unstable_mockModule('../src/routes.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.player = authPlayer;
    next();
  },
  banCheckMiddleware: (_req: any, _res: any, next: any) => next(),
  rateLimitMiddleware: (_req: any, _res: any, next: any) => next(),
}));

const router = (await import('../src/friends.js')).default;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  authPlayer = { id: 'me', username: 'meuser', displayName: 'Me', tokens: ['tok'], isRegistered: true };
});

describe('POST /friends/request', () => {
  test('sends friend request successfully', async () => {
    mockDb.getUserByUsername.mockResolvedValue({ id: 'other', username: 'otheruser' });
    mockDb.areFriends.mockResolvedValue(false);
    mockDb.hasPendingRequest.mockResolvedValue(false);
    mockDb.createFriendRequest.mockResolvedValue('req1');
    const app = createApp();
    const res = await request(app).post('/friends/request').send({ username: 'otheruser' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'req1' });
    expect(mockGame.broadcastFriendRequest).toHaveBeenCalledWith('me', 'other', 'req1');
  });

  test('returns 403 for unregistered player', async () => {
    authPlayer = { id: 'me', username: 'meuser', displayName: 'Me', tokens: ['tok'], isRegistered: false };
    mockDb.getUserByUsername.mockResolvedValue({ id: 'other', username: 'otheruser' });
    const app = createApp();
    const res = await request(app).post('/friends/request').send({ username: 'other' });
    expect(res.status).toBe(403);
  });

  test('returns 400 for invalid username', async () => {
    const app = createApp();
    const res = await request(app).post('/friends/request').send({ username: '' });
    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent user', async () => {
    mockDb.getUserByUsername.mockResolvedValue(null);
    const app = createApp();
    const res = await request(app).post('/friends/request').send({ username: 'nonexistent' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for self-friend', async () => {
    mockDb.getUserByUsername.mockResolvedValue({ id: 'me', username: 'meuser' });
    const app = createApp();
    const res = await request(app).post('/friends/request').send({ username: 'meuser' });
    expect(res.status).toBe(400);
  });

  test('returns 409 if already friends', async () => {
    mockDb.getUserByUsername.mockResolvedValue({ id: 'other', username: 'otheruser' });
    mockDb.areFriends.mockResolvedValue(true);
    const app = createApp();
    const res = await request(app).post('/friends/request').send({ username: 'otheruser' });
    expect(res.status).toBe(409);
  });

  test('returns 409 if request already pending', async () => {
    mockDb.getUserByUsername.mockResolvedValue({ id: 'other', username: 'otheruser' });
    mockDb.areFriends.mockResolvedValue(false);
    mockDb.hasPendingRequest.mockResolvedValue(true);
    const app = createApp();
    const res = await request(app).post('/friends/request').send({ username: 'otheruser' });
    expect(res.status).toBe(409);
  });

  test('returns 500 on DB error', async () => {
    mockDb.getUserByUsername.mockResolvedValue({ id: 'other', username: 'otheruser' });
    mockDb.areFriends.mockResolvedValue(false);
    mockDb.hasPendingRequest.mockResolvedValue(false);
    mockDb.createFriendRequest.mockRejectedValue(new Error('DB error'));
    const app = createApp();
    const res = await request(app).post('/friends/request').send({ username: 'otheruser' });
    expect(res.status).toBe(500);
  });
});

describe('GET /friends/requests', () => {
  test('returns incoming and outgoing requests', async () => {
    mockDb.getPendingIncomingRequests.mockResolvedValue([
      { id: 'r1', from_user_id: 'other', to_user_id: 'me', created_at: 1000 },
    ]);
    mockDb.getPendingOutgoingRequests.mockResolvedValue([]);
    mockDb.getUsersByIds.mockResolvedValue(new Map([['other', { username: 'otheruser', display_name: 'Other' }]]));
    mockGame.getPlayerById.mockReturnValue(null);

    const app = createApp();
    const res = await request(app).get('/friends/requests');
    expect(res.status).toBe(200);
    expect(res.body.incoming).toHaveLength(1);
    expect(res.body.outgoing).toHaveLength(0);
  });
});

describe('POST /friends/requests/:id/accept', () => {
  test('accepts friend request', async () => {
    mockDb.getFriendRequest.mockResolvedValue({ id: 'r1', from_user_id: 'other', to_user_id: 'me', status: 'pending' });
    mockDb.updateFriendRequestStatus.mockResolvedValue(undefined);
    mockDb.addFriendRelationship.mockResolvedValue(undefined);

    const app = createApp();
    const res = await request(app).post('/friends/requests/r1/accept');
    expect(res.status).toBe(200);
    expect(mockGame.broadcastFriendRequestAccepted).toHaveBeenCalledWith('me', 'other');
  });

  test('returns 404 for non-existent request', async () => {
    mockDb.getFriendRequest.mockResolvedValue(null);
    const app = createApp();
    const res = await request(app).post('/friends/requests/r1/accept');
    expect(res.status).toBe(404);
  });

  test('returns 403 for wrong recipient', async () => {
    mockDb.getFriendRequest.mockResolvedValue({ id: 'r1', from_user_id: 'me', to_user_id: 'other', status: 'pending' });
    const app = createApp();
    const res = await request(app).post('/friends/requests/r1/accept');
    expect(res.status).toBe(403);
  });

  test('returns 400 for non-pending request', async () => {
    mockDb.getFriendRequest.mockResolvedValue({
      id: 'r1',
      from_user_id: 'other',
      to_user_id: 'me',
      status: 'declined',
    });
    const app = createApp();
    const res = await request(app).post('/friends/requests/r1/accept');
    expect(res.status).toBe(400);
  });
});

describe('POST /friends/requests/:id/decline', () => {
  test('declines friend request', async () => {
    mockDb.getFriendRequest.mockResolvedValue({ id: 'r1', from_user_id: 'other', to_user_id: 'me', status: 'pending' });
    mockDb.updateFriendRequestStatus.mockResolvedValue(undefined);
    const app = createApp();
    const res = await request(app).post('/friends/requests/r1/decline');
    expect(res.status).toBe(200);
    expect(mockGame.broadcastFriendRequestDeclined).toHaveBeenCalledWith('me', 'other');
  });
});

describe('POST /friends/requests/:id/cancel', () => {
  test('cancels own outgoing request', async () => {
    mockDb.getFriendRequest.mockResolvedValue({ id: 'r1', from_user_id: 'me', to_user_id: 'other', status: 'pending' });
    mockDb.updateFriendRequestStatus.mockResolvedValue(undefined);
    const app = createApp();
    const res = await request(app).post('/friends/requests/r1/cancel');
    expect(res.status).toBe(200);
  });

  test('returns 403 when cancelling others request', async () => {
    mockDb.getFriendRequest.mockResolvedValue({ id: 'r1', from_user_id: 'other', to_user_id: 'me', status: 'pending' });
    const app = createApp();
    const res = await request(app).post('/friends/requests/r1/cancel');
    expect(res.status).toBe(403);
  });
});

describe('DELETE /friends/:friendId', () => {
  test('removes friend', async () => {
    mockDb.areFriends.mockResolvedValue(true);
    mockDb.removeFriendRelationship.mockResolvedValue(undefined);
    const app = createApp();
    const res = await request(app).delete('/friends/other');
    expect(res.status).toBe(200);
    expect(mockGame.broadcastFriendRemoved).toHaveBeenCalledWith('me', 'other');
  });

  test('returns 404 if not friends', async () => {
    mockDb.areFriends.mockResolvedValue(false);
    const app = createApp();
    const res = await request(app).delete('/friends/other');
    expect(res.status).toBe(404);
  });
});

describe('GET /users/search', () => {
  test('searches users', async () => {
    mockDb.searchUsers.mockResolvedValue([{ id: 'u1', username: 'test', display_name: 'Test' }]);
    const app = createApp();
    const res = await request(app).get('/users/search?q=te');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('returns 400 for short query', async () => {
    const app = createApp();
    const res = await request(app).get('/users/search?q=t');
    expect(res.status).toBe(400);
  });
});

describe('GET /friends', () => {
  test('lists friends', async () => {
    mockGame.getFriendList.mockResolvedValue([{ id: 'other', username: 'otheruser', displayName: 'Other' }]);
    const app = createApp();
    const res = await request(app).get('/friends');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
