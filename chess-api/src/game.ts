import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { Player, GameState, Color, PieceType } from './types';
import type { GameStatus } from './types';
import * as chess from './chess';
import * as db from './db';
import { engineManager } from './engine';
import logger from './logger';

/* In-memory data stores.  Everything resets on process restart — there is
 * no database or persistent storage.  Three data structures:
 *
 *   games:        gameId → GameState
 *   players:      playerId → Player (with token list)
 *   tokenIndex:   bearerToken → playerId (reverse lookup for fast auth)
 *   wsConnections: playerId → Set<WebSocket> (multi-tab support) */
const games = new Map<string, GameState>();
const players = new Map<string, Player>();

/* UCI move history for engine use (string[] per game) */
const uciHistory = new Map<string, string[]>();

/* Bearer-token reverse index: maps each token directly to its owner.
 * Without this we'd have to iterate every player's token array on every
 * authenticated request — O(n) instead of O(1). */
const tokenIndex = new Map<string, string>();

/**
 * Attach player display names to a GameState before returning it to clients.
 * The core domain model stores only IDs; this enriches the response so the
 * UI can show usernames without extra API calls.  Registered players use
 * their displayName (which may differ from their login username).
 */
function enrichNames(g: GameState): GameState {
  const whitePlayer = g.players.white ? players.get(g.players.white) : undefined;
  const blackPlayer = g.players.black ? players.get(g.players.black) : undefined;

  let whiteAvatarUrl: string | undefined;
  let blackAvatarUrl: string | undefined;
  if (whitePlayer?.isRegistered) {
    const user = db.getUserById(whitePlayer.id);
    if (user?.avatar_url) whiteAvatarUrl = user.avatar_url;
  }
  if (blackPlayer?.isRegistered) {
    const user = db.getUserById(blackPlayer.id);
    if (user?.avatar_url) blackAvatarUrl = user.avatar_url;
  }

  return {
    ...g,
    whiteName: whitePlayer?.displayName ?? whitePlayer?.username ?? g.whiteName,
    blackName: blackPlayer?.displayName ?? blackPlayer?.username ?? g.blackName,
    whiteAvatarUrl,
    blackAvatarUrl,
  };
}

export const BOT_PLAYER_ID = '_bot_';

/* Env-driven limits with defaults */
const MAX_GAMES_PER_PLAYER = parseInt(process.env.MAX_GAMES_PER_PLAYER ?? '20', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10);

/* Waiting-game TTL: orphaned waiting games older than this are swept.
 * Default 10 minutes, overridable via env.  Set to 0 to disable. */
const WAITING_TTL_MS = parseInt(process.env.WAITING_TTL_MS ?? String(10 * 60 * 1000), 10);

/* Interval handle for the periodic waiting-game sweep (started on module load) */
let sweepTimer: ReturnType<typeof setInterval> | null = null;

/* WebSocket connections per player.  Using a Set allows a player to have
 * multiple simultaneous connections (e.g., browser tabs on different
 * devices) while broadcasting game events to all of them. */
const wsConnections = new Map<string, Set<WebSocket>>();

/* Spectator WebSocket connections per game. Non-players can watch active games. */
const spectatorConnections = new Map<string, Set<WebSocket>>();

/* Track playerId → IP address for ban enforcement. Updated on auth/WS connect. */
const playerIps = new Map<string, string>();

/* Banned players (IDs) and IPs — enforced by authMiddleware. */
const bannedPlayers = new Set<string>();
const bannedIps = new Set<string>();

/* Tracks active draw offers: gameId → playerId of the player who offered.
 * Offers are cleared when the opponent declines, the offering player cancels,
 * or any move is made. */
const drawOffers = new Map<string, string>();

/**
 * Register a player.
 *
 * Two modes:
 *   1. Anonymous (no password) — in-memory only, no DB record.
 *      Generates UUIDs for player ID and bearer token. Username is used
 *      as display name and can be a duplicate.
 *   2. Registered (with password) — persisted to SQLite. Username must be
 *      unique across all registered users. Password is hashed with PBKDF2.
 *
 * Returns { playerId, token, isRegistered } so the client knows the type.
 */
export function registerPlayer(
  username: string,
  password?: string,
): { playerId: string; token: string; isRegistered: boolean; displayName: string } {
  const playerId = uuidv4();
  const token = uuidv4();

  const isRegistered = !!password;
  if (password) {
    const hash = hashPassword(password);
    db.createUser(playerId, username, hash, username);
    db.saveToken(token, playerId);
    const player: Player = { id: playerId, username, displayName: username, tokens: [token], isRegistered: true };
    players.set(playerId, player);
    tokenIndex.set(token, playerId);
  } else {
    const player: Player = { id: playerId, username, displayName: username, tokens: [token], isRegistered: false };
    players.set(playerId, player);
    tokenIndex.set(token, playerId);
  }
  logger.info('Player registered: playerId=' + playerId + ' username="' + username + '" registered=' + isRegistered);
  return { playerId, token, isRegistered, displayName: username };
}

/**
 * Log in an existing registered user by verifying their password.
 * Generates a new session token on each login (multi-device friendly).
 */
export function loginPlayer(
  username: string,
  password: string,
): { success: false; error: string } | { success: true; playerId: string; token: string; displayName: string } {
  const user = db.getUserByUsername(username);
  if (!user || !user.password_hash) {
    return { success: false, error: 'Invalid username or password' };
  }
  if (!verifyPassword(password, user.password_hash)) {
    return { success: false, error: 'Invalid username or password' };
  }

  const token = uuidv4();
  db.saveToken(token, user.id);

  const existing = players.get(user.id);
  if (existing) {
    existing.tokens.push(token);
    tokenIndex.set(token, user.id);
  } else {
    const player: Player = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      tokens: [token],
      isRegistered: true,
    };
    players.set(user.id, player);
    tokenIndex.set(token, user.id);
  }

  logger.info('Player login: playerId=' + user.id + ' username="' + user.username + '"');
  return { success: true, playerId: user.id, token, displayName: user.display_name };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${key}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return key === check;
}

/**
 * Authenticate a bearer token.
 *
 * Uses the reverse index (tokenIndex) for O(1) lookup instead of scanning
 * all players.  Returns null if the token is unknown or the player was
 * deleted (shouldn't happen in normal operation).
 */
export function authenticatePlayer(token: string): Player | null {
  const playerId = tokenIndex.get(token);
  if (!playerId) {
    logger.info('Auth failed: token not found');
    return null;
  }
  const player = players.get(playerId) ?? null;
  if (player) {
    logger.info('Auth ok: playerId=' + playerId + ' username=' + player.username);
  } else {
    logger.info('Auth failed: playerId=' + playerId + ' not in memory');
  }
  return player;
}

/**
 * Issue an additional bearer token for an existing player.
 *
 * Useful when the same player wants to authenticate from a second device
 * without invalidating the first session.  Each token independently
 * authorizes the player.
 */
export function addToken(playerId: string): string | null {
  const player = players.get(playerId);
  if (!player) {
    logger.info('addToken: player not found playerId=' + playerId);
    return null;
  }
  const token = uuidv4();
  player.tokens.push(token);
  tokenIndex.set(token, playerId);
  logger.info('Token added: playerId=' + playerId);
  return token;
}

/**
 * Associate a WebSocket connection with a player.
 *
 * Multiple connections per player are supported (Set semantics) so that
 * a player can have the game open in several browser tabs and receive
 * real-time updates in all of them.
 */
export function registerWSConnection(playerId: string, ws: WebSocket): void {
  const wasOffline = !wsConnections.has(playerId) || wsConnections.get(playerId)!.size === 0;
  if (!wsConnections.has(playerId)) {
    wsConnections.set(playerId, new Set());
  }
  wsConnections.get(playerId)!.add(ws);
  if (wasOffline) {
    notifyFriendsOnline(playerId);
  }
  logger.info('WS connected: playerId=' + playerId);
}

