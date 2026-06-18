import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { Player, GameState, Color, PieceType } from './types';
import type { GameStatus } from './types';
import * as chess from './chess';
import * as db from './db';
import { engineManager } from './engine';
import logger from './logger';

const games = new Map<string, GameState>();
const players = new Map<string, Player>();
const tokenIndex = new Map<string, string>();

const LOGIN_MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS ?? '5', 10);
const LOGIN_LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES ?? '15', 10);
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function checkLoginLockout(username: string): { locked: boolean; remainingMs?: number } {
  const entry = loginAttempts.get(username);
  if (!entry) return { locked: false };
  if (entry.lockedUntil > 0 && Date.now() >= entry.lockedUntil) {
    loginAttempts.delete(username);
    return { locked: false };
  }
  if (entry.lockedUntil > 0) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  return { locked: false };
}

export function recordFailedAttempt(username: string): void {
  const entry = loginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000;
    logger.warn('Account locked out: username="' + username + '" for ' + LOGIN_LOCKOUT_MINUTES + ' minutes');
  }
  loginAttempts.set(username, entry);
}

export function clearLoginAttempts(username: string): void {
  loginAttempts.delete(username);
}

const uciHistory = new Map<string, string[]>();

const wsConnections = new Map<string, Set<WebSocket>>();
const spectatorConnections = new Map<string, Set<WebSocket>>();
const playerGameIndex = new Map<string, Set<string>>();
const playerIps = new Map<string, string>();
const bannedPlayers = new Set<string>();
const bannedIps = new Set<string>();
const drawOffers = new Map<string, string>();

const MAX_GAMES_PER_PLAYER = parseInt(process.env.MAX_GAMES_PER_PLAYER ?? '20', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10);
const WAITING_TTL_MS = parseInt(process.env.WAITING_TTL_MS ?? String(10 * 60 * 1000), 10);
const rateLimitBuckets = new Map<string, number[]>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function addPlayerGameIndex(playerId: string, gameId: string): void {
  let set = playerGameIndex.get(playerId);
  if (!set) {
    set = new Set();
    playerGameIndex.set(playerId, set);
  }
  set.add(gameId);
}

function removePlayerGameIndex(gameId: string, playerId: string): void {
  const set = playerGameIndex.get(playerId);
  if (set) {
    set.delete(gameId);
    if (set.size === 0) playerGameIndex.delete(playerId);
  }
}

function removeGameFromIndex(game: GameState): void {
  if (game.players.white) removePlayerGameIndex(game.id, game.players.white);
  if (game.players.black) removePlayerGameIndex(game.id, game.players.black);
}

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

function sanitizeForClient(g: GameState): GameState {
  const sanitized = { ...g };
  delete sanitized.spectateCode;
  return sanitized;
}

export const BOT_PLAYER_ID = '_bot_';

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

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length < 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  if (key.length !== check.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(check));
  } catch {
    return false;
  }
}

export function authenticatePlayer(token: string): Player | null {
  const playerId = tokenIndex.get(token);
  if (!playerId) {
    logger.info('Auth failed: token not found');
    return null;
  }
  const player = players.get(playerId) ?? null;
  if (player) {
    logger.debug('Auth ok: playerId=' + playerId + ' username=' + player.username);
  } else {
    logger.debug('Auth failed: playerId=' + playerId + ' not in memory');
  }
  return player;
}

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

export function logoutPlayer(token: string): boolean {
  const playerId = tokenIndex.get(token);
  if (!playerId) return false;
  tokenIndex.delete(token);
  const player = players.get(playerId);
  if (player) {
    player.tokens = player.tokens.filter((t) => t !== token);
  }
  db.deleteToken(token);
  logger.info('Player logged out: playerId=' + playerId);
  return true;
}

export function registerWSConnection(playerId: string, ws: WebSocket): void {
  const wasOffline = !wsConnections.has(playerId) || wsConnections.get(playerId)!.size === 0;
  if (!wsConnections.has(playerId)) {
    wsConnections.set(playerId, new Set());
  }
  wsConnections.get(playerId)!.add(ws);
  if (wasOffline) {
    notifyFriendsOnline(playerId);
    notifyOpponentReconnected(playerId);
  }
  logger.info('WS connected: playerId=' + playerId);
}

