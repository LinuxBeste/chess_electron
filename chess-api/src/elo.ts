import * as db from './db.js';
import logger from './logger.js';
import type { Color, GameState } from './types.js';

function calculateElo(ratingA: number, ratingB: number, scoreA: number): [number, number] {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const k = 32;
  return [Math.round(ratingA + k * (scoreA - expectedA)), Math.round(ratingB + k * (1 - scoreA - expectedB))];
}

export async function updateEloRatings(game: GameState, winner: Color | null): Promise<void> {
  const whiteId = game.players.white;
  const blackId = game.players.black;
  if (!whiteId || !blackId) return;

  const [whiteUser, blackUser] = await Promise.all([db.getUserById(whiteId), db.getUserById(blackId)]);
  if (!whiteUser || !blackUser) return;

  let scoreWhite: number;
  if (winner === 'white') scoreWhite = 1;
  else if (winner === 'black') scoreWhite = 0;
  else scoreWhite = 0.5;

  const [newWhite, newBlack] = calculateElo(whiteUser.rating, blackUser.rating, scoreWhite);
  await Promise.all([db.updatePlayerRating(whiteId, newWhite), db.updatePlayerRating(blackId, newBlack)]);
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
