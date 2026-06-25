import { WebSocket } from 'ws';
import logger from './logger.js';
import { players } from './player.js';
import { chatHistory, games, spectatorConnections, sendToPlayer, sendToSpectators } from './state.js';

export function cleanupChatHistory(gameId: string): void {
  chatHistory.delete(gameId);
}

export function handleChatMessage(gameId: string, playerId: string, text: string, ws: WebSocket): void {
  if (!text) return;
  if (text.length > 500) text = text.slice(0, 500); // Hard 500-char cap prevents spam
  const player = players.get(playerId);
  if (!player) return;
  const game = games.get(gameId);
  if (!game) return;

  const isPlayer = game.players.white === playerId || game.players.black === playerId;
  const isSpectating = spectatorConnections.get(gameId)?.has(ws);
  if (!isPlayer && !isSpectating) return; // Only participants may chat

  if (!chatHistory.has(gameId)) chatHistory.set(gameId, []);
  const displayName = player.displayName;
  const history = chatHistory.get(gameId)!;
  history.push({ playerId, username: displayName, text, timestamp: Date.now() });
  if (history.length > 50) history.shift(); // Keep only last 50 messages

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
    ws.send(JSON.stringify({ type: 'chat_history', gameId, messages: [] })); // Send empty array, not nothing
    return;
  }
  ws.send(JSON.stringify({ type: 'chat_history', gameId, messages: history }));
  logger.info('Chat history sent: gameId=' + gameId + ' count=' + history.length);
}