export function removeWSConnection(playerId: string, ws: WebSocket): void {
  wsConnections.get(playerId)?.delete(ws);
  const isNowOffline = !wsConnections.has(playerId) || wsConnections.get(playerId)!.size === 0;
  if (isNowOffline && players.has(playerId)) {
    notifyFriendsOffline(playerId);
    notifyOpponentDisconnected(playerId);
  }
  logger.info('WS disconnected: playerId=' + playerId);
}

export function cleanupPlayerWaitingGames(playerId: string): void {
  const conns = wsConnections.get(playerId);
  if (conns && conns.size > 0) return;
  const toDelete: string[] = [];
  for (const [id, g] of games) {
    if (g.status === 'waiting' && g.players.white === playerId) {
      toDelete.push(id);
    }
  }
  for (const id of toDelete) {
    removeGameById(id);
  }
  if (toDelete.length > 0) {
    logger.info('Cleaned up waiting games: playerId=' + playerId + ' count=' + toDelete.length);
  }
}

export function removeGameById(id: string): void {
  games.delete(id);
  chatHistory.delete(id);
}

export function sendToPlayer(playerId: string, message: Record<string, unknown>): void {
  sendToPlayerRaw(playerId, JSON.stringify(message));
}

export function sendToPlayerRaw(playerId: string, data: string): void {
  const conns = wsConnections.get(playerId);
  if (!conns) return;
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function registerSpectator(gameId: string, ws: WebSocket, code?: string): boolean {
  const game = games.get(gameId);
  if (!game || game.status !== 'active') {
    logger.info('Spectator register failed: gameId=' + gameId + ' reason=not active or not found');
    return false;
  }
  if (game.spectateMode === 'code' && (!code || code !== game.spectateCode)) {
    logger.info('Spectator register failed: gameId=' + gameId + ' reason=invalid spectate code');
    return false;
  }
  if (!spectatorConnections.has(gameId)) {
    spectatorConnections.set(gameId, new Set());
  }
  spectatorConnections.get(gameId)!.add(ws);
  sendChatHistory(gameId, ws);
  broadcastSpectatorCount(gameId);
  logger.info('Spectator registered: gameId=' + gameId + ' spectateMode=' + game.spectateMode);
  return true;
}

export function removeSpectator(gameId: string, ws: WebSocket): void {
  spectatorConnections.get(gameId)?.delete(ws);
  broadcastSpectatorCount(gameId);
  logger.info('Spectator removed: gameId=' + gameId);
}

function sendToSpectators(gameId: string, dataOrMessage: Record<string, unknown> | string): void {
  const conns = spectatorConnections.get(gameId);
  if (!conns) return;
  const data = typeof dataOrMessage === 'string' ? dataOrMessage : JSON.stringify(dataOrMessage);
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
    .map(enrichNames)
    .map(sanitizeForClient);
  const activeGames = Array.from(games.values())
    .filter((g) => g.status === 'active')
    .map(enrichNames)
    .map(sanitizeForClient);
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

function broadcastToGame(gameId: string, message: Record<string, unknown>): void {
  const data = JSON.stringify(message);
  const game = games.get(gameId);
  if (!game) return;
  const { white, black } = game.players;
  if (white) sendToPlayerRaw(white, data);
  if (black) sendToPlayerRaw(black, data);
  sendToSpectators(gameId, data);
}

function countActiveGamesForPlayer(playerId: string): number {
  const gameIds = playerGameIndex.get(playerId);
  if (!gameIds) return 0;
  let count = 0;
  for (const gameId of gameIds) {
    const g = games.get(gameId);
    if (g && g.status === 'active') count++;
  }
  return count;
}

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

export function createGame(
  playerId: string,
  visibility: 'public' | 'private' = 'public',
  spectateMode: 'public' | 'code' = 'public',
): GameState {
  const id = uuidv4();
  const spectateCode = spectateMode === 'code' ? uuidv4() : undefined;
  const game: GameState = {
    id,
    board: chess.createInitialBoard(),
    turn: 'white',
    status: 'waiting',
    players: { white: playerId },
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
    visibility,
    spectateMode,
    spectateCode,
    halfMoveClock: 0,
  };
  games.set(id, game);
  addPlayerGameIndex(playerId, id);
  logger.info(
    'Game created: gameId=' + id + ' white=' + playerId + ' visibility=' + visibility + ' spectateMode=' + spectateMode,
  );
  broadcastGameListUpdate();
  return enrichNames(game);
}

export function createBotGame(
  playerId: string,
  skillLevel: number,
  playerColor: Color = 'white',
): { success: true; game: GameState } | { success: false; error: string } {
  if (engineManager.activeCount >= engineManager.maxConcurrentEngines) {
    logger.warn(
      'Bot game rejected: engine limit reached (' +
        engineManager.activeCount +
        '/' +
        engineManager.maxConcurrentEngines +
        ')',
    );
    return { success: false, error: 'Too many concurrent bot games. Try again later.' };
  }
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
    spectateMode: 'code',
    spectateCode: uuidv4(),
    halfMoveClock: 0,
  };
  games.set(id, game);
  addPlayerGameIndex(playerId, id);

  engineManager
    .startInstance(id, skillLevel)
    .then(() => {
      logger.info('Bot engine ready for game', id);
      if (botColor === 'white') {
        triggerBotMove(id);
      }
    })
    .catch((err) => {
      logger.error('Failed to start bot engine for game ' + id, err);
      game.status = 'draw';
      broadcastToGame(id, {
        type: 'game_over',
        gameId: id,
        board: chess.serializeBoard(game.board),
        turn: game.turn,
        lastMove: game.lastMove,
        status: 'draw',
        result: 'draw',
        reason: 'Engine error — game cancelled',
      });
      spectatorConnections.delete(id);
      broadcastGameListUpdate();
    });

  logger.info(
    'Bot game created: gameId=' + id + ' player=' + playerId + ' color=' + playerColor + ' skill=' + skillLevel,
  );
  broadcastGameListUpdate();
  return { success: true, game: enrichNames(game) };
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

export function getActiveGames(): GameState[] {
  const result = Array.from(games.values())
    .filter((g) => g.status === 'active')
    .map(enrichNames)
    .map(sanitizeForClient);
  logger.info('getActiveGames: count=' + result.length);
  return result;
}

export function getOpenGames(): GameState[] {
  const result = Array.from(games.values())
    .filter((g) => g.status === 'waiting' && g.visibility === 'public')
    .map(enrichNames)
    .map(sanitizeForClient);
  logger.info('getOpenGames: count=' + result.length);
  return result;
}

export function getGame(gameId: string): GameState | null {
  const g = games.get(gameId);
  if (g) {
    logger.info('getGame: gameId=' + gameId + ' status=' + g.status);
  } else {
    logger.info('getGame: gameId=' + gameId + ' not found');
  }
  return g ? sanitizeForClient(enrichNames(g)) : null;
}

export function abortGame(gameId: string, playerId: string): { success: boolean; error?: string } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'waiting') return { success: false, error: 'Can only abort a waiting game' };
  if (game.players.white !== playerId) return { success: false, error: 'Only the creator can abort the game' };

  if (game.players.white) sendToPlayer(game.players.white, { type: 'game_aborted', gameId });
  if (game.players.black) sendToPlayer(game.players.black, { type: 'game_aborted', gameId });
  sendToSpectators(gameId, { type: 'game_aborted', gameId });
  spectatorConnections.delete(gameId);
  removeGame(gameId);
  broadcastGameListUpdate();
  logger.info('Game aborted: gameId=' + gameId + ' by playerId=' + playerId);
  return { success: true };
}