/**
 * Remove a WebSocket connection when it closes or errors.
 *
 * Must be called to prevent memory leaks.  Bound to the 'close' event
 * on each WebSocket in index.ts.
 */
export function removeWSConnection(playerId: string, ws: WebSocket): void {
  wsConnections.get(playerId)?.delete(ws);
  const isNowOffline = !wsConnections.has(playerId) || wsConnections.get(playerId)!.size === 0;
  if (isNowOffline && players.has(playerId)) {
    notifyFriendsOffline(playerId);
  }
  logger.info('WS disconnected: playerId=' + playerId);
}

/**
 * Clean up any waiting games created by a player who just disconnected.
 * If the player has no more open WS connections (all tabs closed), remove
 * every game they created that is still in 'waiting' status so the server
 * doesn't accumulate orphaned open games.
 */
export function cleanupPlayerWaitingGames(playerId: string): void {
  const conns = wsConnections.get(playerId);
  if (conns && conns.size > 0) return; /* still connected elsewhere */

  const toDelete: string[] = [];
  for (const [id, g] of games) {
    if (g.status === 'waiting' && g.players.white === playerId) {
      toDelete.push(id);
    }
  }
  for (const id of toDelete) {
    games.delete(id);
  }
  if (toDelete.length > 0) {
    logger.info('Cleaned up waiting games: playerId=' + playerId + ' count=' + toDelete.length);
  }
}

/**
 * Send a JSON message to all WebSocket connections owned by a player.
 *
 * Uses Record<string, unknown> instead of `any` to maintain type safety
 * while allowing different event shapes (move events, game_over events, etc.).
 * Only sends to connections in the OPEN state (readyState === 1).
 */
