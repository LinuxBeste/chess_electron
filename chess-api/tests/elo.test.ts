import { describe, test, expect, jest, beforeEach } from '@jest/globals';

const mockClientQuery = jest.fn();
const mockTransaction = jest.fn(async (fn: (client: unknown) => Promise<void>) => {
  await fn({ query: mockClientQuery });
});
const mockLoggerInfo = jest.fn();

jest.unstable_mockModule('../src/db.js', () => ({
  transaction: mockTransaction,
}));

jest.unstable_mockModule('../src/logger.js', () => ({
  default: { info: mockLoggerInfo },
}));

const { updateEloRatings, calculateElo } = await import('../src/elo.js');

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    board: [],
    turn: 'white' as const,
    status: 'checkmate' as const,
    players: { white: 'p1', black: 'p2' },
    moveHistory: [],
    boardHistory: [],
    enPassantTarget: null,
    castlingRights: { white: { kingside: true, queenside: true }, black: { kingside: true, queenside: true } },
    lastMove: null,
    winner: null,
    createdAt: Date.now(),
    visibility: 'public' as const,
    spectateMode: 'public' as const,
    halfMoveClock: 0,
    rated: true,
    ...overrides,
  } as const;
}

describe('calculateElo', () => {
  test('equal ratings draw: both stay same', () => {
    const [a, b] = calculateElo(1500, 1500, 0.5);
    expect(a).toBe(1500);
    expect(b).toBe(1500);
  });

  test('higher-rated player wins: higher gains move rating further apart', () => {
    const [a, b] = calculateElo(1600, 1400, 1);
    expect(a).toBeGreaterThan(1600);
    expect(b).toBeLessThan(1400);
    expect(a - 1600 + b - 1400).toBe(0);
  });

  test('lower-rated player wins (upset): gains more points than higher-rated would for a win', () => {
    const [upsetWinner, upsetLoser] = calculateElo(1400, 1600, 1);
    expect(upsetWinner).toBeGreaterThan(1400);
    expect(upsetLoser).toBeLessThan(1600);
    const [highWinner, highLoser] = calculateElo(1600, 1400, 1);
    expect(upsetWinner - 1400).toBeGreaterThan(highWinner - 1600);
  });

  test('draw: both move toward each other', () => {
    const [a, b] = calculateElo(1600, 1400, 0.5);
    expect(a).toBeLessThan(1600);
    expect(b).toBeGreaterThan(1400);
  });

  test('extreme rating difference: higher-rated gains near 0', () => {
    const [a, b] = calculateElo(2000, 800, 1);
    expect(a - 2000).toBeLessThanOrEqual(1);
    expect(a - 2000 + b - 800).toBe(0);
  });

  test('rounding to integer', () => {
    const [a, b] = calculateElo(1500, 1501, 0.5);
    expect(Number.isInteger(a)).toBe(true);
    expect(Number.isInteger(b)).toBe(true);
  });
});

describe('updateEloRatings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('updates ratings when white wins', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ rating: 1500 }] })
      .mockResolvedValueOnce({ rows: [{ rating: 1400 }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    await updateEloRatings(makeGame({ winner: 'white' }), 'white');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledTimes(4);
  });

  test('updates ratings when black wins', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ rating: 1500 }] })
      .mockResolvedValueOnce({ rows: [{ rating: 1400 }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    await updateEloRatings(makeGame({ winner: 'black' }), 'black');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledTimes(4);
  });

  test('updates ratings for draw', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ rating: 1500 }] })
      .mockResolvedValueOnce({ rows: [{ rating: 1500 }] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    await updateEloRatings(makeGame({ winner: null }), null);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledTimes(4);
  });

  test('returns early when players missing', async () => {
    await updateEloRatings(makeGame({ players: {} }), null);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  test('returns early when user not found in DB', async () => {
    mockClientQuery.mockResolvedValueOnce({ rows: [{ rating: 1500 }] }).mockResolvedValueOnce({ rows: [] });
    await updateEloRatings(makeGame(), 'white');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledTimes(2);
    expect(mockClientQuery.mock.calls[0][0]).toContain('FOR UPDATE');
  });
});