export function joinGame(gameId: string, playerId: string): { success: boolean; error?: string; game?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'waiting') return { success: false, error: 'Game is not open for joining' };
  if (game.players.white === playerId) return { success: false, error: 'Cannot join your own game' };
  const activeCount = countActiveGamesForPlayer(playerId);
  if (activeCount >= MAX_GAMES_PER_PLAYER)
    return { success: false, error: `Already in ${activeCount} active game(s) (max ${MAX_GAMES_PER_PLAYER})` };

  game.players.black = playerId;
  game.status = 'active';
  addPlayerGameIndex(playerId, gameId);

  logger.info('Game joined: gameId=' + gameId + ' white=' + game.players.white + ' black=' + playerId);

  const enriched = enrichNames(game);
  broadcastToGame(gameId, {
    type: 'game_started',
    gameId,
    game: enriched,
  });
  broadcastGameListUpdate();
  return { success: true, game: enriched };
}

export function makeMove(
  gameId: string,
  playerId: string,
  from: string,
  to: string,
  promotion?: PieceType,
): { success: boolean; error?: string; state?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

  let playerColor: Color | null = null;
  if (game.players.white === playerId) playerColor = 'white';
  else if (game.players.black === playerId) playerColor = 'black';
  if (!playerColor) return { success: false, error: 'You are not a player in this game' };
  if (game.turn !== playerColor) return { success: false, error: 'Not your turn' };
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    return { success: false, error: 'Invalid square format' };
  }

  const [fromRank, fromFile] = chess.squareToIndices(from);
  const piece = game.board[fromRank][fromFile];
  if (!piece) return { success: false, error: 'No piece at source square' };
  if (piece.color !== playerColor) return { success: false, error: 'That is not your piece' };

  const legalMoves = chess.getLegalMoves(game.board, playerColor, game.enPassantTarget, game.castlingRights);

  const matchedMove = legalMoves.find((m) => {
    if (m.from !== from || m.to !== to) return false;
    if (promotion && m.promotion !== promotion) return false;
    if (!promotion && m.promotion && m.promotion !== 'queen') return false;
    return true;
  });

  if (!matchedMove) return { success: false, error: 'Illegal move' };

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
  game.enPassantTarget = enPassantTarget;
  game.castlingRights = castlingRights;
  game.lastMove = { from, to };
  game.halfMoveClock = newHalfMoveClock;
  if (winner) game.winner = winner;

  if (!uciHistory.has(gameId)) uciHistory.set(gameId, []);
  uciHistory.get(gameId)!.push(from + to + (matchedMove.promotion ? matchedMove.promotion[0] : ''));

  cancelDrawOffer(gameId);

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
    setTimeout(() => {
      triggerBotMove(gameId);
    }, 100);
  }

  const moveLog = notation || from + '-' + to;
  logger.info('Move: gameId=' + gameId + ' player=' + playerId + ' move=' + moveLog + ' status=' + newStatus);
  return { success: true, state: enrichNames(game) };
}