export function sendToPlayer(playerId: string, message: Record<string, unknown>): void {
  const conns = wsConnections.get(playerId);
  if (!conns) return;
  const data = JSON.stringify(message);
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/**
 * Register a WebSocket as a spectator of a game.
 */
export function registerSpectator(gameId: string, ws: WebSocket): boolean {
  const game = games.get(gameId);
  if (!game || game.status !== 'active') {
    logger.info('Spectator register failed: gameId=' + gameId + ' reason=not active or not found');
    return false;
  }
  if (!spectatorConnections.has(gameId)) {
    spectatorConnections.set(gameId, new Set());
  }
  spectatorConnections.get(gameId)!.add(ws);
  sendChatHistory(gameId, ws);
  broadcastSpectatorCount(gameId);
  logger.info('Spectator registered: gameId=' + gameId);
  return true;
}

/**
 * Remove a spectator WebSocket connection.
 */
export function removeSpectator(gameId: string, ws: WebSocket): void {
  spectatorConnections.get(gameId)?.delete(ws);
  broadcastSpectatorCount(gameId);
  logger.info('Spectator removed: gameId=' + gameId);
}

function sendToSpectators(gameId: string, message: Record<string, unknown>): void {
  const conns = spectatorConnections.get(gameId);
  if (!conns) return;
  const data = JSON.stringify(message);
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function broadcastSpectatorCount(gameId: string): void {
  const count = spectatorConnections.get(gameId)?.size ?? 0;
  const message = { type: 'spectator_count', gameId, count };
  const game = games.get(gameId);
  if (game) {
    const { white, black } = game.players;
    if (white) sendToPlayer(white, message);
    if (black) sendToPlayer(black, message);
  }
  sendToSpectators(gameId, message);
}

function broadcastGameListUpdate(): void {
  const openGames = Array.from(games.values())
    .filter((g) => g.status === 'waiting' && g.visibility === 'public')
    .map(enrichNames);
  const activeGames = Array.from(games.values())
    .filter((g) => g.status === 'active')
    .map(enrichNames);
  const message = { type: 'game_list_update', openGames, activeGames };
  const data = JSON.stringify(message);
  for (const conns of wsConnections.values()) {
    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}

/**
 * Send a message to both participants of a game.
 *
 * Called after every move, resignation, or game-end event.  Both players
 * receive the same payload so the UI stays in sync without polling.
 */
function broadcastToGame(gameId: string, message: Record<string, unknown>): void {
  const game = games.get(gameId);
  if (!game) return;
  const { white, black } = game.players;
  if (white) sendToPlayer(white, message);
  if (black) sendToPlayer(black, message);
  /* Also forward to spectators */
  sendToSpectators(gameId, message);
}

/**
 * Count how many active games a player is currently participating in.
 * MAX_GAMES_PER_PLAYER (env) controls the limit (default 1). */
function countActiveGamesForPlayer(playerId: string): number {
  let count = 0;
  for (const g of games.values()) {
    if (g.status === 'active' && (g.players.white === playerId || g.players.black === playerId)) {
      count++;
    }
  }
  return count;
}

/**
 * Simple in-memory rate limiter per player.
 * Tracks request timestamps within a sliding window. */
const rateLimitBuckets = new Map<string, number[]>();

export function checkRateLimit(playerId: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  let timestamps = rateLimitBuckets.get(playerId) ?? [];
  timestamps = timestamps.filter((t) => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    logger.info('Rate limit hit: playerId=' + playerId + ' count=' + timestamps.length);
    return false;
  }
  timestamps.push(now);
  rateLimitBuckets.set(playerId, timestamps);
  return true;
}

/**
 * Create a new game with the given player as white.
 *
 * The game starts in 'waiting' status — it needs a second player (black)
 * to join before any moves can be made.  The board is set to the standard
 * starting position and both sides have full castling rights initially.
 *
 * @param playerId - The white player's ID.
 * @param visibility - Whether the game appears in the open games list.
 *   Defaults to 'public'.  Private games can only be joined by direct ID.
 */
export function createGame(playerId: string, visibility: 'public' | 'private' = 'public'): GameState {
  const id = uuidv4();
  const game: GameState = {
    id,
    board: chess.createInitialBoard(),
    /* White always moves first in chess */
    turn: 'white',
    /* Waiting for black to join */
    status: 'waiting',
    players: { white: playerId },
    moveHistory: [],
    boardHistory: [],
    enPassantTarget: null,
    /* Both sides start with full castling rights */
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    lastMove: null,
    winner: null,
    createdAt: Date.now(),
    visibility,
    halfMoveClock: 0,
  };
  games.set(id, game);
  logger.info('Game created: gameId=' + id + ' white=' + playerId + ' visibility=' + visibility);
  broadcastGameListUpdate();
  return enrichNames(game);
}

export function createBotGame(playerId: string, skillLevel: number, playerColor: Color = 'white'): GameState {
  const id = uuidv4();
  const botColor: Color = playerColor === 'white' ? 'black' : 'white';
  const game: GameState = {
    id,
    board: chess.createInitialBoard(),
    turn: 'white',
    status: 'active',
    players: { [playerColor]: playerId, [botColor]: BOT_PLAYER_ID },
    whiteName: playerColor === 'white' ? undefined : 'Bot',
    blackName: playerColor === 'black' ? undefined : 'Bot',
    moveHistory: [],
    boardHistory: [],
    enPassantTarget: null,
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    lastMove: null,
    winner: null,
    createdAt: Date.now(),
    visibility: 'private',
    halfMoveClock: 0,
  };
  games.set(id, game);

  engineManager
    .startInstance(id, skillLevel)
    .then(() => {
      logger.info('Bot engine ready for game', id);
      if (botColor === 'white') {
        triggerBotMove(id);
      }
    })
    .catch((err) => {
      logger.error('Failed to start bot engine', err);
    });

  logger.info(
    'Bot game created: gameId=' + id + ' player=' + playerId + ' color=' + playerColor + ' skill=' + skillLevel,
  );
  broadcastGameListUpdate();
  return enrichNames(game);
}

async function triggerBotMove(gameId: string): Promise<void> {
  const game = games.get(gameId);
  if (!game || game.status !== 'active') return;

  const isBotWhite = game.players.white === BOT_PLAYER_ID;
  const botColor: Color = isBotWhite ? 'white' : 'black';
  if (game.turn !== botColor) return;

  await engineManager.setPosition(gameId, uciHistory.get(gameId) || []);
  const bestMove = await engineManager.getBestMove(gameId, 500);
  if (!bestMove || bestMove === '(none)') return;

  const from = bestMove.slice(0, 2);
  const to = bestMove.slice(2, 4);
  const promotion = bestMove.length > 4 ? (bestMove.slice(4) as PieceType) : undefined;

  const legalMoves = chess.getLegalMoves(game.board, botColor, game.enPassantTarget, game.castlingRights);
  const matchedMove = legalMoves.find(
    (m) => m.from === from && m.to === to && (!promotion || m.promotion === promotion),
  );
  if (!matchedMove) {
    logger.warn('Bot generated illegal move', { gameId, bestMove });
    return;
  }

  const { newBoard, enPassantTarget, castlingRights } = chess.applyMove(game.board, matchedMove, game.castlingRights);
  const notation = chess.moveToAlgebraic(matchedMove, matchedMove.captured, legalMoves);
  const newHalfMoveClock = chess.updateHalfMoveClock(matchedMove, game.halfMoveClock);
  const nextTurn: Color = game.turn === 'white' ? 'black' : 'white';
  const { status: rawStatus } = chess.getGameStatus(
    newBoard,
    nextTurn,
    enPassantTarget,
    castlingRights,
    newHalfMoveClock,
  );

  let newStatus: GameStatus;
  let winner: Color | null = null;
  if (rawStatus === 'checkmate') {
    newStatus = 'checkmate';
    winner = game.turn;
  } else if (rawStatus === 'stalemate' || rawStatus === 'draw') {
    newStatus = rawStatus;
  } else {
    newStatus = 'active';
  }

  game.board = newBoard;
  game.turn = nextTurn;
  game.status = newStatus;
  game.moveHistory.push(notation);
  game.boardHistory.push({ board: chess.serializeBoard(newBoard), move: notation });
  if (!uciHistory.has(gameId)) uciHistory.set(gameId, []);
  uciHistory.get(gameId)!.push(from + to + (matchedMove.promotion ? matchedMove.promotion[0] : ''));
  game.enPassantTarget = enPassantTarget;
  game.castlingRights = castlingRights;
  game.lastMove = { from, to };
  game.halfMoveClock = newHalfMoveClock;
  if (winner) game.winner = winner;

  const isTerminal = newStatus === 'checkmate' || newStatus === 'stalemate' || newStatus === 'draw';
  broadcastToGame(gameId, {
    type: isTerminal ? 'game_over' : 'move',
    gameId,
    board: chess.serializeBoard(newBoard),
    turn: nextTurn,
    lastMove: { from, to },
    status: newStatus,
    ...(newStatus === 'checkmate' ? { result: 'checkmate', reason: `${winner} wins by checkmate`, winner } : {}),
    ...(newStatus === 'stalemate' ? { result: 'stalemate', reason: 'Draw by stalemate' } : {}),
    ...(newStatus === 'draw' ? { result: 'draw', reason: 'Draw by 50-move rule' } : {}),
  });

  if (isTerminal) {
    recordGameResult(game, winner);
    broadcastGameListUpdate();
  }

  logger.info('Bot move: gameId=' + gameId + ' move=' + notation + ' status=' + newStatus);
}

export function isBotGame(game: GameState): boolean {
  return game.players.white === BOT_PLAYER_ID || game.players.black === BOT_PLAYER_ID;
}

/**
 * List all games that are waiting for a second player and public.
 * Private games are excluded — they must be joined by direct ID.
 */
export function getActiveGames(): GameState[] {
  const result = Array.from(games.values())
    .filter((g) => g.status === 'active')
    .map(enrichNames);
  logger.info('getActiveGames: count=' + result.length);
  return result;
}

export function getOpenGames(): GameState[] {
  const result = Array.from(games.values())
    .filter((g) => g.status === 'waiting' && g.visibility === 'public')
    .map(enrichNames);
  logger.info('getOpenGames: count=' + result.length);
  return result;
}

/**
 * Get a game by its ID.  Returns null if no such game exists.
 */
export function getGame(gameId: string): GameState | null {
  const g = games.get(gameId);
  if (g) {
    logger.info('getGame: gameId=' + gameId + ' status=' + g.status);
  } else {
    logger.info('getGame: gameId=' + gameId + ' not found');
  }
  return g ? enrichNames(g) : null;
}

/**
 * Abort a waiting game (creator only).
 *
 * Removes the game from the server entirely and notifies any connected
 * player via WebSocket so their UI can clean up.
 */
export function abortGame(gameId: string, playerId: string): { success: boolean; error?: string } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'waiting') return { success: false, error: 'Can only abort a waiting game' };
  if (game.players.white !== playerId) return { success: false, error: 'Only the creator can abort the game' };

  /* Notify any connected player(s) before removing */
  if (game.players.white) sendToPlayer(game.players.white, { type: 'game_aborted', gameId });
  if (game.players.black) sendToPlayer(game.players.black, { type: 'game_aborted', gameId });

  games.delete(gameId);
  broadcastGameListUpdate();
  logger.info('Game aborted: gameId=' + gameId + ' by playerId=' + playerId);
  return { success: true };
}

/**
 * Join a game as the black player.
 *
 * Validates:
 *   - Game exists and is in 'waiting' status.
 *   - The joining player is not the creator (can't play yourself).
 *   - The joining player is not already in another active game.
 *
 * On success, the game transitions to 'active' and black is assigned.
 */
export function joinGame(gameId: string, playerId: string): { success: boolean; error?: string; game?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'waiting') return { success: false, error: 'Game is not open for joining' };
  if (game.players.white === playerId) return { success: false, error: 'Cannot join your own game' };
  const activeCount = countActiveGamesForPlayer(playerId);
  if (activeCount >= MAX_GAMES_PER_PLAYER)
    return { success: false, error: `Already in ${activeCount} active game(s) (max ${MAX_GAMES_PER_PLAYER})` };

  /* Black joins and the game immediately becomes active */
  game.players.black = playerId;
  game.status = 'active';

  logger.info('Game joined: gameId=' + gameId + ' white=' + game.players.white + ' black=' + playerId);

  /* Broadcast to all connected players so their game view updates.
     The enriched copy includes player display names for the UI. */
  const enriched = enrichNames(game);
  broadcastToGame(gameId, {
    type: 'game_started',
    gameId,
    game: enriched,
  });
  broadcastGameListUpdate();

  return { success: true, game: enriched };
}

/**
 * Attempt to make a move in a game.
 *
 * This is the core action in the API.  It performs extensive validation
 * before modifying any state:
 *   1. Game exists and is active.
 *   2. Requesting player is a participant and it's their turn.
 *   3. Source and destination are valid algebraic squares.
 *   4. Source square has a piece belonging to the player.
 *   5. The move exists in the legal move list.
 *
 * On success, the game state is updated, algebraic notation is recorded,
 * a WebSocket broadcast is sent to both players, and the new state is
 * returned.
 */
