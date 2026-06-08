import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { Player, GameState, Color, PieceType } from './types';
import type { GameStatus } from './types';
import * as chess from './chess';
import * as db from './db';

/* In-memory data stores.  Everything resets on process restart — there is
 * no database or persistent storage.  Three data structures:
 *
 *   games:        gameId → GameState
 *   players:      playerId → Player (with token list)
 *   tokenIndex:   bearerToken → playerId (reverse lookup for fast auth)
 *   wsConnections: playerId → Set<WebSocket> (multi-tab support) */
const games = new Map<string, GameState>();
const players = new Map<string, Player>();

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
  return {
    ...g,
    whiteName: whitePlayer?.displayName ?? whitePlayer?.username ?? g.whiteName,
    blackName: blackPlayer?.displayName ?? blackPlayer?.username ?? g.blackName,
  };
}

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

  if (password) {
    const hash = hashPassword(password);
    db.createUser(playerId, username, hash, username);
    db.saveToken(token, playerId);
    const player: Player = { id: playerId, username, displayName: username, tokens: [token], isRegistered: true };
    players.set(playerId, player);
    tokenIndex.set(token, playerId);
    return { playerId, token, isRegistered: true, displayName: username };
  }

  const player: Player = { id: playerId, username, displayName: username, tokens: [token], isRegistered: false };
  players.set(playerId, player);
  tokenIndex.set(token, playerId);
  return { playerId, token, isRegistered: false, displayName: username };
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
  if (!playerId) return null;
  return players.get(playerId) ?? null;
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
  if (!player) return null;
  const token = uuidv4();
  player.tokens.push(token);
  tokenIndex.set(token, playerId);
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
  if (!wsConnections.has(playerId)) {
    wsConnections.set(playerId, new Set());
  }
  wsConnections.get(playerId)!.add(ws);
}

/**
 * Remove a WebSocket connection when it closes or errors.
 *
 * Must be called to prevent memory leaks.  Bound to the 'close' event
 * on each WebSocket in index.ts.
 */
export function removeWSConnection(playerId: string, ws: WebSocket): void {
  wsConnections.get(playerId)?.delete(ws);
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
}

/**
 * Send a JSON message to all WebSocket connections owned by a player.
 *
 * Uses Record<string, unknown> instead of `any` to maintain type safety
 * while allowing different event shapes (move events, game_over events, etc.).
 * Only sends to connections in the OPEN state (readyState === 1).
 */
function sendToPlayer(playerId: string, message: Record<string, unknown>): void {
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
  if (!game || game.status !== 'active') return false;
  if (!spectatorConnections.has(gameId)) {
    spectatorConnections.set(gameId, new Set());
  }
  spectatorConnections.get(gameId)!.add(ws);
  return true;
}

/**
 * Remove a spectator WebSocket connection.
 */
export function removeSpectator(gameId: string, ws: WebSocket): void {
  spectatorConnections.get(gameId)?.delete(ws);
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
  return enrichNames(game);
}

/**
 * List all games that are waiting for a second player and public.
 * Private games are excluded — they must be joined by direct ID.
 */
export function getActiveGames(): GameState[] {
  return Array.from(games.values())
    .filter((g) => g.status === 'active')
    .map(enrichNames);
}

export function getOpenGames(): GameState[] {
  return Array.from(games.values())
    .filter((g) => g.status === 'waiting' && g.visibility === 'public')
    .map(enrichNames);
}

/**
 * Get a game by its ID.  Returns null if no such game exists.
 */
export function getGame(gameId: string): GameState | null {
  const g = games.get(gameId);
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

  /* Broadcast to all connected players so their game view updates.
     The enriched copy includes player display names for the UI. */
  const enriched = enrichNames(game);
  broadcastToGame(gameId, {
    type: 'game_started',
    gameId,
    game: enriched,
  });

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
  }

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

  return { success: true, state: enrichNames(game) };
}

/**
 * Persist game results to the database for registered players.
 * Does nothing for anonymous (in-memory only) players.
 */
function recordGameResult(game: GameState, winner: Color | null): void {
  const whiteId = game.players.white;
  const blackId = game.players.black;
  if (!whiteId || !blackId) return;

  const whitePlayer = players.get(whiteId);
  const blackPlayer = players.get(blackId);

  if (winner === 'white') {
    if (whitePlayer?.isRegistered) db.addWin(whiteId);
    if (blackPlayer?.isRegistered) db.addLoss(blackId);
  } else if (winner === 'black') {
    if (blackPlayer?.isRegistered) db.addWin(blackId);
    if (whitePlayer?.isRegistered) db.addLoss(whiteId);
  } else {
    if (whitePlayer?.isRegistered) db.addDraw(whiteId);
    if (blackPlayer?.isRegistered) db.addDraw(blackId);
  }
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

  return { success: true };
}

/**
 * Decline a pending draw offer.
 * Only the non-offering player can decline.
 */
export function declineDraw(gameId: string, playerId: string): boolean {
  const offererId = drawOffers.get(gameId);
  if (!offererId) return false;
  if (offererId === playerId) return false;

  const game = games.get(gameId);
  if (!game) {
    drawOffers.delete(gameId);
    return false;
  }

  const isPlayer = game.players.black === playerId || game.players.white === playerId;
  if (!isPlayer) return false;

  drawOffers.delete(gameId);
  sendToPlayer(offererId, { type: 'draw_declined', gameId });
  return true;
}