export function resignGame(gameId: string, playerId: string): { success: boolean; error?: string; state?: GameState } {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };

  let resigningColor: Color | null = null;
  if (game.players.white === playerId) resigningColor = 'white';
  else if (game.players.black === playerId) resigningColor = 'black';
  if (!resigningColor) return { success: false, error: 'You are not a player in this game' };
  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

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

function calculateElo(ratingA: number, ratingB: number, scoreA: number): [number, number] {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const k = 32;
  return [Math.round(ratingA + k * (scoreA - expectedA)), Math.round(ratingB + k * (1 - scoreA - expectedB))];
}

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

function recordGameResult(game: GameState, winner: Color | null): void {
  game.winner = winner;
  const neededIds: string[] = [];
  const winnerId = winner ? game.players[winner] : null;
  if (winnerId) {
    neededIds.push(winnerId);
    const opponentId = winner === 'white' ? game.players.black : game.players.white;
    if (opponentId) neededIds.push(opponentId);
  } else if (winner === null) {
    if (game.players.white) neededIds.push(game.players.white);
    if (game.players.black) neededIds.push(game.players.black);
  }
  const usersById = db.getUsersByIds(neededIds);

  if (winnerId) {
    const user = usersById.get(winnerId);
    if (user) {
      db.addWin(user.id);
      const opponentId = winner === 'white' ? game.players.black : game.players.white;
      if (opponentId) {
        const opponent = usersById.get(opponentId);
        if (opponent) db.addLoss(opponent.id);
      }
    }
  } else if (winner === null) {
    if (game.players.white) {
      const w = usersById.get(game.players.white);
      if (w) db.addDraw(w.id);
    }
    if (game.players.black) {
      const b = usersById.get(game.players.black);
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
  uciHistory.delete(game.id);
  if (isBotGame(game)) {
    engineManager.destroyInstance(game.id);
  }
  logger.info('Game result recorded: gameId=' + game.id + ' winner=' + winner);
}

/* ─── Draw offer system ─── */

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
  logger.info('Draw declined: gameId=' + gameId + ' by playerId=' + playerId);
  return true;
}

const rematchOffers = new Map<string, string>();

export function offerRematch(gameId: string, playerId: string): boolean {
  const game = games.get(gameId);
  if (!game) return false;
  const isFinished: ReadonlyArray<string> = ['checkmate', 'stalemate', 'resigned', 'draw'];
  if (!isFinished.includes(game.status)) return false;
  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  if (!isPlayer) return false;
  if (rematchOffers.has(gameId)) return false;

  rematchOffers.set(gameId, playerId);
  const otherPlayerId = game.players.white === playerId ? game.players.black : game.players.white;
  if (otherPlayerId) {
    sendToPlayer(otherPlayerId, { type: 'rematch_offered', gameId, byPlayerId: playerId });
  }
  logger.info('Rematch offered: gameId=' + gameId + ' by playerId=' + playerId);
  return true;
}

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
    spectateMode: game.spectateMode,
    spectateCode: game.spectateMode === 'code' ? uuidv4() : undefined,
    halfMoveClock: 0,
  };
  games.set(newId, newGame);
  rematchOffers.delete(gameId);
  broadcastGameListUpdate();

  const enriched = enrichNames(newGame);
  broadcastToGame(newId, { type: 'game_started', gameId: newId, game: enriched });

  const redirectMsg = { type: 'rematch_accepted', gameId, newGameId: newId };
  const oldPlayers = game.players;
  if (oldPlayers.white) sendToPlayer(oldPlayers.white, redirectMsg);
  if (oldPlayers.black) sendToPlayer(oldPlayers.black, redirectMsg);

  logger.info(
    'Rematch accepted: oldGameId=' + gameId + ' newGameId=' + newId + ' white=' + newWhite + ' black=' + newBlack,
  );
  return { success: true, newGameId: newId };
}

