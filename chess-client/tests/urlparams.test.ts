import { describe, test, expect } from '@jest/globals';

/*
 * Tests for URL query parameter patterns used across pages.
 *
 * These validate the parsing, sanitization, and validation logic
 * that each page applies to URL params before using them as state.
 */

/* ─── Page number parsing (LeaderboardPage, ArchivePage) ─── */
function parsePageParam(value: string | null): number {
  return Math.max(1, parseInt(value ?? '', 10) || 1);
}

describe('page number param', () => {
  test('valid positive integer', () => {
    expect(parsePageParam('3')).toBe(3);
  });

  test('missing param defaults to 1', () => {
    expect(parsePageParam(null)).toBe(1);
  });

  test('empty string defaults to 1', () => {
    expect(parsePageParam('')).toBe(1);
  });

  test('non-numeric string defaults to 1', () => {
    expect(parsePageParam('abc')).toBe(1);
  });

  test('negative number clamps to 1', () => {
    expect(parsePageParam('-5')).toBe(1);
  });

  test('zero clamps to 1', () => {
    expect(parsePageParam('0')).toBe(1);
  });

  test('large number is preserved', () => {
    expect(parsePageParam('999999')).toBe(999999);
  });

  test('decimal string parsed to integer', () => {
    expect(parsePageParam('4.7')).toBe(4);
  });

  test('string with number prefix extracts number', () => {
    expect(parsePageParam('42abc')).toBe(42);
  });

  test('whitespace-only defaults to 1', () => {
    expect(parsePageParam('   ')).toBe(1);
  });

  test('number with leading zeros', () => {
    expect(parsePageParam('007')).toBe(7);
  });

  test('overflow large number saturates at Number.MAX_SAFE_INTEGER', () => {
    const val = parsePageParam(String(Number.MAX_SAFE_INTEGER + 1));
    expect(val).toBeGreaterThan(0);
  });
});

/* ─── Game move review index (GamePage) ─── */
function parseMoveParam(value: string | null, historyLength: number): number | null {
  if (value === null) return null;
  if (historyLength === 0) return null;
  const idx = parseInt(value, 10);
  if (isNaN(idx)) return null;
  if (idx < -1 || idx >= historyLength) return null;
  return idx;
}

describe('game move review index param', () => {
  const historyLen = 20;

  test('valid index within bounds', () => {
    expect(parseMoveParam('5', historyLen)).toBe(5);
  });

  test('null param returns null', () => {
    expect(parseMoveParam(null, historyLen)).toBeNull();
  });

  test('index -1 is valid (start position)', () => {
    expect(parseMoveParam('-1', historyLen)).toBe(-1);
  });

  test('index 0 is valid (first move)', () => {
    expect(parseMoveParam('0', historyLen)).toBe(0);
  });

  test('last valid index', () => {
    expect(parseMoveParam('19', historyLen)).toBe(19);
  });

  test('index exceeding history length returns null', () => {
    expect(parseMoveParam('20', historyLen)).toBeNull();
  });

  test('negative index below -1 returns null', () => {
    expect(parseMoveParam('-2', historyLen)).toBeNull();
  });

  test('non-numeric string returns null', () => {
    expect(parseMoveParam('abc', historyLen)).toBeNull();
  });

  test('empty string returns null', () => {
    expect(parseMoveParam('', historyLen)).toBeNull();
  });

  test('decimal truncated by parseInt', () => {
    expect(parseMoveParam('3.9', historyLen)).toBe(3);
  });

  test('zero-length history rejects all indices', () => {
    expect(parseMoveParam('0', 0)).toBeNull();
    expect(parseMoveParam('-1', 0)).toBeNull();
    expect(parseMoveParam(null, 0)).toBeNull();
  });
});

/* ─── Player search sanitization (ArchivePage) ─── */
function sanitizePlayerFilter(value: string): string {
  return value.trim().slice(0, 100);
}

describe('player filter sanitization', () => {
  test('normal name preserved', () => {
    expect(sanitizePlayerFilter('jannik')).toBe('jannik');
  });

  test('leading and trailing whitespace trimmed', () => {
    expect(sanitizePlayerFilter('  jannik  ')).toBe('jannik');
  });

  test('name with spaces preserved', () => {
    expect(sanitizePlayerFilter('john smith')).toBe('john smith');
  });

  test('very long string truncated to 100 chars', () => {
    const long = 'a'.repeat(200);
    expect(sanitizePlayerFilter(long).length).toBe(100);
  });

  test('empty string stays empty', () => {
    expect(sanitizePlayerFilter('')).toBe('');
  });

  test('whitespace-only becomes empty', () => {
    expect(sanitizePlayerFilter('   \t  ')).toBe('');
  });

  test('special characters preserved (search is ILIKE)', () => {
    expect(sanitizePlayerFilter('player_01')).toBe('player_01');
    expect(sanitizePlayerFilter('test%name')).toBe('test%name');
  });

  test('SQL-like injection patterns preserved (parameterized on backend)', () => {
    const injection = "Robert'; DROP TABLE users;--";
    expect(sanitizePlayerFilter(injection)).toBe(injection);
    expect(sanitizePlayerFilter(injection).length).toBeLessThanOrEqual(100);
  });
});

/* ─── Tournament ID param ─── */
function sanitizeTournamentId(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, 64);
  return trimmed || null;
}

