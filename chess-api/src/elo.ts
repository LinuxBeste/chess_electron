import * as db from './db.js';
import logger from './logger.js';
import type { Color, GameState } from './types.js';

// Standard Elo formula: expected score via logistic, K-factor applied
export function calculateElo(ratingA: number, ratingB: number, scoreA: number): [number, number] {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const k = parseInt(process.env.ELO_K_FACTOR ?? '32', 10);
  return [Math.round(ratingA + k * (scoreA - expectedA)), Math.round(ratingB + k * (1 - scoreA - expectedB))];
}

// Recalculate ratings for both players after a game ends
// Uses SELECT FOR UPDATE within a transaction to prevent concurrent rating corruption (TOCTOU)
export async function updateEloRatings(game: GameState, winner: Color | null): Promise<void> {
  const whiteId = game.players.white;
  const blackId = game.players.black;
  if (!whiteId || !blackId) return;

  await db.transaction(async (client) => {
    const whiteRes = await client.query('SELECT rating FROM users WHERE id = $1 FOR UPDATE', [whiteId]);
    const blackRes = await client.query('SELECT rating FROM users WHERE id = $1 FOR UPDATE', [blackId]);
    if (whiteRes.rows.length === 0 || blackRes.rows.length === 0) return;

    const whiteRating = (whiteRes.rows[0] as { rating: number }).rating;
    const blackRating = (blackRes.rows[0] as { rating: number }).rating;

    let scoreWhite: number;
    if (winner === 'white') scoreWhite = 1;
    else if (winner === 'black') scoreWhite = 0;
    else scoreWhite = 0.5;

    const [newWhite, newBlack] = calculateElo(whiteRating, blackRating, scoreWhite);
    await client.query('UPDATE users SET rating = $1 WHERE id = $2', [newWhite, whiteId]);
    await client.query('UPDATE users SET rating = $1 WHERE id = $2', [newBlack, blackId]);

    logger.info(
      'Elo updated: gameId=' +
        game.id +
        ' white=' +
        whiteId +
        ' ' +
        whiteRating +
        '->' +
        newWhite +
        ' black=' +
        blackId +
        ' ' +
        blackRating +
        '->' +
        newBlack,
    );
  });
}