export function cancelDrawOffer(gameId: string): void {
  if (drawOffers.has(gameId)) {
    drawOffers.delete(gameId);
    logger.info('Draw offer cancelled: gameId=' + gameId);
  }
}

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
  logger.info('Legal moves: gameId=' + gameId + ' playerId=' + playerId + ' count=' + legalMoves.length);
  return { success: true, moves: legalMoves.map((m) => ({ from: m.from, to: m.to })) };
}

export function getPlayerGames(playerId: string): GameState[] {
  const gameIds = playerGameIndex.get(playerId);
  if (!gameIds) return [];
  const result: GameState[] = [];
  for (const gameId of gameIds) {
    const g = games.get(gameId);
    if (!g) continue;
    const isFinished =
      g.status === 'checkmate' || g.status === 'stalemate' || g.status === 'resigned' || g.status === 'draw';
    if (isFinished) result.push(enrichNames(g));
  }
  logger.info('getPlayerGames: playerId=' + playerId + ' count=' + result.length);
  return result;
}

export function getPlayerStats(playerId: string): { wins: number; losses: number; draws: number } | null {
  const user = db.getUserById(playerId);
  if (!user) return null;
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

const chatHistory = new Map<string, { playerId: string; username: string; text: string; timestamp: number }[]>();

export function cleanupChatHistory(gameId: string): void {
  chatHistory.delete(gameId);
}

function removeGame(gameId: string): void {
  removeGameById(gameId);
}

export function handleChatMessage(gameId: string, playerId: string, text: string, ws: WebSocket): void {
  if (!text) return;
  if (text.length > 500) text = text.slice(0, 500);
  const player = players.get(playerId);
  if (!player) return;
  const game = games.get(gameId);
  if (!game) return;

  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  const isSpectating = spectatorConnections.get(gameId)?.has(ws);
  if (!isPlayer && !isSpectating) return;

  if (!chatHistory.has(gameId)) chatHistory.set(gameId, []);
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

  const { white, black } = game.players;
  if (white) sendToPlayer(white, message);
  if (black) sendToPlayer(black, message);
  sendToSpectators(gameId, message);
}

export function sendChatHistory(gameId: string, ws: WebSocket): void {
  const history = chatHistory.get(gameId);
  if (!history || history.length === 0) {
    ws.send(JSON.stringify({ type: 'chat_history', gameId, messages: [] }));
    return;
  }
  ws.send(JSON.stringify({ type: 'chat_history', gameId, messages: history }));
  logger.info('Chat history sent: gameId=' + gameId + ' count=' + history.length);
}

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
  logger.info('Display name updated: playerId=' + playerId + ' displayName=' + displayName.trim());
  return { success: true };
}

