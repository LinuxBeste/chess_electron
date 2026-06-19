import * as db from './db';
import logger from './logger';
import { players, playerIps } from './player';
import { bannedPlayers, bannedIps, games, wsConnections, playerGameIndex, removeGameById, sendToPlayer } from './state';

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

  const gameIds = playerGameIndex.get(playerId);
  if (gameIds) {
    for (const gameId of gameIds) {
      const g = games.get(gameId);
      if (!g) continue;
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