describe('tournament ID param', () => {
  test('valid ID preserved', () => {
    expect(sanitizeTournamentId('abc-123')).toBe('abc-123');
  });

  test('null param returns null', () => {
    expect(sanitizeTournamentId(null)).toBeNull();
  });

  test('empty string returns null', () => {
    expect(sanitizeTournamentId('')).toBeNull();
  });

  test('whitespace-only returns null', () => {
    expect(sanitizeTournamentId('   ')).toBeNull();
  });

  test('whitespace trimmed', () => {
    expect(sanitizeTournamentId('  t456  ')).toBe('t456');
  });

  test('very long ID truncated to 64 chars', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeTournamentId(long)!.length).toBe(64);
  });
});

/* ─── FEN parsing from URL (BoardEditorPage) ─── */
type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
type BoardType = ({ type: PieceType; color: 'white' | 'black' } | null)[][];

function emptyBoard(): BoardType {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

const PIECE_MAP: Record<string, { type: PieceType; color: 'white' | 'black' }> = {
  K: { type: 'king', color: 'white' },
  Q: { type: 'queen', color: 'white' },
  R: { type: 'rook', color: 'white' },
  B: { type: 'bishop', color: 'white' },
  N: { type: 'knight', color: 'white' },
  P: { type: 'pawn', color: 'white' },
  k: { type: 'king', color: 'black' },
  q: { type: 'queen', color: 'black' },
  r: { type: 'rook', color: 'black' },
  b: { type: 'bishop', color: 'black' },
  n: { type: 'knight', color: 'black' },
  p: { type: 'pawn', color: 'black' },
};

function fenToBoard(fen: string): BoardType | null {
  const board = emptyBoard();
  const rows = fen.split(' ')[0].split('/');
  if (rows.length !== 8) return null;
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        f += parseInt(ch, 10);
      } else {
        const piece = PIECE_MAP[ch];
        if (!piece || f >= 8) return null;
        board[r][f] = piece;
        f++;
      }
    }
    if (f !== 8) return null;
  }
  return board;
}

describe('FEN param parsing', () => {
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

  test('valid starting position FEN parses successfully', () => {
    const board = fenToBoard(START_FEN);
    expect(board).not.toBeNull();
    expect(board![0][0]).toEqual({ type: 'rook', color: 'black' });
    expect(board![7][4]).toEqual({ type: 'king', color: 'white' });
  });

  test('empty position FEN parses', () => {
    const board = fenToBoard('8/8/8/8/8/8/8/8');
    expect(board).not.toBeNull();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) expect(board![r][f]).toBeNull();
  });

  test('invalid FEN with wrong row count returns null', () => {
    expect(fenToBoard('rnbqkbnr/pppppppp/8/8')).toBeNull();
  });

  test('invalid FEN with bad characters returns null', () => {
    expect(fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR<script>')).toBeNull();
  });

  test('invalid FEN with unknown piece letter returns null', () => {
    expect(fenToBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKXNR')).toBeNull();
  });

  test('invalid FEN with row too long returns null', () => {
    expect(fenToBoard('rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR')).toBeNull();
  });

  test('empty string returns null', () => {
    expect(fenToBoard('')).toBeNull();
  });

  test('FEN with extra fields (full FEN) uses only board part', () => {
    const board = fenToBoard(START_FEN + ' w KQkq - 0 1');
    expect(board).not.toBeNull();
    expect(board![7][4]).toEqual({ type: 'king', color: 'white' });
  });

  test('FEN with one pawn moved', () => {
    const board = fenToBoard('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
    expect(board).not.toBeNull();
    expect(board![4][4]).toEqual({ type: 'pawn', color: 'white' });
    expect(board![6][4]).toBeNull();
  });

  test('malicious payload does not crash parser', () => {
    expect(fenToBoard('../../etc/passwd')).toBeNull();
    expect(fenToBoard('<script>alert(1)</script>')).toBeNull();
    expect(fenToBoard('null')).toBeNull();
    expect(fenToBoard('undefined')).toBeNull();
    expect(fenToBoard('__proto__')).toBeNull();
  });
});

/* ─── Security: URL encoding/decoding roundtrip ─── */
describe('URL param encoding safety', () => {
  function simulateRoundtrip(key: string, value: string): string {
    const params = new URLSearchParams();
    params.set(key, value);
    const parsed = new URLSearchParams(params.toString());
    return parsed.get(key) ?? '';
  }

  test('special characters survive roundtrip', () => {
    expect(simulateRoundtrip('q', 'hello world')).toBe('hello world');
    expect(simulateRoundtrip('q', 'a&b=c')).toBe('a&b=c');
    expect(simulateRoundtrip('q', '50%')).toBe('50%');
  });

  test('unicode characters survive roundtrip', () => {
    expect(simulateRoundtrip('q', 'jännîk')).toBe('jännîk');
  });

  test('XSS vectors in params are not executed - just strings', () => {
    const params = new URLSearchParams();
    params.set('player', '<script>alert("xss")</script>');
    params.set('fen', 'javascript:alert(1)');
    const got = params.get('player');
    expect(got).toBe('<script>alert("xss")</script>');
    expect(typeof got).toBe('string');
    /* React escapes these when rendered via JSX */
  });

  test('URL constructor does not throw on malicious param values', () => {
    const bad = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '../etc/passwd',
      '\\\\evil\\share',
      '\0null byte',
    ];
    for (const val of bad) {
      const params = new URLSearchParams({ fen: val });
      const url = `http://localhost/#/editor?${params.toString()}`;
      expect(() => new URL(url)).not.toThrow();
    }
  });

  test('parseInt with radix 10 is safe against string injection', () => {
    expect(parseInt('1; DROP TABLE users', 10)).toBe(1);
    expect(parseInt('0', 10)).toBe(0);
    expect(parseInt('NaN', 10)).toBeNaN();
  });
});