export function changePassword(
  playerId: string,
  currentPassword: string,
  newPassword: string,
): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player || !player.isRegistered) return { success: false, error: 'Only registered users can change password' };
  if (!currentPassword || !newPassword) return { success: false, error: 'Current and new password are required' };
  if (newPassword.length < 8) return { success: false, error: 'New password must be at least 8 characters' };

  const user = db.getUserById(playerId);
  if (!user || !user.password_hash) return { success: false, error: 'Account not found' };
  if (!verifyPassword(currentPassword, user.password_hash))
    return { success: false, error: 'Current password is incorrect' };

  const hash = hashPassword(newPassword);
  db.updateUserPasswordHash(playerId, hash);
  logger.info('Password changed: playerId=' + playerId);
  return { success: true };
}

export function deleteAccount(playerId: string): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player || !player.isRegistered)
    return { success: false, error: 'Only registered users can delete their account' };

  for (const token of player.tokens) {
    tokenIndex.delete(token);
  }
  db.deleteUserTokens(playerId);
  db.deleteUserRecord(playerId);
  players.delete(playerId);

  logger.info('Account deleted: playerId=' + playerId);
  return { success: true };
}

export function setPlayerIp(playerId: string, ip: string): void {
  playerIps.set(playerId, ip);
  logger.info('Player IP set: playerId=' + playerId + ' ip=' + ip);
}

export function getPlayerIp(playerId: string): string | undefined {
  const ip = playerIps.get(playerId);
  logger.info('getPlayerIp: playerId=' + playerId + (ip ? ' ip=' + ip : ' no IP'));
  return ip;
}

/* ─── Ban system ─── */

export function isBanned(playerId: string, ip?: string): boolean {
  if (bannedPlayers.has(playerId)) return true;
  if (ip && bannedIps.has(ip)) return true;
  const trackedIp = playerIps.get(playerId);
  if (trackedIp && bannedIps.has(trackedIp)) return true;
  return false;
}