export function makeMove(
  gameId: string,
  playerId: string,
  from: string,
  to: string,
  promotion?: PieceType,
): { success: boolean; error?: string; state?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };

  /* Only active games accept moves */
  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

  /* Determine which color the requesting player controls */
  let playerColor: Color | null = null;
  if (game.players.white === playerId) playerColor = 'white';
  else if (game.players.black === playerId) playerColor = 'black';
  if (!playerColor) return { success: false, error: 'You are not a player in this game' };

  /* Verify it's this player's turn */
  if (game.turn !== playerColor) return { success: false, error: 'Not your turn' };

  /* Validate square format: algebraic notation a1-h8 */
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    return { success: false, error: 'Invalid square format' };
  }

  /* Check that the source square holds one of the player's pieces */
  const [fromRank, fromFile] = chess.squareToIndices(from);
  const piece = game.board[fromRank][fromFile];
  if (!piece) return { success: false, error: 'No piece at source square' };
  if (piece.color !== playerColor) return { success: false, error: 'That is not your piece' };

  /* Compute legal moves for this position */
  const legalMoves = chess.getLegalMoves(game.board, playerColor, game.enPassantTarget, game.castlingRights);

  /* Find the matching legal move (considering promotion piece choice) */
  const matchedMove = legalMoves.find((m) => {
    if (m.from !== from || m.to !== to) return false;
    if (promotion && m.promotion !== promotion) return false;
    /* If no promotion piece was specified but this move IS a promotion,
     * default to queen (by far the most common choice in practice) */
    if (!promotion && m.promotion && m.promotion !== 'queen') return false;
    return true;
  });

  if (!matchedMove) return { success: false, error: 'Illegal move' };

  /* Apply the move on the board */
  const { newBoard, enPassantTarget, castlingRights } = chess.applyMove(game.board, matchedMove, game.castlingRights);

  /* Generate algebraic notation for the move history */
  const notation = chess.moveToAlgebraic(matchedMove, matchedMove.captured, legalMoves);

  /* Update half-move clock for 50-move rule */
  const newHalfMoveClock = chess.updateHalfMoveClock(matchedMove, game.halfMoveClock);

  /* Determine the next turn and check for game-ending conditions */
  const nextTurn: Color = game.turn === 'white' ? 'black' : 'white';
  const { status: rawStatus } = chess.getGameStatus(
    newBoard,
    nextTurn,
    enPassantTarget,
    castlingRights,
    newHalfMoveClock,
  );

  let newStatus: GameStatus;
  let winner: Color | null = null;

  if (rawStatus === 'checkmate') {
    /* The player who just moved wins */
    newStatus = 'checkmate';
    winner = game.turn;
  } else if (rawStatus === 'stalemate' || rawStatus === 'draw') {
    newStatus = rawStatus;
  } else {
    /* 'check' is informational only — game continues as 'active' */
    newStatus = 'active';
  }

  /* Update the game state in-place */
  game.board = newBoard;
  game.turn = nextTurn;
  game.status = newStatus;
  game.moveHistory.push(notation);
  game.boardHistory.push({ board: chess.serializeBoard(newBoard), move: notation });
  game.enPassantTarget = enPassantTarget;
  game.castlingRights = castlingRights;
  game.lastMove = { from, to };
  game.halfMoveClock = newHalfMoveClock;
  if (winner) game.winner = winner;

  /* Track UCI notation for engine */
  if (!uciHistory.has(gameId)) uciHistory.set(gameId, []);
  uciHistory.get(gameId)!.push(from + to + (matchedMove.promotion ? matchedMove.promotion[0] : ''));

  /* Cancel any pending draw offer — a move was made */
  cancelDrawOffer(gameId);

  /* Build and broadcast the WebSocket event to both players */
  const isTerminal = newStatus === 'checkmate' || newStatus === 'stalemate' || newStatus === 'draw';
  const message: Record<string, unknown> = {
    type: isTerminal ? 'game_over' : 'move',
    gameId,
    board: chess.serializeBoard(newBoard),
    turn: nextTurn,
    lastMove: { from, to },
    status: newStatus,
  };

  if (newStatus === 'checkmate') {
    message.result = 'checkmate';
    message.reason = `${winner} wins by checkmate`;
    message.winner = winner;
  } else if (newStatus === 'stalemate') {
    message.result = 'stalemate';
    message.reason = 'Draw by stalemate';
  } else if (newStatus === 'draw') {
    message.result = 'draw';
    message.reason = 'Draw by 50-move rule';
  }

  broadcastToGame(gameId, message);

  if (isTerminal) {
    recordGameResult(game, winner);
    broadcastGameListUpdate();
  } else if (isBotGame(game)) {
    /* Bot opponent moves after the human's move */
    setTimeout(() => {
      triggerBotMove(gameId);
    }, 100);
  }

  const moveLog = notation || from + '-' + to;
  logger.info('Move: gameId=' + gameId + ' player=' + playerId + ' move=' + moveLog + ' status=' + newStatus);
  return { success: true, state: enrichNames(game) };
}

/**
 * Resign from a game.
 *
 * The resigning player immediately loses and the opponent wins.
 * The game board is preserved in its current state for review.
 * A WebSocket game_over event is broadcast to both players.
 */
export function resignGame(gameId: string, playerId: string): { success: boolean; error?: string; state?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };

  let resigningColor: Color | null = null;
  if (game.players.white === playerId) resigningColor = 'white';
  else if (game.players.black === playerId) resigningColor = 'black';
  if (!resigningColor) return { success: false, error: 'You are not a player in this game' };

  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

  /* The opponent is declared the winner */
  const winner: Color = resigningColor === 'white' ? 'black' : 'white';
  game.status = 'resigned';
  game.winner = winner;

  broadcastToGame(gameId, {
    type: 'game_over',
    gameId,
    board: chess.serializeBoard(game.board),
    turn: game.turn,
    lastMove: game.lastMove,
    status: 'resigned',
    result: 'resigned',
    reason: `${resigningColor} resigned`,
    winner,
  });

  recordGameResult(game, winner === 'white' ? 'white' : winner === 'black' ? 'black' : null);
  if (isBotGame(game)) engineManager.destroyInstance(gameId);
  broadcastGameListUpdate();

  logger.info('Resign: gameId=' + gameId + ' player=' + playerId + ' winner=' + winner);
  return { success: true, state: enrichNames(game) };
}

/**
 * Calculate Elo rating change.
 */
function calculateElo(ratingA: number, ratingB: number, scoreA: number): [number, number] {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const k = 32;
  return [Math.round(ratingA + k * (scoreA - expectedA)), Math.round(ratingB + k * (1 - scoreA - expectedB))];
}

/**
 * Update Elo ratings for both players after a finished game.
 * Only affects registered (DB-persisted) players.
 */
function updateEloRatings(game: GameState, winner: Color | null): void {
  const whiteId = game.players.white;
  const blackId = game.players.black;
  if (!whiteId || !blackId) return;

  const whiteUser = db.getUserById(whiteId);
  const blackUser = db.getUserById(blackId);
  if (!whiteUser || !blackUser) return;

  let scoreWhite: number;
  if (winner === 'white') scoreWhite = 1;
  else if (winner === 'black') scoreWhite = 0;
  else scoreWhite = 0.5;

  const [newWhite, newBlack] = calculateElo(whiteUser.rating, blackUser.rating, scoreWhite);
  db.updatePlayerRating(whiteId, newWhite);
  db.updatePlayerRating(blackId, newBlack);
  logger.info(
    'Elo updated: gameId=' +
      game.id +
      ' white=' +
      whiteId +
      ' ' +
      whiteUser.rating +
      '->' +
      newWhite +
      ' black=' +
      blackId +
      ' ' +
      blackUser.rating +
      '->' +
      newBlack,
  );
}

/**
 * Persist game results to the database for registered players.
 * Also saves a snapshot to the completed_games archive.
 */
