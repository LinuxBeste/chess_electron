import { describe, test, expect, jest } from '@jest/globals';

const mockIsWeakPassword = jest.fn();

jest.unstable_mockModule('../src/password-strength.js', () => ({
  isWeakPassword: mockIsWeakPassword,
}));

const {
  usernameSchema,
  passwordSchema,
  displayNameSchema,
  squareSchema,
  promotionSchema,
  tournamentNameSchema,
  ipSchema,
  pageSchema,
  limitSchema,
  statsValueSchema,
  friendRequestUsernameSchema,
  joinCodeSchema,
  broadcastMessageSchema,
} = await import('../src/validation.js');

describe('usernameSchema', () => {
  test('accepts valid usernames', () => {
    expect(usernameSchema.safeParse('john_doe').success).toBe(true);
    expect(usernameSchema.safeParse('abc123').success).toBe(true);
    expect(usernameSchema.safeParse('a-b').success).toBe(true);
    expect(usernameSchema.safeParse('xy').success).toBe(true);
    expect(usernameSchema.safeParse('a'.repeat(30)).success).toBe(true);
  });

  test('rejects too-short usernames', () => {
    expect(usernameSchema.safeParse('').success).toBe(false);
  });

  test('rejects too-long usernames', () => {
    expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
  });

  test('rejects usernames with spaces', () => {
    const r = usernameSchema.safeParse('user name');
    expect(r.success).toBe(false);
  });

  test('rejects usernames with special characters', () => {
    expect(usernameSchema.safeParse('user@name').success).toBe(false);
    expect(usernameSchema.safeParse('user!name').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  test('accepts strong password', () => {
    mockIsWeakPassword.mockReturnValue(false);
    const r = passwordSchema.safeParse('correct-horse-battery-staple-42');
    expect(r.success).toBe(true);
  });

  test('rejects short password', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
  });

  test('rejects weak password', () => {
    mockIsWeakPassword.mockReturnValue(true);
    const r = passwordSchema.safeParse('password123');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain('too weak');
  });
});

describe('displayNameSchema', () => {
  test('accepts valid display names', () => {
    expect(displayNameSchema.safeParse('John').success).toBe(true);
    expect(displayNameSchema.safeParse('a'.repeat(50)).success).toBe(true);
  });

  test('rejects empty display name', () => {
    expect(displayNameSchema.safeParse('').success).toBe(false);
  });

  test('rejects too-long display name', () => {
    expect(displayNameSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });
});

describe('squareSchema', () => {
  test('accepts valid squares', () => {
    expect(squareSchema.safeParse('e2').success).toBe(true);
    expect(squareSchema.safeParse('a1').success).toBe(true);
    expect(squareSchema.safeParse('h8').success).toBe(true);
    expect(squareSchema.safeParse('E4').success).toBe(true);
  });

  test('rejects invalid squares', () => {
    expect(squareSchema.safeParse('i2').success).toBe(false);
    expect(squareSchema.safeParse('a9').success).toBe(false);
    expect(squareSchema.safeParse('e22').success).toBe(false);
    expect(squareSchema.safeParse('2e').success).toBe(false);
  });
});

describe('promotionSchema', () => {
  test('accepts valid promotion pieces', () => {
    expect(promotionSchema.safeParse('queen').success).toBe(true);
    expect(promotionSchema.safeParse('rook').success).toBe(true);
    expect(promotionSchema.safeParse('bishop').success).toBe(true);
    expect(promotionSchema.safeParse('knight').success).toBe(true);
  });

  test('accepts undefined (optional)', () => {
    expect(promotionSchema.safeParse(undefined).success).toBe(true);
  });

  test('rejects invalid promotion', () => {
    expect(promotionSchema.safeParse('king').success).toBe(false);
    expect(promotionSchema.safeParse('pawn').success).toBe(false);
  });
});

describe('tournamentNameSchema', () => {
  test('accepts valid names', () => {
    expect(tournamentNameSchema.safeParse('My Tournament').success).toBe(true);
    expect(tournamentNameSchema.safeParse('a'.repeat(100)).success).toBe(true);
  });

  test('rejects too-short names', () => {
    expect(tournamentNameSchema.safeParse('a').success).toBe(false);
  });

  test('rejects too-long names', () => {
    expect(tournamentNameSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });
});

describe('ipSchema', () => {
  test('accepts valid IPv4', () => {
    expect(ipSchema.safeParse('192.168.1.1').success).toBe(true);
    expect(ipSchema.safeParse('0.0.0.0').success).toBe(true);
    expect(ipSchema.safeParse('255.255.255.255').success).toBe(true);
  });

  test('accepts valid IPv6', () => {
    expect(ipSchema.safeParse('::1').success).toBe(true);
    expect(ipSchema.safeParse('2001:db8::ff00:42:8329').success).toBe(true);
  });

  test('rejects invalid IPs', () => {
    expect(ipSchema.safeParse('not-an-ip').success).toBe(false);
    expect(ipSchema.safeParse('').success).toBe(false);
    expect(ipSchema.safeParse('abc.def.ghi.jkl').success).toBe(false);
    expect(ipSchema.safeParse('192.168.1').success).toBe(false);
  });
});

describe('pageSchema', () => {
  test('returns at least 1', () => {
    const schema = pageSchema();
    expect(schema.parse('-5')).toBe(1);
    expect(schema.parse('0')).toBe(1);
  });

  test('parses string numbers', () => {
    const schema = pageSchema();
    expect(schema.parse('3')).toBe(3);
  });

  test('defaults to provided default', () => {
    const schema = pageSchema(2);
    expect(schema.parse(undefined)).toBe(2);
  });
});

describe('limitSchema', () => {
  test('clamps to maxVal', () => {
    const schema = limitSchema(20, 100);
    expect(schema.parse('200')).toBe(100);
  });

  test('clamps to minimum 1', () => {
    const schema = limitSchema(20, 100);
    expect(schema.parse('0')).toBe(1);
    expect(schema.parse('-5')).toBe(1);
  });

  test('parses valid values', () => {
    const schema = limitSchema(20, 100);
    expect(schema.parse('50')).toBe(50);
  });

  test('defaults to provided default', () => {
    const schema = limitSchema(20, 100);
    expect(schema.parse(undefined)).toBe(20);
  });
});

describe('statsValueSchema', () => {
  test('accepts non-negative integers', () => {
    expect(statsValueSchema.safeParse(0).success).toBe(true);
    expect(statsValueSchema.safeParse(42).success).toBe(true);
  });

  test('rejects negative numbers', () => {
    expect(statsValueSchema.safeParse(-1).success).toBe(false);
  });

  test('rejects floats', () => {
    expect(statsValueSchema.safeParse(3.14).success).toBe(false);
  });
});

describe('friendRequestUsernameSchema', () => {
  test('accepts valid usernames', () => {
    expect(friendRequestUsernameSchema.safeParse('john_doe').success).toBe(true);
  });

  test('rejects too short', () => {
    expect(friendRequestUsernameSchema.safeParse('a').success).toBe(false);
  });

  test('rejects too long', () => {
    expect(friendRequestUsernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
  });
});

describe('joinCodeSchema', () => {
  test('uppercases and trims', () => {
    const r = joinCodeSchema.parse('  abc  ');
    expect(r).toBe('ABC');
  });

  test('rejects empty', () => {
    expect(joinCodeSchema.safeParse('').success).toBe(false);
  });

  test('rejects too long', () => {
    expect(joinCodeSchema.safeParse('a'.repeat(21)).success).toBe(false);
  });
});

describe('broadcastMessageSchema', () => {
  test('accepts valid messages', () => {
    expect(broadcastMessageSchema.safeParse('Hello').success).toBe(true);
    expect(broadcastMessageSchema.safeParse('a'.repeat(5000)).success).toBe(true);
  });

  test('rejects empty', () => {
    expect(broadcastMessageSchema.safeParse('').success).toBe(false);
  });

  test('rejects too long', () => {
    expect(broadcastMessageSchema.safeParse('a'.repeat(5001)).success).toBe(false);
  });
});
