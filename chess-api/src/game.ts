import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { GameState, Color, PieceType } from './types.js';
import type { GameStatus } from './types.js';
import * as chess from './chess.js';
import * as db from './db.js';
import { engineManager } from './engine.js';
import logger from './logger.js';
import { players, BOT_PLAYER_ID } from './player.js';
import {
  games,
  uciHistory,
  wsConnections,
  spectatorConnections,
  playerGameIndex,
  drawOffers,
  rematchOffers,
  rateLimitBuckets,
  MAX_GAMES_PER_PLAYER,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  WAITING_TTL_MS,
  getSweepTimer,
  setSweepTimer,
  removeGameById,
  gameCompletedAt,
  COMPLETED_GAME_TTL_MS,
  addPlayerGameIndex,
  sendToPlayer,
  sendToPlayerRaw,
  sendToSpectators,
} from './state.js';
import { updateEloRatings } from './elo.js';
import { sendChatHistory } from './chat.js';
import { loadPersistedBans } from './bans.js';

export {
  BOT_PLAYER_ID,
  authenticatePlayer,
  registerPlayer,
  loginPlayer,
  logoutPlayer,
  addToken,
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  verifyPasswordAsync,
  checkLoginLockout,
  recordFailedAttempt,
  clearLoginAttempts,
  cleanupLoginAttempts,
  updateDisplayName,
  changePassword,
  deleteAccount,
  deleteToken,
  setPlayerIp,
  getPlayerIp,
  getPlayerById,
  getAllPlayers,
  loadPersistedUsers,
} from './player.js';

export {
  isBanned,
  banPlayer,
  banIp,
  unbanPlayer,
  unbanIp,
  getBannedPlayers,
  getBannedIps,
  loadPersistedBans,
} from './bans.js';

export { cleanupChatHistory, handleChatMessage, sendChatHistory } from './chat.js';

export { removeGameById, sendToPlayer } from './state.js';