/**
 * Cancel or clear a pending draw offer (e.g. when a move is made).
 */
export function cancelDrawOffer(gameId: string): void {
  drawOffers.delete(gameId);
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
  if (!game) return { success: false, error: 'Game not found' };

  let playerColor: Color | null = null;
  if (game.players.white === playerId) playerColor = 'white';
  else if (game.players.black === playerId) playerColor = 'black';
  if (!playerColor) return { success: false, error: 'You are not a player in this game' };

  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

  const legalMoves = chess.getLegalMoves(game.board, playerColor, game.enPassantTarget, game.castlingRights);
  return { success: true, moves: legalMoves.map((m) => ({ from: m.from, to: m.to })) };
}

/**
 * Get completed games for a player (games they participated in that have ended).
 */
export function getPlayerGames(playerId: string): GameState[] {
  return Array.from(games.values())
    .filter((g) => {
      const isPlayer = g.players.white === playerId || g.players.black === playerId;
      const isFinished =
        g.status === 'checkmate' || g.status === 'stalemate' || g.status === 'resigned' || g.status === 'draw';
      return isPlayer && isFinished;
    })
    .map(enrichNames);
}

/**
 * Get stats for a player.  Returns null if the player is not registered
 * (anonymous players have no persistent stats).
 */
export function getPlayerStats(playerId: string): { wins: number; losses: number; draws: number } | null {
  const user = db.getUserById(playerId);
  if (!user) return null;
  return { wins: user.wins, losses: user.losses, draws: user.draws };
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
  if (!text) return;
  const player = players.get(playerId);
  if (!player) return;
  const game = games.get(gameId);
  if (!game) return;

  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  const isSpectating = spectatorConnections.get(gameId)?.has(ws);

  if (!isPlayer && !isSpectating) return;

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

  /* Send to players and spectators */
  const { white, black } = game.players;
  if (white) sendToPlayer(white, message);
  if (black) sendToPlayer(black, message);
  sendToSpectators(gameId, message);
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
  if (!player) return { success: false, error: 'Player not found' };
  if (!displayName || displayName.trim().length === 0) return { success: false, error: 'Display name is required' };

  player.displayName = displayName.trim();
  if (player.isRegistered) {
    db.updateUserDisplayName(playerId, displayName.trim());
  }
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
  if (!player || !player.isRegistered) return { success: false, error: 'Only registered users can change password' };
  if (!currentPassword || !newPassword) return { success: false, error: 'Current and new password are required' };
  if (newPassword.length < 4) return { success: false, error: 'New password must be at least 4 characters' };

  const user = db.getUserById(playerId);
  if (!user || !user.password_hash) return { success: false, error: 'Account not found' };
  if (!verifyPassword(currentPassword, user.password_hash)) return { success: false, error: 'Current password is incorrect' };

  const hash = hashPassword(newPassword);
  db.updateUserPasswordHash(playerId, hash);
  return { success: true };
}

/**
 * Delete the authenticated player's account.
 * Removes from DB, clears all tokens, and removes from in-memory maps.
 * Only works for registered users.
 */
export function deleteAccount(playerId: string): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player || !player.isRegistered) return { success: false, error: 'Only registered users can delete their account' };

  /* Remove all tokens from the reverse index */
  for (const token of player.tokens) {
    tokenIndex.delete(token);
  }

  /* Remove from DB */
  db.deleteUserTokens(playerId);
  db.deleteUserRecord(playerId);

  /* Remove from in-memory maps */
  players.delete(playerId);

  return { success: true };
}

export function getAllGames(): GameState[] {
  return Array.from(games.values()).map(enrichNames);
}

/**
 * Return all players currently tracked in memory.
 */
export function getAllPlayers(): Player[] {
  return Array.from(players.values());
}

/**
 * Return the set of player IDs that currently have at least one
 * open WebSocket connection (i.e. are online right now).
 */
export function getOnlinePlayerIds(): Set<string> {
  return new Set(wsConnections.keys());
}

/**
 * Aggregate stats for the health check endpoint.
 */
export function getStats(): { gamesActive: number; playersOnline: number } {
  let gamesActive = 0;
  for (const g of games.values()) {
    if (g.status === 'active') gamesActive++;
  }
  return { gamesActive, playersOnline: wsConnections.size };
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
  return toDelete.length;
}

/**
 * Start the periodic sweep timer (runs every WAITING_TTL_MS / 2 so no
 * game exceeds 1.5× the configured TTL).  Called automatically on module
 * load in non-test environments.
 */
export function startWaitingGameSweep(): void {
  if (WAITING_TTL_MS <= 0) return;
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepStaleWaitingGames, Math.max(WAITING_TTL_MS / 2, 10_000));
}

/**
 * Stop the periodic sweep timer (useful in tests).
 */
export function stopWaitingGameSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
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
}

/* Auto-start on module load unless we're in a test environment */
const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  loadPersistedUsers();
  startWaitingGameSweep();
}