function recordGameResult(game: GameState, winner: Color | null): void {
  game.winner = winner;
  const user = db.getUserById(winner || '');
  if (user) {
    db.addWin(user.id);
    const opponentId = game.players.white === winner ? game.players.black : game.players.white;
    if (opponentId) {
      const opponent = db.getUserById(opponentId);
      if (opponent) db.addLoss(opponent.id);
    }
  } else if (winner === null) {
    if (game.players.white) {
      const w = db.getUserById(game.players.white);
      if (w) db.addDraw(w.id);
    }
    if (game.players.black) {
      const b = db.getUserById(game.players.black);
      if (b) db.addDraw(b.id);
    }
  }
  updateEloRatings(game, winner);
  spectatorConnections.delete(game.id);

  const result =
    game.status === 'checkmate'
      ? 'checkmate'
      : game.status === 'stalemate'
        ? 'stalemate'
        : game.status === 'resigned'
          ? 'resigned'
          : 'draw';
  const reason =
    result === 'checkmate'
      ? winner === 'white'
        ? 'White wins by checkmate'
        : 'Black wins by checkmate'
      : result === 'stalemate'
        ? 'Draw by stalemate'
        : result === 'resigned'
          ? winner === 'white'
            ? 'Black resigned'
            : 'White resigned'
          : 'Draw by agreement';
  const g = enrichNames(game);
  db.saveCompletedGame(
    game.id,
    game.players.white || null,
    game.players.black || null,
    g.whiteName || '',
    g.blackName || '',
    winner || null,
    game.status,
    result,
    reason,
    JSON.stringify(game.moveHistory),
    JSON.stringify(game.boardHistory),
    null,
    '5+0',
  );
  if (isBotGame(game)) {
    engineManager.destroyInstance(game.id);
    uciHistory.delete(game.id);
  }
  logger.info('Game result recorded: gameId=' + game.id + ' winner=' + winner);
}

/* ─── Draw offer system ─── */

/**
 * Offer a draw to the opponent.
 * Returns false if there's already a pending offer in this game.
 * The offerer is also notified so they can show "Draw offered" state.
 */
export function offerDraw(gameId: string, playerId: string): boolean {
  const game = games.get(gameId);
  if (!game || game.status !== 'active') return false;
  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  if (!isPlayer) return false;
  if (drawOffers.has(gameId)) return false;

  drawOffers.set(gameId, playerId);
  const message = { type: 'draw_offered', gameId, byPlayerId: playerId };
  broadcastToGame(gameId, message);
  logger.info('Draw offered: gameId=' + gameId + ' by playerId=' + playerId);
  return true;
}

/**
 * Accept a pending draw offer — game ends as a draw.
 * Only the non-offering player can accept.
 */
export function acceptDraw(gameId: string, playerId: string): { success: boolean; error?: string } {
  const offererId = drawOffers.get(gameId);
  if (!offererId) return { success: false, error: 'No pending draw offer' };
  if (offererId === playerId) return { success: false, error: 'Cannot accept your own draw offer' };

  const game = games.get(gameId);
  if (!game || game.status !== 'active') {
    drawOffers.delete(gameId);
    return { success: false, error: 'Game is not active' };
  }

  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  if (!isPlayer) return { success: false, error: 'You are not a player in this game' };

  game.status = 'draw';
  game.winner = null;
  drawOffers.delete(gameId);

  recordGameResult(game, null);

  broadcastToGame(gameId, {
    type: 'game_over',
    gameId,
    board: chess.serializeBoard(game.board),
    turn: game.turn,
    lastMove: game.lastMove,
    status: 'draw',
    result: 'draw',
    reason: 'Draw by agreement',
  });
  broadcastGameListUpdate();

  logger.info('Draw accepted: gameId=' + gameId + ' by playerId=' + playerId);
  return { success: true };
}

/**
 * Decline a pending draw offer.
 * Only the non-offering player can decline.
 */
export function declineDraw(gameId: string, playerId: string): boolean {
  const offererId = drawOffers.get(gameId);
  if (!offererId) {
    logger.info('Decline draw failed: gameId=' + gameId + ' playerId=' + playerId + ' reason=no pending offer');
    return false;
  }
  if (offererId === playerId) {
    logger.info('Decline draw failed: gameId=' + gameId + ' playerId=' + playerId + ' reason=cannot decline own offer');
    return false;
  }

  const game = games.get(gameId);
  if (!game) {
    drawOffers.delete(gameId);
    logger.info('Decline draw: gameId=' + gameId + ' game gone, cleaned up offer');
    return false;
  }

  const isPlayer = game.players.black === playerId || game.players.white === playerId;
  if (!isPlayer) {
    logger.info('Decline draw failed: gameId=' + gameId + ' playerId=' + playerId + ' reason=not a player');
    return false;
  }

  drawOffers.delete(gameId);
  sendToPlayer(offererId, { type: 'draw_declined', gameId });
  logger.info('Draw declined: gameId=' + gameId + ' by playerId=' + playerId);
  return true;
}

/**
 * In-memory map of gameId -> playerId who offered a rematch.
 */
const rematchOffers = new Map<string, string>();

/**
 * Offer a rematch after a finished game.  Notifies the other participant
 * so their UI can show an accept button.
 */
export function offerRematch(gameId: string, playerId: string): boolean {
  const game = games.get(gameId);
  if (!game) {
    logger.info('Rematch offer failed: gameId=' + gameId + ' not found');
    return false;
  }
  const isFinished: ReadonlyArray<string> = ['checkmate', 'stalemate', 'resigned', 'draw'];
  if (!isFinished.includes(game.status)) {
    logger.info('Rematch offer failed: gameId=' + gameId + ' status=' + game.status);
    return false;
  }
  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  if (!isPlayer) {
    logger.info('Rematch offer failed: gameId=' + gameId + ' playerId=' + playerId + ' not a player');
    return false;
  }
  if (rematchOffers.has(gameId)) {
    logger.info('Rematch offer failed: gameId=' + gameId + ' already offered');
    return false;
  }

  rematchOffers.set(gameId, playerId);
  const otherPlayerId = game.players.white === playerId ? game.players.black : game.players.white;
  if (otherPlayerId) {
    sendToPlayer(otherPlayerId, { type: 'rematch_offered', gameId, byPlayerId: playerId });
  }
  logger.info('Rematch offered: gameId=' + gameId + ' by playerId=' + playerId);
  return true;
}

/**
 * Accept a pending rematch offer.  Creates a new game with the same
 * visibility and clock settings but swapped colors, then notifies both
 * players so their clients navigate to the new game.
 */
export function acceptRematch(
  gameId: string,
  playerId: string,
): { success: boolean; error?: string; newGameId?: string } {
  const offererId = rematchOffers.get(gameId);
  if (!offererId) return { success: false, error: 'No pending rematch offer' };
  if (offererId === playerId) return { success: false, error: 'Cannot accept your own rematch offer' };

  const game = games.get(gameId);
  if (!game) {
    rematchOffers.delete(gameId);
    return { success: false, error: 'Game not found' };
  }

  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  if (!isPlayer) return { success: false, error: 'You are not a player in this game' };

  /* Swap colors for the rematch */
  const newWhite = offererId === game.players.white ? game.players.black : game.players.white;
  const newBlack = offererId === game.players.white ? game.players.white : game.players.black;

  const newId = uuidv4();
  const newGame: GameState = {
    id: newId,
    board: chess.createInitialBoard(),
    turn: 'white',
    status: 'active',
    players: { white: newWhite!, black: newBlack! },
    moveHistory: [],
    boardHistory: [],
    enPassantTarget: null,
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    lastMove: null,
    winner: null,
    createdAt: Date.now(),
    visibility: game.visibility,
    halfMoveClock: 0,
  };
  games.set(newId, newGame);
  rematchOffers.delete(gameId);
  broadcastGameListUpdate();

  const enriched = enrichNames(newGame);
  broadcastToGame(newId, { type: 'game_started', gameId: newId, game: enriched });

  /* Tell both old-game participants to navigate to the new game */
  const redirectMsg = { type: 'rematch_accepted', gameId, newGameId: newId };
  const oldPlayers = game.players;
  if (oldPlayers.white) sendToPlayer(oldPlayers.white, redirectMsg);
  if (oldPlayers.black) sendToPlayer(oldPlayers.black, redirectMsg);

  logger.info(
    'Rematch accepted: oldGameId=' + gameId + ' newGameId=' + newId + ' white=' + newWhite + ' black=' + newBlack,
  );
  return { success: true, newGameId: newId };
}