async function enrichNames(g: GameState): Promise<GameState> {
  const whitePlayer = g.players.white ? players.get(g.players.white) : undefined;
  const blackPlayer = g.players.black ? players.get(g.players.black) : undefined;
  let whiteAvatarUrl: string | undefined;
  let blackAvatarUrl: string | undefined;
  const ids: string[] = [];
  if (whitePlayer?.isRegistered) ids.push(whitePlayer.id);
  if (blackPlayer?.isRegistered) ids.push(blackPlayer.id);
  if (ids.length > 0) {
    const usersById = await db.getUsersByIds(ids);
    if (whitePlayer?.isRegistered) {
      const user = usersById.get(whitePlayer.id);
      if (user?.avatar_url) whiteAvatarUrl = user.avatar_url;
    }
    if (blackPlayer?.isRegistered) {
      const user = usersById.get(blackPlayer.id);
      if (user?.avatar_url) blackAvatarUrl = user.avatar_url;
    }
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

/* ─── WebSocket Connection Management ─── */

export function registerWSConnection(playerId: string, ws: WebSocket): void {
  const wasOffline = !wsConnections.has(playerId) || wsConnections.get(playerId)!.size === 0;
  if (!wsConnections.has(playerId)) {
    wsConnections.set(playerId, new Set());
  }
  wsConnections.get(playerId)!.add(ws);
  if (wasOffline) {
    // Notify friends only on first connection
    notifyFriendsOnline(playerId).catch(() => {});
    notifyOpponentReconnected(playerId);
  }
  logger.info('WS connected: playerId=' + playerId);
}

export function removeWSConnection(playerId: string, ws: WebSocket): void {
  wsConnections.get(playerId)?.delete(ws);
  const isNowOffline = !wsConnections.has(playerId) || wsConnections.get(playerId)!.size === 0;
  if (isNowOffline && players.has(playerId)) {
    notifyFriendsOffline(playerId).catch(() => {});
    notifyOpponentDisconnected(playerId);
  }
  logger.info('WS disconnected: playerId=' + playerId);
}

export function cleanupPlayerWaitingGames(playerId: string): void {
  const conns = wsConnections.get(playerId);
  if (conns && conns.size > 0) return; // Still connected — keep waiting games alive
  const gameIds = playerGameIndex.get(playerId);
  if (!gameIds) return;
  const toDelete: string[] = [];
  for (const id of gameIds) {
    const g = games.get(id);
    if (g && g.status === 'waiting' && g.players.white === playerId) {
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

export function registerSpectator(gameId: string, ws: WebSocket, code?: string): boolean {
  const game = games.get(gameId);
  if (!game || game.status !== 'active') {
    logger.info('Spectator register failed: gameId=' + gameId + ' reason=not active or not found');
    return false;
  }
  if (game.spectateMode === 'code' && (!code || code !== game.spectateCode)) {
    // Code-based access requires exact match
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

async function broadcastGameListUpdate(): Promise<void> {
  const openGames = await Promise.all(
    Array.from(games.values())
      .filter((g) => g.status === 'waiting' && g.visibility === 'public')
      .map(enrichNames),
  );
  const openSanitized = openGames.map(sanitizeForClient);
  const activeGames = await Promise.all(
    Array.from(games.values())
      .filter((g) => g.status === 'active')
      .map(enrichNames),
  );
  const activeSanitized = activeGames.map(sanitizeForClient);
  const message = { type: 'game_list_update', openGames: openSanitized, activeGames: activeSanitized };
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
    // Sliding window rate limit per player
    logger.info('Rate limit hit: playerId=' + playerId + ' count=' + timestamps.length);
    return false;
  }
  timestamps.push(now);
  rateLimitBuckets.set(playerId, timestamps);
  return true;
}

export async function createGame(
  playerId: string,
  visibility: 'public' | 'private' = 'public',
  spectateMode: 'public' | 'code' = 'public',
): Promise<GameState> {
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
  await broadcastGameListUpdate();
  return await enrichNames(game);
}

export async function createBotGame(
  playerId: string,
  skillLevel: number,
  playerColor: Color = 'white',
): Promise<{ success: true; game: GameState } | { success: false; error: string }> {
  if (engineManager.activeCount >= engineManager.maxConcurrentEngines) {
    // Reject if engine pool exhausted
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
    .catch(async (err) => {
      logger.error('Failed to start bot engine for game ' + id, err);
      game.status = 'draw';
      game.reason = 'Engine error — game cancelled';
      broadcastToGame(id, {
        type: 'game_over',
        gameId: id,
        board: chess.serializeBoard(game.board),
        turn: game.turn,
        lastMove: game.lastMove,
        status: 'draw',
        result: 'draw',
        reason: game.reason,
      });
      spectatorConnections.delete(id);
      await broadcastGameListUpdate();
    });

  logger.info(
    'Bot game created: gameId=' + id + ' player=' + playerId + ' color=' + playerColor + ' skill=' + skillLevel,
  );
  await broadcastGameListUpdate();
  return { success: true, game: await enrichNames(game) };
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
    // Reject engine move if not in legal list
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
    ...(newStatus === 'draw' ? { result: 'draw', reason: game.reason ?? 'Draw by 50-move rule' } : {}),
  });

  if (isTerminal) {
    await recordGameResult(game, winner);
    await broadcastGameListUpdate();
  }
  logger.info('Bot move: gameId=' + gameId + ' move=' + notation + ' status=' + newStatus);
}

export function isBotGame(game: GameState): boolean {
  return game.players.white === BOT_PLAYER_ID || game.players.black === BOT_PLAYER_ID;
}

export async function getActiveGames(): Promise<GameState[]> {
  const gamesList = Array.from(games.values()).filter((g) => g.status === 'active');
  const result = await Promise.all(gamesList.map(enrichNames));
  const sanitized = result.map(sanitizeForClient);
  logger.info('getActiveGames: count=' + sanitized.length);
  return sanitized;
}

export async function getOpenGames(): Promise<GameState[]> {
  const gamesList = Array.from(games.values()).filter((g) => g.status === 'waiting' && g.visibility === 'public');
  const result = await Promise.all(gamesList.map(enrichNames));
  const sanitized = result.map(sanitizeForClient);
  logger.info('getOpenGames: count=' + sanitized.length);
  return sanitized;
}

export async function getGame(gameId: string): Promise<GameState | null> {
  const g = games.get(gameId);
  if (g) {
    logger.info('getGame: gameId=' + gameId + ' status=' + g.status);
  } else {
    logger.info('getGame: gameId=' + gameId + ' not found');
  }
  return g ? sanitizeForClient(await enrichNames(g)) : null;
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

export async function joinGame(
  gameId: string,
  playerId: string,
): Promise<{ success: boolean; error?: string; game?: GameState }> {
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

  const enriched = await enrichNames(game);
  broadcastToGame(gameId, {
    type: 'game_started',
    gameId,
    game: enriched,
  });
  await broadcastGameListUpdate();
  return { success: true, game: enriched };
}

export async function makeMove(
  gameId: string,
  playerId: string,
  from: string,
  to: string,
  promotion?: PieceType,
): Promise<{ success: boolean; error?: string; state?: GameState }> {
  const game = games.get(gameId);
  if (!game) return { success: false, error: 'Game not found' };
  if (game.status !== 'active') return { success: false, error: 'Game is not active' };

  let playerColor: Color | null = null;
  if (game.players.white === playerId) playerColor = 'white';
  else if (game.players.black === playerId) playerColor = 'black';
  if (!playerColor) return { success: false, error: 'You are not a player in this game' };
  if (game.turn !== playerColor) return { success: false, error: 'Not your turn' };
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    // Validate algebraic notation format
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
    if (!promotion && m.promotion && m.promotion !== 'queen') return false; // Default promotion to queen
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

  cancelDrawOffer(gameId); // Cancel any pending draw offer on move

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
    game.reason = 'Draw by 50-move rule';
    message.result = 'draw';
    message.reason = game.reason;
  }

  broadcastToGame(gameId, message);

  if (isTerminal) {
    await recordGameResult(game, winner);
    await broadcastGameListUpdate();
  } else if (isBotGame(game)) {
    setTimeout(() => {
      // 100ms delay gives WS time to flush
      triggerBotMove(gameId);
    }, 100);
  }

  const moveLog = notation || from + '-' + to;
  logger.info('Move: gameId=' + gameId + ' player=' + playerId + ' move=' + moveLog + ' status=' + newStatus);
  return { success: true, state: await enrichNames(game) };
}

export async function resignGame(
  gameId: string,
  playerId: string,
): Promise<{ success: boolean; error?: string; state?: GameState }> {
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

  await recordGameResult(game, winner === 'white' ? 'white' : winner === 'black' ? 'black' : null);
  if (isBotGame(game)) engineManager.destroyInstance(gameId);
  await broadcastGameListUpdate();

  logger.info('Resign: gameId=' + gameId + ' player=' + playerId + ' winner=' + winner);
  return { success: true, state: await enrichNames(game) };
}

async function recordGameResult(game: GameState, winner: Color | null): Promise<void> {
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
  const usersById = await db.getUsersByIds(neededIds);

  if (winnerId) {
    const user = usersById.get(winnerId);
    if (user) {
      await db.addWin(user.id);
      const opponentId = winner === 'white' ? game.players.black : game.players.white;
      if (opponentId) {
        const opponent = usersById.get(opponentId);
        if (opponent) await db.addLoss(opponent.id);
      }
    }
  } else if (winner === null) {
    if (game.players.white) {
      const w = usersById.get(game.players.white);
      if (w) await db.addDraw(w.id);
    }
    if (game.players.black) {
      const b = usersById.get(game.players.black);
      if (b) await db.addDraw(b.id);
    }
  }
  await updateEloRatings(game, winner);
  spectatorConnections.delete(game.id);

  const result =
    game.status === 'checkmate'
      ? 'checkmate'
      : game.status === 'stalemate'
        ? 'stalemate'
        : game.status === 'resigned'
          ? 'resigned'
          : 'draw';
  const reason = game.reason
    ? game.reason
    : result === 'checkmate'
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
  const g = await enrichNames(game);
  await db.saveCompletedGame(
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
    '5+0', // Hardcoded default time control
  );
  uciHistory.delete(game.id);
  if (isBotGame(game)) {
    engineManager.destroyInstance(game.id);
  }
  logger.info('Game result recorded: gameId=' + game.id + ' winner=' + winner);
  gameCompletedAt.set(game.id, Date.now());
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

export async function acceptDraw(gameId: string, playerId: string): Promise<{ success: boolean; error?: string }> {
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
  game.reason = 'Draw by agreement';
  drawOffers.delete(gameId);

  await recordGameResult(game, null);

  broadcastToGame(gameId, {
    type: 'game_over',
    gameId,
    board: chess.serializeBoard(game.board),
    turn: game.turn,
    lastMove: game.lastMove,
    status: 'draw',
    result: 'draw',
    reason: game.reason,
  });
  await broadcastGameListUpdate();

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

export function offerRematch(gameId: string, playerId: string): boolean {
  const game = games.get(gameId);
  if (!game) return false;
  const isFinished: ReadonlyArray<string> = ['checkmate', 'stalemate', 'resigned', 'draw']; // Const array for type safety
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

export async function acceptRematch(
  gameId: string,
  playerId: string,
): Promise<{ success: boolean; error?: string; newGameId?: string }> {
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
  await broadcastGameListUpdate();

  const enriched = await enrichNames(newGame);
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

export async function getPlayerGames(playerId: string): Promise<GameState[]> {
  const gameIds = playerGameIndex.get(playerId);
  if (!gameIds) return [];
  const result: GameState[] = [];
  for (const gameId of gameIds) {
    const g = games.get(gameId);
    if (!g) continue;
    const isFinished =
      g.status === 'checkmate' || g.status === 'stalemate' || g.status === 'resigned' || g.status === 'draw';
    if (isFinished) result.push(await enrichNames(g));
  }
  logger.info('getPlayerGames: playerId=' + playerId + ' count=' + result.length);
  return result;
}

export async function getPlayerStats(
  playerId: string,
): Promise<{ wins: number; losses: number; draws: number } | null> {
  const user = await db.getUserById(playerId);
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

function removeGame(gameId: string): void {
  removeGameById(gameId);
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

  const gameIds = playerGameIndex.get(playerId);
  if (gameIds) {
    for (const gameId of gameIds) {
      const g = games.get(gameId);
      if (g && g.status === 'waiting' && g.players.white === playerId) {
        removeGame(gameId);
      }
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
  g.reason = 'Ended by admin';

  uciHistory.delete(g.id);
  if (isBotGame(g)) {
    engineManager.destroyInstance(g.id);
  }

  spectatorConnections.delete(g.id);

  const message = { type: 'game_over', reason: g.reason, result: 'draw', status: 'draw', gameId };
  if (g.players.white) sendToPlayer(g.players.white, message);
  if (g.players.black) sendToPlayer(g.players.black, message);
  sendToSpectators(gameId, message);
  broadcastGameListUpdate();

  logger.info('Game ended by admin: gameId=' + gameId);
  return { success: true };
}

export async function getAllGames(): Promise<GameState[]> {
  const result = await Promise.all(Array.from(games.values()).map(enrichNames));
  logger.info('getAllGames: count=' + result.length);
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
  const gameIds = playerGameIndex.get(playerId);
  if (!gameIds) return null;
  for (const id of gameIds) {
    const g = games.get(id);
    if (g && g.status === 'active') return id;
  }
  return null;
}

async function sendToFriends(playerId: string, message: Record<string, unknown>): Promise<void> {
  const friendIds = await db.getFriendIds(playerId);
  for (const fid of friendIds) {
    sendToPlayer(fid, message);
  }
}

async function notifyFriendsOnline(playerId: string): Promise<void> {
  const player = players.get(playerId);
  if (!player) return;
  const currentGameId = getPlayerCurrentGameId(playerId);
  await sendToFriends(playerId, {
    type: 'friend_online',
    playerId,
    username: player.username,
    displayName: player.displayName,
    currentGameId,
  });
}

async function notifyFriendsOffline(playerId: string): Promise<void> {
  const player = players.get(playerId);
  await sendToFriends(playerId, {
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

export async function getFriendList(playerId: string): Promise<FriendInfo[]> {
  const friendIds = await db.getFriendIds(playerId);
  const usersById = friendIds.length > 0 ? await db.getUsersByIds(friendIds) : new Map();
  const result = friendIds.map((fid) => {
    const player = players.get(fid);
    const user = usersById.get(fid);
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
  const toDelete: string[] = [];
  if (WAITING_TTL_MS > 0) {
    const cutoff = Date.now() - WAITING_TTL_MS;
    for (const [id, g] of games) {
      if (g.status === 'waiting' && g.createdAt < cutoff) {
        toDelete.push(id);
      }
    }
  }
  const completedCutoff = Date.now() - COMPLETED_GAME_TTL_MS;
  for (const [id, completedAt] of gameCompletedAt) {
    if (completedAt < completedCutoff) {
      toDelete.push(id);
    }
  }
  for (const id of toDelete) {
    removeGameById(id);
  }
  if (toDelete.length > 0) {
    logger.info('Swept stale games: count=' + toDelete.length);
  }
  return toDelete.length;
}

export function startWaitingGameSweep(): void {
  if (WAITING_TTL_MS <= 0) return;
  if (getSweepTimer()) return;
  setSweepTimer(setInterval(sweepStaleWaitingGames, Math.max(WAITING_TTL_MS / 2, 10_000)));
  logger.info('Waiting game sweep started (interval=' + Math.max(WAITING_TTL_MS / 2, 10_000) + 'ms)');
}

export function stopWaitingGameSweep(): void {
  const timer = getSweepTimer();
  if (timer) {
    clearInterval(timer);
    setSweepTimer(null);
    logger.info('Waiting game sweep stopped');
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

export function killAllEngines(): void {
  engineManager.killAll();
}

const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  loadPersistedBans().catch((err) => logger.error('Failed to load persisted bans:', err));
  startWaitingGameSweep();
}
