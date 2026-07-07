import * as db from './db.js';
import logger from './logger.js';
import { players, playerIps } from './player.js';
import {
  bannedPlayers,
  bannedIps,
  games,
  wsConnections,
  playerGameIndex,
  removeGameById,
  sendToPlayer,
} from './state.js';

// Check if player or IP is in the ban set
export function isBanned(playerId: string, ip?: string): boolean {
  if (bannedPlayers.has(playerId)) return true;
  if (ip && bannedIps.has(ip)) return true;
  const trackedIp = playerIps.get(playerId);
  if (trackedIp && bannedIps.has(trackedIp)) return true; // Check historically tracked IP too
  return false;
}

// Ban player: disconnect, auto-resign active games
export async function banPlayer(playerId: string): Promise<{ success: true } | { success: false; error: string }> {
  const player = players.get(playerId);
  if (!player) return { success: false, error: 'Player not found' };
  if (bannedPlayers.has(playerId)) return { success: false, error: 'Player already banned' };

  bannedPlayers.add(playerId);
  await db.saveBan(playerId, playerId, null); // Persist before closing connections

  const conns = wsConnections.get(playerId);
  if (conns) {
    for (const ws of conns) {
      ws.close(4001, 'Banned'); // WebSocket close code 4001 = policy violation
    }
    wsConnections.delete(playerId);
  }

  const gameIds = playerGameIndex.get(playerId);
  if (gameIds) {
    for (const gameId of gameIds) {
      const g = games.get(gameId);
      if (!g) continue;
      if (g.status === 'waiting') {
        removeGameById(gameId);
      } else if (g.status === 'active') {
        g.status = 'resigned'; // Auto-resign all active games on ban
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

// Ban IP, disconnect all players sharing it
export async function banIp(ip: string): Promise<{ success: true } | { success: false; error: string }> {
  if (!ip) return { success: false, error: 'IP is required' }; // Guard against empty IP
  if (bannedIps.has(ip)) return { success: false, error: 'IP already banned' };

  bannedIps.add(ip);
  await db.saveBan(`ip:${ip}`, null, ip);
  logger.info('IP banned: ip=' + ip);

  for (const [playerId, trackedIp] of playerIps) {
    if (trackedIp === ip) {
      // Disconnect all players sharing this IP
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

export async function unbanPlayer(playerId: string): Promise<void> {
  bannedPlayers.delete(playerId);
  await db.deleteBanById(playerId);
  logger.info('Player unbanned: playerId=' + playerId);
}

export async function unbanIp(ip: string): Promise<void> {
  bannedIps.delete(ip);
  await db.deleteBanById(`ip:${ip}`);
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

// Restore in-memory ban sets from DB on startup
export async function loadPersistedBans(): Promise<void> {
  const allBans = await db.loadAllBans();
  for (const b of allBans) {
    if (b.player_id) bannedPlayers.add(b.player_id);
    if (b.ip) bannedIps.add(b.ip);
  }
  logger.info('Persisted bans loaded: playerBans=' + bannedPlayers.size + ' ipBans=' + bannedIps.size);
}