/**
 * Cancel or clear a pending draw offer (e.g. when a move is made).
 */
export function cancelDrawOffer(gameId: string): void {
  if (drawOffers.has(gameId)) {
    drawOffers.delete(gameId);
    logger.info('Draw offer cancelled: gameId=' + gameId);
  }
}

/**
 * Get all legal moves for a player in a game.
 *
 * Returns simplified { from, to } objects (no captured piece, no
 * promotion info) for the game client to highlight valid destination
 * squares or implement move suggestions.
 */
export function getLegalMovesForPlayer(
  gameId: string,
  playerId: string,
): { success: boolean; error?: string; moves?: { from: string; to: string }[] } {
  const game = games.get(gameId);
  if (!game) {
    logger.info('Legal moves: gameId=' + gameId + ' playerId=' + playerId + ' error=not found');
    return { success: false, error: 'Game not found' };
  }

  let playerColor: Color | null = null;
  if (game.players.white === playerId) playerColor = 'white';
  else if (game.players.black === playerId) playerColor = 'black';
  if (!playerColor) {
    logger.info('Legal moves: gameId=' + gameId + ' playerId=' + playerId + ' error=not a player');
    return { success: false, error: 'You are not a player in this game' };
  }

  if (game.status !== 'active') {
    logger.info('Legal moves: gameId=' + gameId + ' playerId=' + playerId + ' error=game not active');
    return { success: false, error: 'Game is not active' };
  }

  const legalMoves = chess.getLegalMoves(game.board, playerColor, game.enPassantTarget, game.castlingRights);
  logger.info('Legal moves: gameId=' + gameId + ' playerId=' + playerId + ' count=' + legalMoves.length);
  return { success: true, moves: legalMoves.map((m) => ({ from: m.from, to: m.to })) };
}

/**
 * Get completed games for a player (games they participated in that have ended).
 */
export function getPlayerGames(playerId: string): GameState[] {
  const result = Array.from(games.values())
    .filter((g) => {
      const isPlayer = g.players.white === playerId || g.players.black === playerId;
      const isFinished =
        g.status === 'checkmate' || g.status === 'stalemate' || g.status === 'resigned' || g.status === 'draw';
      return isPlayer && isFinished;
    })
    .map(enrichNames);
  logger.info('getPlayerGames: playerId=' + playerId + ' count=' + result.length);
  return result;
}

/**
 * Get stats for a player.  Returns null if the player is not registered
 * (anonymous players have no persistent stats).
 */
export function getPlayerStats(playerId: string): { wins: number; losses: number; draws: number } | null {
  const user = db.getUserById(playerId);
  if (!user) {
    logger.info('getPlayerStats: playerId=' + playerId + ' not registered');
    return null;
  }
  const stats = { wins: user.wins, losses: user.losses, draws: user.draws };
  logger.info(
    'getPlayerStats: playerId=' +
      playerId +
      ' wins=' +
      stats.wins +
      ' losses=' +
      stats.losses +
      ' draws=' +
      stats.draws,
  );
  return stats;
}

/**
 * Store recent chat messages per game (in-memory, last 50 messages).
 */
const chatHistory = new Map<string, { playerId: string; username: string; text: string; timestamp: number }[]>();

/**
 * Handle a chat message from a player in a game.
 * Validates the player is part of the game or is spectating, then broadcasts.
 */
export function handleChatMessage(gameId: string, playerId: string, text: string, ws: WebSocket): void {
  if (!text) {
    logger.info('Chat: empty message from playerId=' + playerId + ' gameId=' + gameId);
    return;
  }
  const player = players.get(playerId);
  if (!player) {
    logger.info('Chat: unknown player playerId=' + playerId + ' gameId=' + gameId);
    return;
  }
  const game = games.get(gameId);
  if (!game) {
    logger.info('Chat: unknown game gameId=' + gameId + ' playerId=' + playerId);
    return;
  }

  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  const isSpectating = spectatorConnections.get(gameId)?.has(ws);

  if (!isPlayer && !isSpectating) {
    logger.info('Chat: not a participant or spectator gameId=' + gameId + ' playerId=' + playerId);
    return;
  }

  if (!chatHistory.has(gameId)) {
    chatHistory.set(gameId, []);
  }
  const displayName = player.displayName;
  const history = chatHistory.get(gameId)!;
  history.push({ playerId, username: displayName, text, timestamp: Date.now() });
  if (history.length > 50) history.shift();

  const message: Record<string, unknown> = {
    type: 'chat_message',
    gameId,
    playerId,
    username: displayName,
    text,
    timestamp: Date.now(),
  };

  logger.info('Chat: gameId=' + gameId + ' playerId=' + playerId + ' text="' + text + '"');

  /* Send to players and spectators */
  const { white, black } = game.players;
  if (white) sendToPlayer(white, message);
  if (black) sendToPlayer(black, message);
  sendToSpectators(gameId, message);
}

/**
 * Send the recent chat history for a game to a specific WebSocket.
 * Used when a player reconnects or a spectator starts watching.
 */
export function sendChatHistory(gameId: string, ws: WebSocket): void {
  const history = chatHistory.get(gameId);
  if (!history || history.length === 0) {
    ws.send(JSON.stringify({ type: 'chat_history', gameId, messages: [] }));
    return;
  }
  ws.send(JSON.stringify({ type: 'chat_history', gameId, messages: history }));
  logger.info('Chat history sent: gameId=' + gameId + ' count=' + history.length);
}

/**
 * Return all games (any status) — used by the admin dashboard.
 */
/**
 * Update the authenticated player's display name.
 * Updates both in-memory and DB for registered users.
 */
export function updateDisplayName(
  playerId: string,
  displayName: string,
): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player) {
    logger.info('updateDisplayName: player not found playerId=' + playerId);
    return { success: false, error: 'Player not found' };
  }
  if (!displayName || displayName.trim().length === 0) {
    logger.info('updateDisplayName: empty name playerId=' + playerId);
    return { success: false, error: 'Display name is required' };
  }

  player.displayName = displayName.trim();
  if (player.isRegistered) {
    db.updateUserDisplayName(playerId, displayName.trim());
  }
  logger.info('Display name updated: playerId=' + playerId + ' displayName=' + displayName.trim());
  return { success: true };
}

/**
 * Change the authenticated player's password.
 * Only works for registered users. Verifies the current password first.
 */
export function changePassword(
  playerId: string,
  currentPassword: string,
  newPassword: string,
): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player || !player.isRegistered) {
    logger.info('changePassword: not registered playerId=' + playerId);
    return { success: false, error: 'Only registered users can change password' };
  }
  if (!currentPassword || !newPassword) {
    logger.info('changePassword: missing fields playerId=' + playerId);
    return { success: false, error: 'Current and new password are required' };
  }
  if (newPassword.length < 4) {
    logger.info('changePassword: too short playerId=' + playerId);
    return { success: false, error: 'New password must be at least 4 characters' };
  }

  const user = db.getUserById(playerId);
  if (!user || !user.password_hash) {
    logger.info('changePassword: account not found playerId=' + playerId);
    return { success: false, error: 'Account not found' };
  }
  if (!verifyPassword(currentPassword, user.password_hash)) {
    logger.info('changePassword: wrong current password playerId=' + playerId);
    return { success: false, error: 'Current password is incorrect' };
  }

  const hash = hashPassword(newPassword);
  db.updateUserPasswordHash(playerId, hash);
  logger.info('Password changed: playerId=' + playerId);
  return { success: true };
}