export function banPlayer(playerId: string): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player) return { success: false, error: 'Player not found' };
  if (bannedPlayers.has(playerId)) return { success: false, error: 'Player already banned' };

  bannedPlayers.add(playerId);
  db.saveBan(playerId, playerId, null);

  const conns = wsConnections.get(playerId);
  if (conns) {
    for (const ws of conns) {
      ws.close(4001, 'Banned');
    }
    wsConnections.delete(playerId);
  }

  for (const [gameId, g] of games) {
    if (g.players.white === playerId || g.players.black === playerId) {
      if (g.status === 'waiting') {
        removeGameById(gameId);
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
  if (!ip) return { success: false, error: 'IP is required' };
  if (bannedIps.has(ip)) return { success: false, error: 'IP already banned' };

  bannedIps.add(ip);
  db.saveBan(`ip:${ip}`, null, ip);
  logger.info('IP banned: ip=' + ip);

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
    if (b.player_id) bannedPlayers.add(b.player_id);
    if (b.ip) bannedIps.add(b.ip);
  }
  logger.info('Persisted bans loaded: playerBans=' + bannedPlayers.size + ' ipBans=' + bannedIps.size);
}

/* ─── Admin kick / end-game ─── */

export function kickPlayer(playerId: string): { success: true } | { success: false; error: string } {
  const player = players.get(playerId);
  if (!player) return { success: false, error: 'Player not found' };

  const conns = wsConnections.get(playerId);
  if (conns) {
    for (const ws of conns) {
      ws.close(4001, 'Kicked by admin');
    }
    wsConnections.delete(playerId);
  }

  for (const [gameId, g] of games) {
    if (g.status === 'waiting' && g.players.white === playerId) {
      removeGame(gameId);
    }
  }
  broadcastGameListUpdate();

  logger.info('Player kicked: playerId=' + playerId);
  return { success: true };
}

export function endGame(gameId: string): { success: true } | { success: false; error: string } {
  const g = games.get(gameId);
  if (!g) return { success: false, error: 'Game not found' };
  if (g.status === 'draw' || g.status === 'stalemate' || g.status === 'resigned' || g.status === 'checkmate') {
    return { success: false, error: 'Game is already over' };
  }

  g.status = 'draw';
  g.winner = null;

  uciHistory.delete(g.id);
  if (isBotGame(g)) {
    engineManager.destroyInstance(g.id);
  }

  spectatorConnections.delete(g.id);

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

export function getPlayerById(playerId: string): Player | undefined {
  const player = players.get(playerId);
  logger.info('getPlayerById: playerId=' + playerId + (player ? ' found' : ' not found'));
  return player;
}

export function getAllPlayers(): Player[] {
  const result = Array.from(players.values());
  logger.info('getAllPlayers: count=' + result.length);
  return result;
}

export function getOnlinePlayerIds(): Set<string> {
  const result = new Set(wsConnections.keys());
  logger.info('getOnlinePlayerIds: count=' + result.size);
  return result;
}

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

export function getPlayerCurrentGameId(playerId: string): string | null {
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
  if (!player) return;
  const currentGameId = getPlayerCurrentGameId(playerId);
  sendToFriends(playerId, {
    type: 'friend_online',
    playerId,
    username: player.username,
    displayName: player.displayName,
    currentGameId,
  });
}

function notifyFriendsOffline(playerId: string): void {
  const player = players.get(playerId);
  sendToFriends(playerId, {
    type: 'friend_offline',
    playerId,
    username: player?.username ?? '?',
    displayName: player?.displayName ?? '?',
  });
}

function notifyOpponentDisconnected(playerId: string): void {
  const gameId = getPlayerCurrentGameId(playerId);
  if (!gameId) return;
  const g = games.get(gameId);
  if (!g) return;
  const opponentId = g.players.white === playerId ? g.players.black : g.players.white;
  if (opponentId) {
    sendToPlayer(opponentId, { type: 'opponent_disconnected', gameId });
  }
}

function notifyOpponentReconnected(playerId: string): void {
  const gameId = getPlayerCurrentGameId(playerId);
  if (!gameId) return;
  const g = games.get(gameId);
  if (!g) return;
  const opponentId = g.players.white === playerId ? g.players.black : g.players.white;
  if (opponentId) {
    sendToPlayer(opponentId, { type: 'opponent_reconnected', gameId });
  }
}

export function broadcastFriendRequest(fromPlayerId: string, toPlayerId: string, requestId: string): void {
  const fromPlayer = players.get(fromPlayerId);
  if (!fromPlayer) return;
  sendToPlayer(toPlayerId, {
    type: 'friend_request',
    requestId,
    fromPlayerId,
    fromUsername: fromPlayer.username,
    fromDisplayName: fromPlayer.displayName,
  });
}

export function broadcastFriendRequestAccepted(acceptorId: string, requesterId: string): void {
  const acceptor = players.get(acceptorId);
  if (!acceptor) return;
  sendToPlayer(requesterId, {
    type: 'friend_request_accepted',
    byPlayerId: acceptorId,
    byUsername: acceptor.username,
    byDisplayName: acceptor.displayName,
  });
}

export function broadcastFriendRequestDeclined(declinerId: string, requesterId: string): void {
  const decliner = players.get(declinerId);
  if (!decliner) return;
  sendToPlayer(requesterId, {
    type: 'friend_request_declined',
    byPlayerId: declinerId,
    byUsername: decliner.username,
    byDisplayName: decliner.displayName,
  });
}

export function broadcastFriendRemoved(removerId: string, removedId: string): void {
  const remover = players.get(removerId);
  if (!remover) return;
  sendToPlayer(removedId, {
    type: 'friend_removed',
    byPlayerId: removerId,
    byUsername: remover.username,
    byDisplayName: remover.displayName,
  });
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
    removeGameById(id);
  }
  if (toDelete.length > 0) {
    logger.info('Swept stale waiting games: count=' + toDelete.length);
  }
  return toDelete.length;
}

export function startWaitingGameSweep(): void {
  if (WAITING_TTL_MS <= 0) return;
  if (sweepTimer) return;
  sweepTimer = setInterval(sweepStaleWaitingGames, Math.max(WAITING_TTL_MS / 2, 10_000));
  logger.info('Waiting game sweep started (interval=' + Math.max(WAITING_TTL_MS / 2, 10_000) + 'ms)');
}

export function stopWaitingGameSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
    logger.info('Waiting game sweep stopped');
  }
}

export function cleanupLoginAttempts(): void {
  const now = Date.now();
  for (const [username, entry] of loginAttempts) {
    if (now >= entry.lockedUntil) {
      loginAttempts.delete(username);
    }
  }
}

export function cleanupRateLimitBuckets(): void {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [playerId, timestamps] of rateLimitBuckets) {
    const active = timestamps.filter((t) => t > cutoff);
    if (active.length === 0) rateLimitBuckets.delete(playerId);
    else rateLimitBuckets.set(playerId, active);
  }
}

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

export function killAllEngines(): void {
  engineManager.killAll();
}

const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  loadPersistedUsers();
  loadPersistedBans();
  startWaitingGameSweep();
}