/**
 * Delete the authenticated player's account.
 * Removes from DB, clears all tokens, and removes from in-memory maps.
 * Only works for registered users.
 */
export function deleteAccount(playerId: string): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player || !player.isRegistered)
    return { success: false, error: 'Only registered users can delete their account' };

  /* Remove all tokens from the reverse index */
  for (const token of player.tokens) {
    tokenIndex.delete(token);
  }

  /* Remove from DB */
  db.deleteUserTokens(playerId);
  db.deleteUserRecord(playerId);

  /* Remove from in-memory maps */
  players.delete(playerId);

  logger.info('Account deleted: playerId=' + playerId);
  return { success: true };
}

/**
 * Track which IP a player is using (for ban enforcement).
 */
export function setPlayerIp(playerId: string, ip: string): void {
  playerIps.set(playerId, ip);
  logger.info('Player IP set: playerId=' + playerId + ' ip=' + ip);
}

/**
 * Get the tracked IP for a player.
 */
export function getPlayerIp(playerId: string): string | undefined {
  const ip = playerIps.get(playerId);
  logger.info('getPlayerIp: playerId=' + playerId + (ip ? ' ip=' + ip : ' no IP'));
  return ip;
}

/* ─── Ban system ─── */

export function isBanned(playerId: string, ip?: string): boolean {
  if (bannedPlayers.has(playerId)) {
    logger.info('isBanned: player banned playerId=' + playerId);
    return true;
  }
  if (ip && bannedIps.has(ip)) {
    logger.info('isBanned: IP banned ip=' + ip + ' playerId=' + playerId);
    return true;
  }
  const trackedIp = playerIps.get(playerId);
  if (trackedIp && bannedIps.has(trackedIp)) {
    logger.info('isBanned: tracked IP banned ip=' + trackedIp + ' playerId=' + playerId);
    return true;
  }
  return false;
}

export function banPlayer(playerId: string): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player) return { success: false, error: 'Player not found' };
  if (bannedPlayers.has(playerId)) return { success: false, error: 'Player already banned' };

  bannedPlayers.add(playerId);
  db.saveBan(playerId, playerId, null);

  /* Disconnect all WebSocket connections */
  const conns = wsConnections.get(playerId);
  if (conns) {
    for (const ws of conns) {
      ws.close(4001, 'Banned');
    }
    wsConnections.delete(playerId);
  }

  /* Remove from any active games */
  for (const [gameId, g] of games) {
    if (g.players.white === playerId || g.players.black === playerId) {
      if (g.status === 'waiting') {
        games.delete(gameId);
      } else if (g.status === 'active') {
        g.status = 'resigned';
        g.winner = g.players.white === playerId ? 'black' : 'white';
        const winnerId = g.players.white === playerId ? g.players.black : g.players.white;
        if (winnerId) {
          sendToPlayer(winnerId, { type: 'game_over', reason: 'opponent_banned', gameId });
        }
      }
    }
  }

  logger.info('Player banned: playerId=' + playerId);
  return { success: true };
}

export function banIp(ip: string): { success: true } | { success: false; error: string } {
  if (!ip) {
    logger.info('banIp: no IP provided');
    return { success: false, error: 'IP is required' };
  }
  if (bannedIps.has(ip)) {
    logger.info('banIp: IP already banned ip=' + ip);
    return { success: false, error: 'IP already banned' };
  }

  bannedIps.add(ip);
  db.saveBan(`ip:${ip}`, null, ip);
  logger.info('IP banned: ip=' + ip);

  /* Disconnect all players using this IP */
  for (const [playerId, trackedIp] of playerIps) {
    if (trackedIp === ip) {
      const conns = wsConnections.get(playerId);
      if (conns) {
        for (const ws of conns) {
          ws.close(4001, 'Banned');
        }
        wsConnections.delete(playerId);
      }
    }
  }

  return { success: true };
}

export function unbanPlayer(playerId: string): void {
  bannedPlayers.delete(playerId);
  db.deleteBanById(playerId);
  logger.info('Player unbanned: playerId=' + playerId);
}

export function unbanIp(ip: string): void {
  bannedIps.delete(ip);
  db.deleteBanById(`ip:${ip}`);
  logger.info('IP unbanned: ip=' + ip);
}

export function getBannedPlayers(): string[] {
  const list = Array.from(bannedPlayers);
  logger.info('getBannedPlayers: count=' + list.length);
  return list;
}

export function getBannedIps(): string[] {
  const list = Array.from(bannedIps);
  logger.info('getBannedIps: count=' + list.length);
  return list;
}

export function loadPersistedBans(): void {
  const allBans = db.loadAllBans();
  for (const b of allBans) {
    if (b.player_id) {
      bannedPlayers.add(b.player_id);
    }
    if (b.ip) {
      bannedIps.add(b.ip);
    }
  }
  logger.info('Persisted bans loaded: playerBans=' + bannedPlayers.size + ' ipBans=' + bannedIps.size);
}

/* ─── Admin kick / end-game ─── */

/**
 * Kick a player: disconnect their WebSocket and remove from any active games.
 * Does NOT ban them — they can reconnect.
 */
export function kickPlayer(playerId: string): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player) return { success: false, error: 'Player not found' };

  /* Disconnect all WebSocket connections */
  const conns = wsConnections.get(playerId);
  if (conns) {
    for (const ws of conns) {
      ws.close(4001, 'Kicked by admin');
    }
    wsConnections.delete(playerId);
  }

  /* Remove from waiting games */
  for (const [gameId, g] of games) {
    if (g.status === 'waiting' && g.players.white === playerId) {
      games.delete(gameId);
    }
  }
  broadcastGameListUpdate();

  logger.info('Player kicked: playerId=' + playerId);
  return { success: true };
}

/**
 * Admin force-end a game. Sets status to 'draw' and notifies both players.
 */
export function endGame(gameId: string): { success: true } | { success: false; error: string } {
  const g = games.get(gameId);
  if (!g) return { success: false, error: 'Game not found' };
  if (g.status === 'draw' || g.status === 'stalemate' || g.status === 'resigned' || g.status === 'checkmate') {
    return { success: false, error: 'Game is already over' };
  }

  g.status = 'draw';
  g.winner = null;

  const message = { type: 'game_over', reason: 'admin_ended', gameId };
  if (g.players.white) sendToPlayer(g.players.white, message);
  if (g.players.black) sendToPlayer(g.players.black, message);
  sendToSpectators(gameId, message);
  broadcastGameListUpdate();

  logger.info('Game ended by admin: gameId=' + gameId);
  return { success: true };
}

export function getAllGames(): GameState[] {
  const result = Array.from(games.values()).map(enrichNames);
  logger.info('getAllGames: count=' + result.length);
  return result;
}

/**
 * Get a player by ID from the in-memory store.
 */
export function getPlayerById(playerId: string): Player | undefined {
  const player = players.get(playerId);
  logger.info('getPlayerById: playerId=' + playerId + (player ? ' found' : ' not found'));
  return player;
}

/**
 * Return all players currently tracked in memory.
 */
export function getAllPlayers(): Player[] {
  const result = Array.from(players.values());
  logger.info('getAllPlayers: count=' + result.length);
  return result;
}

/**
 * Return the set of player IDs that currently have at least one
 * open WebSocket connection (i.e. are online right now).
 */
export function getOnlinePlayerIds(): Set<string> {
  const result = new Set(wsConnections.keys());
  logger.info('getOnlinePlayerIds: count=' + result.size);
  return result;
}

/**
 * Aggregate stats for the health check endpoint.
 */
export function getStats(): { gamesActive: number; playersOnline: number } {
  let gamesActive = 0;
  for (const g of games.values()) {
    if (g.status === 'active') gamesActive++;
  }
  const stats = { gamesActive, playersOnline: wsConnections.size };
  logger.info('getStats: gamesActive=' + stats.gamesActive + ' playersOnline=' + stats.playersOnline);
  return stats;
}

/* ─── Friend system ─── */

export interface FriendInfo {
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
  currentGameId: string | null;
}

function getPlayerCurrentGameId(playerId: string): string | null {
  for (const [id, g] of games) {
    if (g.status === 'active' && (g.players.white === playerId || g.players.black === playerId)) {
      return id;
    }
  }
  return null;
}

function sendToFriends(playerId: string, message: Record<string, unknown>): void {
  const friendIds = db.getFriendIds(playerId);
  for (const fid of friendIds) {
    sendToPlayer(fid, message);
  }
}

function notifyFriendsOnline(playerId: string): void {
  const player = players.get(playerId);
  if (!player) {
    logger.info('notifyFriendsOnline: player not found playerId=' + playerId);
    return;
  }
  const currentGameId = getPlayerCurrentGameId(playerId);
  sendToFriends(playerId, {
    type: 'friend_online',
    playerId,
    username: player.username,
    displayName: player.displayName,
    currentGameId,
  });
  logger.info('Friend online notified: playerId=' + playerId);
}

function notifyFriendsOffline(playerId: string): void {
  const player = players.get(playerId);
  sendToFriends(playerId, {
    type: 'friend_offline',
    playerId,
    username: player?.username ?? '?',
    displayName: player?.displayName ?? '?',
  });
  logger.info('Friend offline notified: playerId=' + playerId);
}

export function broadcastFriendRequest(fromPlayerId: string, toPlayerId: string, requestId: string): void {
  const fromPlayer = players.get(fromPlayerId);
  if (!fromPlayer) {
    logger.info('broadcastFriendRequest: sender not found fromPlayerId=' + fromPlayerId);
    return;
  }
  sendToPlayer(toPlayerId, {
    type: 'friend_request',
    requestId,
    fromPlayerId,
    fromUsername: fromPlayer.username,
    fromDisplayName: fromPlayer.displayName,
  });
  logger.info('Friend request broadcast: requestId=' + requestId + ' from=' + fromPlayerId + ' to=' + toPlayerId);
}

export function broadcastFriendRequestAccepted(acceptorId: string, requesterId: string): void {
  const acceptor = players.get(acceptorId);
  if (!acceptor) {
    logger.info('broadcastFriendRequestAccepted: acceptor not found acceptorId=' + acceptorId);
    return;
  }
  sendToPlayer(requesterId, {
    type: 'friend_request_accepted',
    byPlayerId: acceptorId,
    byUsername: acceptor.username,
    byDisplayName: acceptor.displayName,
  });
  logger.info('Friend request accepted broadcast: acceptor=' + acceptorId + ' requester=' + requesterId);
}

export function broadcastFriendRequestDeclined(declinerId: string, requesterId: string): void {
  const decliner = players.get(declinerId);
  if (!decliner) {
    logger.info('broadcastFriendRequestDeclined: decliner not found declinerId=' + declinerId);
    return;
  }
  sendToPlayer(requesterId, {
    type: 'friend_request_declined',
    byPlayerId: declinerId,
    byUsername: decliner.username,
    byDisplayName: decliner.displayName,
  });
  logger.info('Friend request declined broadcast: decliner=' + declinerId + ' requester=' + requesterId);
}

export function broadcastFriendRemoved(removerId: string, removedId: string): void {
  const remover = players.get(removerId);
  if (!remover) {
    logger.info('broadcastFriendRemoved: remover not found removerId=' + removerId);
    return;
  }
  sendToPlayer(removedId, {
    type: 'friend_removed',
    byPlayerId: removerId,
    byUsername: remover.username,
    byDisplayName: remover.displayName,
  });
  logger.info('Friend removed broadcast: remover=' + removerId + ' removed=' + removedId);
}

export function broadcastToAll(message: Record<string, unknown>): number {
  const data = JSON.stringify(message);
  let count = 0;
  for (const conns of wsConnections.values()) {
    for (const ws of conns) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
        count++;
      }
    }
  }
  logger.info('Broadcast to all: message=' + (message.type as string) + ' recipients=' + count);
  return count;
}

export function getFriendList(playerId: string): FriendInfo[] {
  const friendIds = db.getFriendIds(playerId);
  const result = friendIds.map((fid) => {
    const player = players.get(fid);
    const user = db.getUserById(fid);
    return {
      playerId: fid,
      username: player?.username ?? user?.username ?? '?',
      displayName: player?.displayName ?? user?.display_name ?? '?',
      avatarUrl: user?.avatar_url ?? null,
      isOnline: wsConnections.has(fid) && wsConnections.get(fid)!.size > 0,
      currentGameId: getPlayerCurrentGameId(fid),
    };
  });
  logger.info('getFriendList: playerId=' + playerId + ' count=' + result.length);
  return result;
}

/* ─── Periodic sweep of stale waiting games ─── */

/**
 * Remove waiting games whose `createdAt` is older than WAITING_TTL_MS.
 * Called periodically by the sweep timer and can also be invoked manually.
 */
export function sweepStaleWaitingGames(): number {
  if (WAITING_TTL_MS <= 0) return 0;
  const cutoff = Date.now() - WAITING_TTL_MS;
  const toDelete: string[] = [];
  for (const [id, g] of games) {
    if (g.status === 'waiting' && g.createdAt < cutoff) {
      toDelete.push(id);
    }
  }
  for (const id of toDelete) {
    games.delete(id);
  }
  if (toDelete.length > 0) {
    logger.info('Swept stale waiting games: count=' + toDelete.length);
  }
  return toDelete.length;
}

/**
 * Start the periodic sweep timer (runs every WAITING_TTL_MS / 2 so no
 * game exceeds 1.5× the configured TTL).  Called automatically on module
 * load in non-test environments.
 */
export function startWaitingGameSweep(): void {
  if (WAITING_TTL_MS <= 0) {
    logger.info('Waiting game sweep disabled (TTL <= 0)');
    return;
  }
  if (sweepTimer) {
    logger.info('Waiting game sweep already running');
    return;
  }
  sweepTimer = setInterval(sweepStaleWaitingGames, Math.max(WAITING_TTL_MS / 2, 10_000));
  logger.info('Waiting game sweep started (interval=' + Math.max(WAITING_TTL_MS / 2, 10_000) + 'ms)');
}

/**
 * Stop the periodic sweep timer (useful in tests).
 */
export function stopWaitingGameSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
    logger.info('Waiting game sweep stopped');
  }
}

/* Register all users and in-memory — called once at server startup. */
export function loadPersistedUsers(): void {
  const allUsers = db.loadAllUsers();
  for (const u of allUsers) {
    const player: Player = {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      tokens: [],
      isRegistered: true,
    };
    players.set(u.id, player);
  }
  const allTokens = db.loadAllTokens();
  for (const t of allTokens) {
    const player = players.get(t.user_id);
    if (player) {
      player.tokens.push(t.token);
      tokenIndex.set(t.token, t.user_id);
    }
  }
  logger.info('Persisted users loaded: users=' + allUsers.length + ' tokens=' + allTokens.length);
}

/* Auto-start on module load unless we're in a test environment */
const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  loadPersistedUsers();
  loadPersistedBans();
  startWaitingGameSweep();
}
