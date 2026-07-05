#!/usr/bin/env node
import { Command } from 'commander';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

function getDbUrl(): string {
  return process.env.DATABASE_URL || 'postgresql://chess:chess@localhost:5432/chess';
}

async function withDb<T>(fn: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: getDbUrl() });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }
  const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] || '').length)));
  const sep = '+-' + colWidths.map((w) => '-'.repeat(w)).join('-+-') + '-+';
  const formatRow = (cells: string[]) => '| ' + cells.map((c, i) => c.padEnd(colWidths[i])).join(' | ') + ' |';
  console.log(sep);
  console.log(formatRow(headers));
  console.log(sep);
  for (const row of rows) console.log(formatRow(row));
  console.log(sep);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return salt + ':' + key;
}

const program = new Command();

program
  .name('chess-admin')
  .description('Chess app administration CLI')
  .version('1.0.0')
  .helpOption('-h, --help', 'Show help')
  .addHelpText(
    'before',
    `Chess App Admin CLI — manage users, games, bans, database

USAGE
  chess-admin <command> [subcommand] [options]

`,
  )
  .addHelpText(
    'after',
    `
EXAMPLES BY CATEGORY

  ── User Management ──
    chess-admin create user --username alice --password s3cret
    chess-admin list users --sort rating --limit 20
    chess-admin list users --admin
    chess-admin show user --id <uuid>
    chess-admin edit user --id <uuid> --wins 10 --admin true
    chess-admin set-rating --id <uuid> --rating 1800
    chess-admin delete user --id <uuid>
    chess-admin search alice

  ── Moderation (Reports) ──
    chess-admin list reports --status open
    chess-admin show report --id <uuid>
    chess-admin report dismiss --id <uuid>
    chess-admin report resolve --id <uuid>
    chess-admin report ban --id <uuid>

  ── Moderation (Bans) ──
    chess-admin ban --id <uuid> --reason "Unsportsmanlike"
    chess-admin ban-ip --address 10.0.0.1
    chess-admin unban --id <uuid>
    chess-admin list bans

  ── Game Archive ──
    chess-admin list games --limit 50
    chess-admin show game --id <uuid>
    chess-admin delete game --id <uuid>
    chess-admin purge completed-games --before 90

  ── Tournaments ──
    chess-admin list tournaments
    chess-admin list tournaments --status active
    chess-admin show tournament --id <uuid>

  ── Database ──
    chess-admin db backup
    chess-admin db restore backups/chess-2024-01-01.dump
    chess-admin db migrate

  ── Operations ──
    chess-admin health
    chess-admin stats
    chess-admin config
    chess-admin maintenance on
    chess-admin maintenance off
    chess-admin announce --message "..."
    chess-admin warn --id <uuid> --message "..."
    chess-admin set env --key MAX_GAMES_PER_PLAYER --value 10

Run 'chess-admin <command> --help' for details on each command and its options.
`,
  );

/* ─── CREATE ─── */

const createCmd = program.command('create').description('Create a resource: user');

createCmd
  .command('user')
  .description('Create a new user account in the database')
  .requiredOption('-u, --username <username>', 'Username (2-30 chars, alphanumeric + hyphens/underscores)')
  .option('-p, --password <password>', 'Password (min 8 chars). Hashed as SHA-256.')
  .option('-d, --display-name <name>', 'Display name (defaults to username)')
  .option('-r, --rating <number>', 'Initial Elo rating', '1200')
  .option('-a, --admin', 'Create as admin user (is_admin = true)')
  .addHelpText(
    'after',
    `
Examples:
  Basic account:
    chess-admin create user --username alice --password s3cret

  With custom name and rating:
    chess-admin create user --username bob --display-name "Bobby" --rating 1500

  Admin account:
    chess-admin create user --username admin2 --password s3cret --admin

Output:
  User created:
    ID:       <uuid>
    Username: alice
    Name:     Alice
    Rating:   1200
    Has pwd:  true
`,
  )
  .action(
    async (opts: { username: string; password?: string; displayName?: string; rating: string; admin?: boolean }) => {
      const displayName = opts.displayName || opts.username;
      const rating = Math.max(0, parseInt(opts.rating, 10) || 1200);
      const id = crypto.randomUUID();
      const passwordHash = opts.password ? hashPassword(opts.password) : null;
      await withDb(async (pool) => {
        const isAdmin = opts.admin === true;
        await pool.query(
          'INSERT INTO users (id, username, password_hash, display_name, created_at, rating, is_admin) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [id, opts.username, passwordHash, displayName, Date.now(), rating, isAdmin],
        );
        console.log('User created:');
        console.log('  ID:       ' + id);
        console.log('  Username: ' + opts.username);
        console.log('  Name:     ' + displayName);
        console.log('  Rating:   ' + rating);
        console.log('  Has pwd:  ' + !!opts.password);
        console.log('  Admin:    ' + isAdmin);
      });
    },
  );

/* ─── DELETE ─── */

const deleteCmd = program.command('delete').description('Delete a resource: user, game');

deleteCmd
  .command('user')
  .description(
    'Delete a user and all associated data (tokens, friends, friends requests,\ntournament entries, chat messages) in a single DB transaction',
  )
  .requiredOption('-i, --id <userId>', 'User ID to delete')
  .addHelpText(
    'after',
    `
Example:
  chess-admin delete user --id abc123

Output on success:
  User deleted: abc123

Output on failure (user not found):
  User not found: abc123
  [exit code 1]
`,
  )
  .action(async (opts: { id: string }) => {
    await withDb(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM user_tokens WHERE user_id = $1', [opts.id]);
        await client.query('DELETE FROM friend_requests WHERE from_user_id = $1 OR to_user_id = $1', [opts.id]);
        await client.query('DELETE FROM friends WHERE user_id = $1 OR friend_id = $1', [opts.id]);
        await client.query('DELETE FROM tournament_participants WHERE player_id = $1', [opts.id]);
        await client.query('DELETE FROM tournament_matches WHERE white_player_id = $1 OR black_player_id = $1', [
          opts.id,
        ]);
        await client.query('DELETE FROM chat_conversation_members WHERE user_id = $1', [opts.id]);
        await client.query('DELETE FROM chat_messages WHERE sender_id = $1', [opts.id]);
        const { rowCount } = await client.query('DELETE FROM users WHERE id = $1', [opts.id]);
        await client.query('COMMIT');
        if (rowCount === 0) {
          console.error('User not found: ' + opts.id);
          process.exit(1);
        }
        console.log('User deleted: ' + opts.id);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete failed:', err);
        process.exit(1);
      } finally {
        client.release();
      }
    });
  });

deleteCmd
  .command('game')
  .description('Delete a completed game record from the archive')
  .requiredOption('-i, --id <gameId>', 'Game ID')
  .addHelpText(
    'after',
    `
Example:
  chess-admin delete game --id abc123

Output on success:
  Game deleted: abc123

Output on failure (game not found):
  Game not found: abc123
  [exit code 1]
`,
  )
  .action(async (opts: { id: string }) => {
    await withDb(async (pool) => {
      const { rowCount } = await pool.query('DELETE FROM completed_games WHERE id = $1', [opts.id]);
      if (rowCount === 0) {
        console.error('Game not found: ' + opts.id);
        process.exit(1);
      }
      console.log('Game deleted: ' + opts.id);
    });
  });

/* ─── PURGE ─── */

const purgeCmd = program.command('purge').description('Purge old data: completed-games');

purgeCmd
  .command('completed-games')
  .description('Delete completed games older than N days from the archive')
  .requiredOption('-b, --before <days>', 'Delete games older than this many days')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin purge completed-games --before 90
  chess-admin purge completed-games --before 365

Output:
  Purged 42 completed games older than 90 days
`,
  )
  .action(async (opts: { before: string }) => {
    const days = parseInt(opts.before, 10);
    if (isNaN(days) || days < 1) {
      console.error('--before must be a positive number of days');
      process.exit(1);
    }
    const cutoff = Date.now() - days * 86400000;
    await withDb(async (pool) => {
      const { rowCount } = await pool.query('DELETE FROM completed_games WHERE played_at < $1', [cutoff]);
      console.log('Purged ' + (rowCount ?? 0) + ' completed games older than ' + days + ' days');
    });
  });

/* ─── LIST ─── */

const listCmd = program.command('list').description('List resources: users, games, bans, tournaments');

listCmd
  .command('users')
  .description('List all registered users sorted by rating (descending)')
  .option('--json', 'Output raw JSON instead of a table')
  .option('-l, --limit <number>', 'Max results (default: 100, max: 1000)', '100')
  .option('-s, --sort <field>', 'Sort field: rating, username, wins', 'rating')
  .option('-a, --admin', 'Show only admin users')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin list users
  chess-admin list users --limit 5 --sort wins
  chess-admin list users --sort username --limit 50 --json
  chess-admin list users --admin

Output table columns: Username, Display Name, Rating, Wins, Losses, Draws, Admin
`,
  )
  .action(async (opts: { json?: boolean; limit: string; sort: string; admin?: boolean }) => {
    const limit = Math.min(1000, parseInt(opts.limit, 10) || 100);
    const allowed = ['rating', 'username', 'wins'];
    const orderCol = allowed.includes(opts.sort) ? opts.sort : 'rating';
    await withDb(async (pool) => {
      let query = 'SELECT username, display_name, rating, wins, losses, draws, is_admin FROM users';
      const params: unknown[] = [];
      if (opts.admin) {
        query += ' WHERE is_admin = true';
      }
      query += ' ORDER BY ' + orderCol + ' DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      const { rows } = await pool.query(query, params);
      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        console.log('Users (' + rows.length + '):');
        printTable(
          ['Username', 'Display Name', 'Rating', 'Wins', 'Losses', 'Draws', 'Admin'],
          (rows as Record<string, unknown>[]).map((r) => [
            String(r.username),
            String(r.display_name),
            String(r.rating),
            String(r.wins),
            String(r.losses),
            String(r.draws),
            r.is_admin ? 'yes' : '',
          ]),
        );
      }
    });
  });

listCmd
  .command('games')
  .description('List completed games from the archive (newest first)')
  .option('--json', 'Output raw JSON instead of a table')
  .option('-l, --limit <number>', 'Max results (default: 20, max: 200)', '20')
  .option('-p, --player <playerId>', 'Filter by player ID')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin list games
  chess-admin list games --limit 50
  chess-admin list games --player <uuid>
  chess-admin list games --limit 10 --json

Output table columns: ID (truncated), White, Black, Result, Date
`,
  )
  .action(async (opts: { json?: boolean; limit: string; player?: string }) => {
    const limit = Math.min(200, parseInt(opts.limit, 10) || 20);
    await withDb(async (pool) => {
      let query = 'SELECT id, white_display_name, black_display_name, result, status, played_at FROM completed_games';
      const params: unknown[] = [];
      if (opts.player) {
        query += ' WHERE white_player_id = $1 OR black_player_id = $1';
        params.push(opts.player);
      }
      query += ' ORDER BY played_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      const { rows } = await pool.query(query, params);
      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else if (rows.length === 0) {
        console.log('No games found');
      } else {
        printTable(
          ['ID', 'White', 'Black', 'Result', 'Date'],
          (rows as Record<string, unknown>[]).map((r) => [
            String(r.id).slice(0, 8) + '…',
            String(r.white_display_name).slice(0, 15),
            String(r.black_display_name).slice(0, 15),
            String(r.result),
            new Date(r.played_at as number).toISOString().slice(0, 10),
          ]),
        );
      }
    });
  });

listCmd
  .command('bans')
  .description('List all active player and IP bans (newest first)')
  .option('--json', 'Output raw JSON instead of a table')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin list bans
  chess-admin list bans --json

Output table columns: Type (Player/IP), Target, Banned At
`,
  )
  .action(async (opts: { json?: boolean }) => {
    await withDb(async (pool) => {
      const { rows } = await pool.query('SELECT player_id, ip, banned_at FROM bans ORDER BY banned_at DESC');
      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else if (rows.length === 0) {
        console.log('No bans');
      } else {
        printTable(
          ['Type', 'Target', 'Banned At'],
          (rows as { player_id: string | null; ip: string | null; banned_at: number }[]).map((r) => [
            r.player_id ? 'Player' : 'IP',
            r.player_id || r.ip || '?',
            new Date(r.banned_at).toISOString(),
          ]),
        );
      }
    });
  });

listCmd
  .command('reports')
  .description('List player reports (open/dismissed/resolved)')
  .option('--json', 'Output raw JSON instead of a table')
  .option('-s, --status <status>', 'Filter by status: open, dismissed, resolved')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin list reports
  chess-admin list reports --status open
  chess-admin list reports --status dismissed --json

Output table columns: ID, Reporter, Target, Reason, Status, Date
`,
  )
  .action(async (opts: { json?: boolean; status?: string }) => {
    await withDb(async (pool) => {
      let query =
        'SELECT r.id, r.reporter_id, r.target_id, r.game_id, r.reason, r.status, r.created_at, u1.display_name AS reporter_name, u2.display_name AS target_name FROM reports r LEFT JOIN users u1 ON u1.id = r.reporter_id LEFT JOIN users u2 ON u2.id = r.target_id';
      const params: unknown[] = [];
      if (opts.status) {
        params.push(opts.status);
        query += ' WHERE r.status = $1';
      }
      query += ' ORDER BY r.created_at DESC';
      const { rows } = await pool.query(query, params);
      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else if (rows.length === 0) {
        console.log('No reports found');
      } else {
        printTable(
          ['ID', 'Reporter', 'Target', 'Reason', 'Status', 'Date'],
          (rows as Record<string, unknown>[]).map((r) => [
            String(r.id).slice(0, 8) + '…',
            String(r.reporter_name || r.reporter_id).slice(0, 15),
            String(r.target_name || r.target_id).slice(0, 15),
            String(r.reason).slice(0, 25),
            String(r.status),
            new Date(r.created_at as number).toISOString().slice(0, 10),
          ]),
        );
      }
    });
  });

listCmd
  .command('tournaments')
  .description('List tournaments with player counts and status')
  .option('--json', 'Output raw JSON instead of a table')
  .option('-s, --status <status>', 'Filter by status: waiting, active, completed')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin list tournaments
  chess-admin list tournaments --status active
  chess-admin list tournaments --json

Output table columns: Name, Status, Players (count/max), Created
`,
  )
  .action(async (opts: { json?: boolean; status?: string }) => {
    await withDb(async (pool) => {
      let query = `SELECT t.id, t.name, t.status, t.max_players, t.created_at, COUNT(tp.id) AS players FROM tournaments t LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id`;
      const params: unknown[] = [];
      if (opts.status) {
        params.push(opts.status);
        query += ' WHERE t.status = $1';
      }
      query += ' GROUP BY t.id ORDER BY t.created_at DESC';
      const { rows } = await pool.query(query, params);
      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else if (rows.length === 0) {
        console.log('No tournaments found');
      } else {
        printTable(
          ['Name', 'Status', 'Players', 'Created'],
          (rows as Record<string, unknown>[]).map((r) => [
            String(r.name).slice(0, 20),
            String(r.status),
            String(r.players) + '/' + String(r.max_players),
            new Date(r.created_at as number).toISOString().slice(0, 10),
          ]),
        );
      }
    });
  });

/* ─── SHOW (detail) ─── */

const showCmd = program.command('show').description('Show resource details: user, game, tournament');

showCmd
  .command('user')
  .description('Show detailed info for a single user (rating, record, avatar, dates)')
  .requiredOption('-i, --id <userId>', 'User ID')
  .option('--json', 'Output raw JSON instead of formatted text')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin show user --id abc123
  chess-admin show user --id abc123 --json

Output fields: ID, username, display name, rating, W/L/D record, avatar URL, created date
`,
  )
  .action(async (opts: { id: string; json?: boolean }) => {
    await withDb(async (pool) => {
      const { rows } = await pool.query(
        'SELECT id, username, display_name, created_at, wins, losses, draws, rating, avatar_url, is_admin FROM users WHERE id = $1',
        [opts.id],
      );
      if (rows.length === 0) {
        console.error('User not found');
        process.exit(1);
      }
      const u = rows[0] as Record<string, unknown>;
      if (opts.json) {
        console.log(JSON.stringify(u, null, 2));
        return;
      }
      console.log('User: ' + u.username);
      console.log('  ID:      ' + u.id);
      console.log('  Name:    ' + u.display_name);
      console.log('  Rating:  ' + u.rating);
      console.log('  Record:  ' + u.wins + 'W / ' + u.losses + 'L / ' + u.draws + 'D');
      console.log('  Admin:   ' + (u.is_admin ? 'yes' : 'no'));
      console.log('  Avatar:  ' + (u.avatar_url || '(none)'));
      console.log('  Created: ' + new Date(u.created_at as number).toISOString());
    });
  });

showCmd
  .command('game')
  .description('Show full game details including PGN-style move list')
  .requiredOption('-i, --id <gameId>', 'Game ID')
  .option('--json', 'Output raw JSON instead of formatted text')
  .addHelpText(
    'after',
    `
Example:
  chess-admin show game --id abc123

Output fields: white/black players, result, winner, move count (ply), time control,
date, and a PGN-formatted move list.

Sample output:
  Game: abc123
    White:  Alice (uuid...)
    Black:  Bob (uuid...)
    Result: white (winner: white)
    Moves:  42 ply
    Time:   600+5
    Date:   2024-01-15T12:00:00.000Z
    PGN-like:
      1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...
`,
  )
  .action(async (opts: { id: string; json?: boolean }) => {
    await withDb(async (pool) => {
      const { rows } = await pool.query('SELECT * FROM completed_games WHERE id = $1', [opts.id]);
      if (rows.length === 0) {
        console.error('Game not found');
        process.exit(1);
      }
      const g = rows[0] as Record<string, unknown>;
      if (opts.json) {
        console.log(JSON.stringify(g, null, 2));
        return;
      }
      const moves = JSON.parse(String(g.move_history || '[]'));
      console.log('Game: ' + opts.id);
      console.log('  White:  ' + g.white_display_name + ' (' + (g.white_player_id || '?') + ')');
      console.log('  Black:  ' + g.black_display_name + ' (' + (g.black_player_id || '?') + ')');
      console.log('  Result: ' + g.result + (g.winner ? ' (winner: ' + g.winner + ')' : ''));
      console.log('  Moves:  ' + moves.length + ' ply');
      console.log('  Time:   ' + g.time_control);
      console.log('  Date:   ' + new Date(g.played_at as number).toISOString());
      if (moves.length > 0) {
        console.log('  PGN-like:');
        const line: string[] = [];
        for (let i = 0; i < moves.length; i++) {
          if (i % 2 === 0) line.push(String(Math.floor(i / 2) + 1) + '.');
          line.push(String(moves[i]));
          if (line.length >= 12) {
            console.log('    ' + line.join(' '));
            line.length = 0;
          }
        }
        if (line.length > 0) console.log('    ' + line.join(' '));
      }
    });
  });

showCmd
  .command('tournament')
  .description('Show tournament details with participants and bracket table')
  .requiredOption('-i, --id <tournamentId>', 'Tournament ID')
  .option('--json', 'Output raw JSON instead of formatted text')
  .addHelpText(
    'after',
    `
Example:
  chess-admin show tournament --id abc123

Output: tournament name, status, type, player count, winner, creation date,
then a bracket table with columns: Round, Position, White, Black, Winner, Status
`,
  )
  .action(async (opts: { id: string; json?: boolean }) => {
    await withDb(async (pool) => {
      const { rows: tRows } = await pool.query('SELECT * FROM tournaments WHERE id = $1', [opts.id]);
      if (tRows.length === 0) {
        console.error('Tournament not found');
        process.exit(1);
      }
      const t = tRows[0] as Record<string, unknown>;
      const { rows: participants } = await pool.query(
        'SELECT * FROM tournament_participants WHERE tournament_id = $1 ORDER BY seed',
        [opts.id],
      );
      const { rows: matches } = await pool.query(
        'SELECT * FROM tournament_matches WHERE tournament_id = $1 ORDER BY round, position',
        [opts.id],
      );
      if (opts.json) {
        console.log(JSON.stringify({ tournament: t, participants, matches }, null, 2));
        return;
      }
      console.log('Tournament: ' + t.name);
      console.log('  Status:  ' + t.status);
      console.log('  Type:    ' + t.type);
      console.log('  Field:   ' + participants.length + '/' + t.max_players + ' players');
      console.log('  Winner:  ' + (t.winner_id || '—'));
      console.log('  Created: ' + new Date(t.created_at as number).toISOString());
      if (matches.length > 0) {
        console.log('');
        console.log('Bracket:');
        printTable(
          ['Rnd', 'Pos', 'White', 'Black', 'Winner', 'Status'],
          (matches as Record<string, unknown>[]).map((m) => [
            String(m.round),
            String(m.position),
            String(m.white_player_id || '—').slice(0, 8),
            String(m.black_player_id || '—').slice(0, 8),
            String(m.winner_id || '—').slice(0, 8),
            String(m.status),
          ]),
        );
      }
    });
  });

showCmd
  .command('report')
  .description('Show full details of a report')
  .requiredOption('-i, --id <reportId>', 'Report ID')
  .option('--json', 'Output raw JSON instead of formatted text')
  .addHelpText(
    'after',
    `
Example:
  chess-admin show report --id abc123

Output fields: reporter, target, reason, game ID, status, created date,
reviewed by, reviewed date
`,
  )
  .action(async (opts: { id: string; json?: boolean }) => {
    await withDb(async (pool) => {
      const { rows } = await pool.query(
        `SELECT r.*, u1.display_name AS reporter_name, u2.display_name AS target_name
         FROM reports r
         LEFT JOIN users u1 ON u1.id = r.reporter_id
         LEFT JOIN users u2 ON u2.id = r.target_id
         WHERE r.id = $1`,
        [opts.id],
      );
      if (rows.length === 0) {
        console.error('Report not found');
        process.exit(1);
      }
      const r = rows[0] as Record<string, unknown>;
      if (opts.json) {
        console.log(JSON.stringify(r, null, 2));
        return;
      }
      console.log('Report: ' + opts.id);
      console.log('  Reporter: ' + (r.reporter_name || r.reporter_id));
      console.log('  Target:   ' + (r.target_name || r.target_id));
      console.log('  Reason:   ' + r.reason);
      console.log('  Game ID:  ' + (r.game_id || '(none)'));
      console.log('  Status:   ' + r.status);
      console.log('  Created:  ' + new Date(r.created_at as number).toISOString());
      console.log(
        '  Reviewed: ' +
          (r.reviewed_by ? r.reviewed_by + ' at ' + new Date(r.reviewed_at as number).toISOString() : '(not yet)'),
      );
    });
  });

/* ─── REPORT ACTIONS ─── */

const reportCmd = program.command('report').description('Manage player reports: dismiss, resolve, ban');

reportCmd
  .command('dismiss')
  .description('Dismiss a report (mark as dismissed without action)')
  .requiredOption('-i, --id <reportId>', 'Report ID')
  .addHelpText(
    'after',
    `
Example:
  chess-admin report dismiss --id abc123

Output:
  Report abc123... dismissed
`,
  )
  .action(async (opts: { id: string }) => {
    await withDb(async (pool) => {
      const { rowCount } = await pool.query(
        'UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4',
        ['dismissed', 'admin', Date.now(), opts.id],
      );
      if (rowCount === 0) {
        console.error('Report not found');
        process.exit(1);
      }
      console.log('Report ' + opts.id.slice(0, 8) + '… dismissed');
    });
  });

reportCmd
  .command('resolve')
  .description('Resolve a report (mark as resolved with action taken)')
  .requiredOption('-i, --id <reportId>', 'Report ID')
  .addHelpText(
    'after',
    `
Example:
  chess-admin report resolve --id abc123

Output:
  Report abc123... resolved
`,
  )
  .action(async (opts: { id: string }) => {
    await withDb(async (pool) => {
      const { rowCount } = await pool.query(
        'UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4',
        ['resolved', 'admin', Date.now(), opts.id],
      );
      if (rowCount === 0) {
        console.error('Report not found');
        process.exit(1);
      }
      console.log('Report ' + opts.id.slice(0, 8) + '… resolved');
    });
  });

reportCmd
  .command('ban')
  .description('Ban the reported player and resolve the report')
  .requiredOption('-i, --id <reportId>', 'Report ID')
  .addHelpText(
    'after',
    `
Example:
  chess-admin report ban --id abc123

Output:
  Report abc123... banned target and resolved
`,
  )
  .action(async (opts: { id: string }) => {
    await withDb(async (pool) => {
      const { rows } = await pool.query('SELECT target_id FROM reports WHERE id = $1', [opts.id]);
      if (rows.length === 0) {
        console.error('Report not found');
        process.exit(1);
      }
      const targetId = (rows[0] as { target_id: string }).target_id;
      const banId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO bans (id, player_id, ip, banned_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [banId, targetId, null, Date.now()],
      );
      await pool.query('UPDATE reports SET status = $1, reviewed_by = $2, reviewed_at = $3 WHERE id = $4', [
        'resolved',
        'admin',
        Date.now(),
        opts.id,
      ]);
      console.log('Report ' + opts.id.slice(0, 8) + '… banned target and resolved');
    });
  });

/* ─── SEARCH ─── */

const searchCmd = program.command('search').description('Search users by username or display name (case-insensitive)');

searchCmd
  .argument('<query>', 'Search term (partial matches supported)')
  .option('--json', 'Output raw JSON instead of a table')
  .option('-l, --limit <number>', 'Max results (default: 20, max: 100)', '20')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin search alice
  chess-admin search "bob" --json
  chess-admin search smith --limit 5

Uses PostgreSQL ILIKE for case-insensitive partial matching.
Output table columns: Username, Display Name, Rating, W/L/D
`,
  )
  .action(async (query: string, opts: { json?: boolean; limit: string }) => {
    const limit = Math.min(100, parseInt(opts.limit, 10) || 20);
    const pattern = '%' + query.replace(/[%_]/g, '\\$&') + '%';
    await withDb(async (pool) => {
      const { rows } = await pool.query(
        'SELECT username, display_name, rating, wins, losses, draws FROM users WHERE username ILIKE $1 OR display_name ILIKE $1 LIMIT $2',
        [pattern, limit],
      );
      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else if (rows.length === 0) {
        console.log('No users matching "' + query + '"');
      } else {
        console.log('Found ' + rows.length + ' user(s):');
        printTable(
          ['Username', 'Display Name', 'Rating', 'W/L/D'],
          (rows as Record<string, unknown>[]).map((r) => [
            String(r.username),
            String(r.display_name),
            String(r.rating),
            String(r.wins) + '/' + String(r.losses) + '/' + String(r.draws),
          ]),
        );
      }
    });
  });

/* ─── BAN / UNBAN ─── */

program
  .command('ban')
  .description('Ban a player by user ID')
  .requiredOption('-i, --id <playerId>', 'Player ID to ban')
  .option('-r, --reason <reason>', 'Ban reason (logged to console, not stored in DB)')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin ban --id abc123
  chess-admin ban --id abc123 --reason "Cheating / multiple accounts"

Note: The ban prevents the player from logging in or creating games.
Use 'list bans' to see all active bans.
`,
  )
  .action(async (opts: { id: string; reason?: string }) => {
    const banId = crypto.randomUUID();
    await withDb(async (pool) => {
      await pool.query(
        'INSERT INTO bans (id, player_id, ip, banned_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [banId, opts.id, null, Date.now()],
      );
      console.log('Player banned: ' + opts.id + (opts.reason ? ' (' + opts.reason + ')' : ''));
    });
  });

program
  .command('ban-ip')
  .description('Ban an IP address (IPv4 or IPv6)')
  .requiredOption('-a, --address <ip>', 'IP address to ban (e.g. 192.168.1.1 or 2001:db8::1)')
  .option('-r, --reason <reason>', 'Ban reason (logged to console, not stored in DB)')
  .addHelpText(
    'after',
    `
Example:
  chess-admin ban-ip --address 192.168.1.1
  chess-admin ban-ip --address 2001:db8::1

Note: IP bans block all connections from that address regardless of user ID.
Use 'list bans' to see all active bans.
`,
  )
  .action(async (opts: { address: string; reason?: string }) => {
    const banId = crypto.randomUUID();
    await withDb(async (pool) => {
      await pool.query(
        'INSERT INTO bans (id, player_id, ip, banned_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [banId, null, opts.address, Date.now()],
      );
      console.log('IP banned: ' + opts.address + (opts.reason ? ' (' + opts.reason + ')' : ''));
    });
  });

program
  .command('unban')
  .description('Remove a player ban by user ID')
  .requiredOption('-i, --id <playerId>', 'Player ID to unban')
  .addHelpText(
    'after',
    `
Example:
  chess-admin unban --id abc123

Output on success:
  Player unbanned: abc123

Output if no ban exists:
  No ban found for abc123
`,
  )
  .action(async (opts: { id: string }) => {
    await withDb(async (pool) => {
      const { rowCount } = await pool.query('DELETE FROM bans WHERE player_id = $1', [opts.id]);
      console.log((rowCount ?? 0) > 0 ? 'Player unbanned: ' + opts.id : 'No ban found for ' + opts.id);
    });
  });

/* ─── SET-RATING ─── */

program
  .command('set-rating')
  .description("Set a user's Elo rating to a specific value")
  .requiredOption('-i, --id <userId>', 'User ID')
  .requiredOption('-r, --rating <number>', 'New rating value (must be >= 0)')
  .addHelpText(
    'after',
    `
Example:
  chess-admin set-rating --id abc123 --rating 1500

Output:
  Rating updated for abc123 -> 1500

Note: This overrides the rating directly. The user will not lose this rating
from future games unless they play (Elo gain/loss is computed normally).
`,
  )
  .action(async (opts: { id: string; rating: string }) => {
    const rating = Math.max(0, parseInt(opts.rating, 10));
    if (isNaN(rating)) {
      console.error('Invalid rating');
      process.exit(1);
    }
    await withDb(async (pool) => {
      await pool.query('UPDATE users SET rating = $1 WHERE id = $2', [rating, opts.id]);
      console.log('Rating updated for ' + opts.id + ' -> ' + rating);
    });
  });

/* ─── EDIT USER ─── */

const editCmd = program.command('edit').description('Edit a resource: user');

editCmd
  .command('user')
  .description('Update user fields (wins, losses, draws, admin status, username, display name, rating)')
  .requiredOption('-i, --id <userId>', 'User ID')
  .option('-w, --wins <number>', 'Set win count')
  .option('-l, --losses <number>', 'Set loss count')
  .option('-d, --draws <number>', 'Set draw count')
  .option('-a, --admin <boolean>', 'Set admin status (true/false)')
  .option('-u, --username <username>', 'Change username')
  .option('-n, --display-name <name>', 'Change display name')
  .option('-r, --rating <number>', 'Set Elo rating')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin edit user --id abc123 --wins 10 --losses 2 --draws 1
  chess-admin edit user --id abc123 --admin true
  chess-admin edit user --id abc123 --username newname --display-name "New Name"
  chess-admin edit user --id abc123 --rating 1500

Output:
  User abc123 updated: wins=10 losses=2 draws=1
`,
  )
  .action(
    async (opts: {
      id: string;
      wins?: string;
      losses?: string;
      draws?: string;
      admin?: string;
      username?: string;
      displayName?: string;
      rating?: string;
    }) => {
      await withDb(async (pool) => {
        const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [opts.id]);
        if (rows.length === 0) {
          console.error('User not found');
          process.exit(1);
        }

        const sets: string[] = [];
        const params: unknown[] = [];
        let idx = 1;
        const changes: string[] = [];

        if (opts.wins !== undefined) {
          const v = parseInt(opts.wins, 10);
          if (isNaN(v) || v < 0) {
            console.error('Invalid wins');
            process.exit(1);
          }
          sets.push('wins = $' + idx++);
          params.push(v);
          changes.push('wins=' + v);
        }
        if (opts.losses !== undefined) {
          const v = parseInt(opts.losses, 10);
          if (isNaN(v) || v < 0) {
            console.error('Invalid losses');
            process.exit(1);
          }
          sets.push('losses = $' + idx++);
          params.push(v);
          changes.push('losses=' + v);
        }
        if (opts.draws !== undefined) {
          const v = parseInt(opts.draws, 10);
          if (isNaN(v) || v < 0) {
            console.error('Invalid draws');
            process.exit(1);
          }
          sets.push('draws = $' + idx++);
          params.push(v);
          changes.push('draws=' + v);
        }
        if (opts.admin !== undefined) {
          const v = opts.admin === 'true' || opts.admin === '1';
          sets.push('is_admin = $' + idx++);
          params.push(v);
          changes.push('admin=' + v);
        }
        if (opts.username !== undefined) {
          if (opts.username.length < 2 || opts.username.length > 30) {
            console.error('Username must be 2-30 characters');
            process.exit(1);
          }
          sets.push('username = $' + idx++);
          params.push(opts.username);
          changes.push('username=' + opts.username);
        }
        if (opts.displayName !== undefined) {
          sets.push('display_name = $' + idx++);
          params.push(opts.displayName);
          changes.push('display_name=' + opts.displayName);
        }
        if (opts.rating !== undefined) {
          const v = parseInt(opts.rating, 10);
          if (isNaN(v) || v < 0) {
            console.error('Invalid rating');
            process.exit(1);
          }
          sets.push('rating = $' + idx++);
          params.push(v);
          changes.push('rating=' + v);
        }

        if (sets.length === 0) {
          console.error('No fields to update');
          process.exit(1);
        }

        params.push(opts.id);
        await pool.query('UPDATE users SET ' + sets.join(', ') + ' WHERE id = $' + idx, params);
        console.log('User ' + opts.id + ' updated: ' + changes.join(' '));
      });
    },
  );

/* ─── DB ─── */

const dbCmd = program.command('db').description('Database operations (backup, restore, migrate)');

dbCmd
  .command('backup')
  .description('Create a PostgreSQL custom-format dump backup via pg_dump')
  .option('-d, --dir <path>', 'Output directory (default: ./backups/)', path.join(process.cwd(), 'backups'))
  .addHelpText(
    'after',
    `
Examples:
  chess-admin db backup
  chess-admin db backup --dir /tmp

Creates a timestamped .dump file (custom format, -Fc) in the output directory.
Output:
  Backup created: /path/to/backups/chess-2024-01-01T12-00-00.dump

Requires: pg_dump on PATH, DATABASE_URL env var.
`,
  )
  .action(async (opts: { dir: string }) => {
    const dir = path.resolve(opts.dir);
    fs.mkdirSync(dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(dir, `chess-${timestamp}.dump`);
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    try {
      await execFileAsync('pg_dump', ['--dbname=' + getDbUrl(), '-Fc', '-f', backupPath], { timeout: 60000 });
      console.log('Backup created: ' + backupPath);
    } catch (err) {
      console.error('Backup failed:', err);
      process.exit(1);
    }
  });

dbCmd
  .command('restore')
  .description('Restore database from a custom-format (.dump) backup via pg_restore')
  .argument('<file>', 'Path to the .dump backup file')
  .option('-c, --clean', 'Drop existing database objects before restore')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin db restore backups/chess-2024-01-01.dump
  chess-admin db restore /tmp/backup.dump --clean

Output:
  Restored from: /path/to/backups/chess-2024-01-01.dump

Requires: pg_restore on PATH, DATABASE_URL env var.
Warning: Restoring overwrites data. Use --clean to drop existing tables first.
`,
  )
  .action(async (file: string, opts: { clean?: boolean }) => {
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) {
      console.error('File not found: ' + fullPath);
      process.exit(1);
    }
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    try {
      const args = ['--dbname=' + getDbUrl()];
      if (opts.clean) args.push('-c');
      args.push(fullPath);
      await execFileAsync('pg_restore', args, { timeout: 120000 });
      console.log('Restored from: ' + fullPath);
    } catch (err) {
      console.error('Restore failed:', err);
      process.exit(1);
    }
  });

dbCmd
  .command('migrate')
  .description('Run all pending database migrations (idempotent, safe to run multiple times)')
  .addHelpText(
    'after',
    `
Example:
  chess-admin db migrate

Runs migrations 1-8: schema creation, indexes, chat tables, group ownership,
unread message tracking, reports/admin, and settings. Each migration runs
only if not yet applied.

Output:
  1 (schema)
  2 (jsonb-to-text)
  3 (indexes)
  4 (chat-schema)
  5 (group-owner)
  6 (unread-read-at)
  7 (reports)
  8 (settings)
  All 8 migrations applied
`,
  )
  .action(async () => {
    await withDb(async (pool) => {
      await pool.query(
        'CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
      );
      const { rows: existing } = await pool.query('SELECT version FROM _migrations ORDER BY version');
      const applied = new Set((existing as { version: number }[]).map((r) => r.version));
      const migrations: { version: number; name: string; sql: string }[] = [
        {
          version: 1,
          name: 'schema',
          sql: `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT, display_name TEXT NOT NULL, created_at BIGINT NOT NULL, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0, avatar_url TEXT DEFAULT NULL, rating INTEGER NOT NULL DEFAULT 1200); CREATE TABLE IF NOT EXISTS user_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at BIGINT NOT NULL); CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id); CREATE TABLE IF NOT EXISTS bans (id TEXT PRIMARY KEY, player_id TEXT, ip TEXT, banned_at BIGINT NOT NULL); CREATE TABLE IF NOT EXISTS friend_requests (id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL REFERENCES users(id), to_user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL); CREATE TABLE IF NOT EXISTS friends (user_id TEXT NOT NULL REFERENCES users(id), friend_id TEXT NOT NULL REFERENCES users(id), created_at BIGINT NOT NULL, PRIMARY KEY (user_id, friend_id)); CREATE TABLE IF NOT EXISTS completed_games (id TEXT PRIMARY KEY, white_player_id TEXT, black_player_id TEXT, white_display_name TEXT NOT NULL DEFAULT '', black_display_name TEXT NOT NULL DEFAULT '', winner TEXT, status TEXT NOT NULL, result TEXT NOT NULL, reason TEXT, move_history TEXT NOT NULL DEFAULT '[]', board_history TEXT NOT NULL DEFAULT '[]', pgn TEXT, played_at BIGINT NOT NULL, time_control TEXT NOT NULL DEFAULT ''); CREATE TABLE IF NOT EXISTS tournaments (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting', created_by TEXT NOT NULL REFERENCES users(id), max_players INTEGER NOT NULL DEFAULT 8, is_private BOOLEAN NOT NULL DEFAULT false, join_code TEXT, created_at BIGINT NOT NULL, started_at BIGINT, completed_at BIGINT, winner_id TEXT REFERENCES users(id), type TEXT NOT NULL DEFAULT 'single_elimination', participant_data JSONB NOT NULL DEFAULT '[]'::jsonb, match_data JSONB NOT NULL DEFAULT '[]'::jsonb); CREATE TABLE IF NOT EXISTS tournament_participants (id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL REFERENCES tournaments(id), player_id TEXT NOT NULL REFERENCES users(id), display_name TEXT NOT NULL DEFAULT '', seed INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL); CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id); CREATE TABLE IF NOT EXISTS tournament_matches (id TEXT PRIMARY KEY, tournament_id TEXT NOT NULL REFERENCES tournaments(id), round INTEGER NOT NULL, position INTEGER NOT NULL, white_player_id TEXT, black_player_id TEXT, game_id TEXT, winner_id TEXT, status TEXT NOT NULL DEFAULT 'pending'); CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);`,
        },
        {
          version: 2,
          name: 'jsonb-to-text',
          sql: `ALTER TABLE completed_games ALTER COLUMN move_history TYPE TEXT; ALTER TABLE completed_games ALTER COLUMN board_history TYPE TEXT;`,
        },
        {
          version: 3,
          name: 'indexes',
          sql: `CREATE INDEX IF NOT EXISTS idx_bans_player_id ON bans(player_id); CREATE INDEX IF NOT EXISTS idx_bans_ip ON bans(ip); CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating); CREATE INDEX IF NOT EXISTS idx_tournaments_join_code ON tournaments(join_code); CREATE INDEX IF NOT EXISTS idx_tournament_participants_player ON tournament_participants(player_id); CREATE INDEX IF NOT EXISTS idx_user_tokens_created_at ON user_tokens(created_at);`,
        },
        {
          version: 4,
          name: 'chat-schema',
          sql: `CREATE TABLE IF NOT EXISTS chat_conversations (id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('lobby', 'private', 'group', 'game')), name TEXT, created_at BIGINT NOT NULL, last_message_at BIGINT NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS chat_conversation_members (conversation_id TEXT NOT NULL REFERENCES chat_conversations(id), user_id TEXT NOT NULL REFERENCES users(id), joined_at BIGINT NOT NULL, PRIMARY KEY (conversation_id, user_id)); CREATE INDEX IF NOT EXISTS idx_conv_members_user ON chat_conversation_members(user_id); CREATE TABLE IF NOT EXISTS chat_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES chat_conversations(id), sender_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, created_at BIGINT NOT NULL); CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, created_at);`,
        },
        {
          version: 5,
          name: 'group-owner',
          sql: `ALTER TABLE chat_conversations ADD COLUMN owner_id TEXT REFERENCES users(id); ALTER TABLE chat_conversation_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member'));`,
        },
        {
          version: 6,
          name: 'unread-read-at',
          sql: `ALTER TABLE chat_conversation_members ADD COLUMN last_read_at BIGINT DEFAULT 0;`,
        },
        {
          version: 7,
          name: 'reports',
          sql: `ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false; CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id), target_id TEXT NOT NULL REFERENCES users(id), game_id TEXT, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'resolved')), created_at BIGINT NOT NULL, reviewed_by TEXT, reviewed_at BIGINT); CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status); CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_id);`,
        },
        {
          version: 8,
          name: 'settings',
          sql: `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at BIGINT NOT NULL);`,
        },
        {
          version: 9,
          name: 'warnings',
          sql: `CREATE TABLE IF NOT EXISTS warnings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), message TEXT NOT NULL, created_at BIGINT NOT NULL, read_at BIGINT); CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id);`,
        },
      ];
      for (const m of migrations) {
        if (!applied.has(m.version)) {
          await pool.query(m.sql);
          await pool.query('INSERT INTO _migrations (version) VALUES ($1)', [m.version]);
          console.log('  v' + m.version + ' (' + m.name + ')');
        }
      }
      console.log('All ' + migrations.length + ' migrations applied');
    });
  });

/* ─── HEALTH ─── */

program
  .command('health')
  .description('Check server health via the /health HTTP endpoint (port 25565)')
  .option('--json', 'Output raw JSON instead of formatted text')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin health
  chess-admin health --json

Output:
  Status: ok
    Uptime:  3600s
    Games:   5 active
    Online:  12 players
    WS:      8 connections
    DB:      connected (2ms)
    Redis:   enabled
    Memory:  128MB RSS / 64MB heap

Requires: Chess API server running on the configured PORT (default 25565).
`,
  )
  .action(async (opts: { json?: boolean }) => {
    try {
      const resp = await fetch('http://localhost:25565/health');
      const data = (await resp.json()) as Record<string, unknown>;
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      console.log('Status: ' + data.status);
      console.log('  Uptime:  ' + Math.floor(data.uptime as number) + 's');
      console.log('  Games:   ' + data.gamesActive + ' active');
      console.log('  Online:  ' + data.playersOnline + ' players');
      console.log('  WS:      ' + data.wsConnections + ' connections');
      const dbInfo = data.database as Record<string, unknown>;
      console.log('  DB:      ' + (dbInfo.connected ? 'connected' : 'disconnected') + ' (' + dbInfo.latencyMs + 'ms)');
      const redisInfo = data.redis as Record<string, unknown>;
      console.log('  Redis:   ' + (redisInfo.enabled ? 'enabled' : 'disabled'));
      const mem = data.memory as Record<string, unknown>;
      console.log(
        '  Memory:  ' +
          Math.round((mem.rss as number) / 1024 / 1024) +
          'MB RSS / ' +
          Math.round((mem.heapUsed as number) / 1024 / 1024) +
          'MB heap',
      );
    } catch {
      console.error('Server not reachable on http://localhost:25565/health. Is it running?');
      process.exit(1);
    }
  });

/* ─── STATS ─── */

program
  .command('stats')
  .description('Show aggregated server statistics from the database')
  .option('--json', 'Output raw JSON instead of formatted text')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin stats
  chess-admin stats --json

Output:
  Server statistics:
    Users:       150
    Games:       1240 total, 980 finished
    Tournaments: 3 active

    Top 5 players:
    +---+----------+--------+-----------+
    | # | Username | Rating | W/L/D     |
    +---+----------+--------+-----------+
    | 1 | gm_magnus| 2850   | 42/3/12   |
    ...
    +---+----------+--------+-----------+
`,
  )
  .action(async (opts: { json?: boolean }) => {
    await withDb(async (pool) => {
      const { rows: uc } = await pool.query('SELECT COUNT(*) AS c FROM users');
      const { rows: gc } = await pool.query(
        'SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE winner IS NOT NULL) AS finished FROM completed_games',
      );
      const { rows: top } = await pool.query(
        'SELECT username, rating, wins, losses, draws FROM users ORDER BY rating DESC LIMIT 5',
      );
      const { rows: activeT } = await pool.query("SELECT COUNT(*) AS c FROM tournaments WHERE status = 'active'");
      const data = {
        totalUsers: (uc[0] as { c: number }).c,
        totalGames: (gc[0] as { total: number }).total,
        finishedGames: (gc[0] as { finished: number }).finished,
        activeTournaments: (activeT[0] as { c: number }).c,
        topPlayers: top as { username: string; rating: number; wins: number; losses: number; draws: number }[],
      };
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      console.log('Server statistics:');
      console.log('  Users:     ' + data.totalUsers);
      console.log('  Games:     ' + data.totalGames + ' total, ' + data.finishedGames + ' finished');
      console.log('  Tournaments: ' + data.activeTournaments + ' active');
      if (data.topPlayers.length > 0) {
        console.log('');
        console.log('Top 5 players:');
        printTable(
          ['#', 'Username', 'Rating', 'W/L/D'],
          data.topPlayers.map((p, i) => [
            String(i + 1),
            p.username,
            String(p.rating),
            p.wins + '/' + p.losses + '/' + p.draws,
          ]),
        );
      }
    });
  });

/* ─── CONFIG ─── */

program
  .command('config')
  .description('Show current environment configuration (secrets masked)')
  .option('--json', 'Output raw JSON instead of formatted text')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin config
  chess-admin config --json

Output:
  DATABASE_URL                    = postgresql://chess:chess@localhost:5432/chess
  REDIS_URL                       = (not set)
  PORT                            = 25565
  LOG_LEVEL                       = info
  SENTRY_DSN                      = ***
  CAPTCHA_SECRET_KEY              = ***
  ...

Secrets (keys containing SECRET or PASSWORD) are masked as "***".
`,
  )
  .action((opts: { json?: boolean }) => {
    const keys = [
      'DATABASE_URL',
      'REDIS_URL',
      'PORT',
      'HOST',
      'CORS_ORIGIN',
      'NODE_ENV',
      'LOG_LEVEL',
      'LOG_FORMAT',
      'SENTRY_DSN',
      'CAPTCHA_SECRET_KEY',
      'DISABLE_METRICS',
      'DISABLE_FILE_PERSISTENCE',
      'MAX_GAMES_PER_PLAYER',
      'ADMIN_PASSWORD',
      'STOCKFISH_THREADS',
      'STOCKFISH_HASH_SIZE',
      'CHAT_MAX_LENGTH',
      'MAX_BODY_SIZE',
    ];
    const config: Record<string, string | undefined> = {};
    for (const k of keys) config[k] = process.env[k];
    if (opts.json) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }
    let max = 0;
    for (const k of keys) if (k.length > max) max = k.length;
    console.log('Configuration (from environment):');
    for (const k of keys) {
      const val = config[k];
      const display = val ? (k.includes('SECRET') || k.includes('PASSWORD') ? '***' : val) : '(not set)';
      console.log('  ' + k.padEnd(max + 1) + '= ' + display);
    }
  });

/* ─── MAINTENANCE ─── */

program
  .command('maintenance')
  .description('Toggle maintenance mode (on/off)')
  .argument('<state>', 'on or off')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin maintenance on
  chess-admin maintenance off

Output:
  Maintenance mode enabled
  Maintenance mode disabled
`,
  )
  .action(async (state: string) => {
    if (state !== 'on' && state !== 'off') {
      console.error('Usage: chess-admin maintenance <on|off>');
      process.exit(1);
    }
    const value = state === 'on' ? 'true' : 'false';
    await withDb(async (pool) => {
      await pool.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3',
        ['maintenance_mode', value, Date.now()],
      );
      console.log('Maintenance mode ' + (state === 'on' ? 'enabled' : 'disabled'));
    });
  });

/* ─── ANNOUNCE ─── */

program
  .command('announce')
  .description('Broadcast a message to all connected players via the running server')
  .requiredOption('-m, --message <text>', 'Message text to broadcast')
  .option('-s, --server <url>', 'Server URL (default: http://localhost:25565)', 'http://localhost:25565')
  .option('-p, --password <password>', 'Admin password (defaults to ADMIN_PASSWORD env var)')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin announce --message "Server restart in 5 minutes"
  chess-admin announce --message "Maintenance tonight at 2am" --password mypass

Output:
  Login OK — broadcasting message...
  Sent to 12 players

Requires: Chess API server running on the configured port (default 25565).
Uses /admin/api/login and /admin/api/broadcast endpoints.
`,
  )
  .action(async (opts: { message: string; server: string; password?: string }) => {
    const password = opts.password || process.env.ADMIN_PASSWORD;
    if (!password) {
      console.error('Admin password required via --password or ADMIN_PASSWORD env var');
      process.exit(1);
    }
    const baseUrl = opts.server.replace(/\/+$/, '');
    try {
      const loginRes = await fetch(baseUrl + '/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.ADMIN_USERNAME || 'admin', password }),
      });
      if (!loginRes.ok) {
        console.error('Login failed (HTTP ' + loginRes.status + '): ' + (await loginRes.text()));
        process.exit(1);
      }
      const { token } = (await loginRes.json()) as { token: string };
      const broadcastRes = await fetch(baseUrl + '/admin/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ message: opts.message }),
      });
      if (!broadcastRes.ok) {
        console.error('Broadcast failed (HTTP ' + broadcastRes.status + '): ' + (await broadcastRes.text()));
        process.exit(1);
      }
      const result = (await broadcastRes.json()) as { recipientCount?: number };
      console.log('Sent to ' + (result.recipientCount ?? '?') + ' players');
    } catch (err) {
      console.error(
        'Failed to connect to server at ' + baseUrl + ': ' + (err instanceof Error ? err.message : String(err)),
      );
      process.exit(1);
    }
  });

/* ─── WARN ─── */

program
  .command('warn')
  .description('Send an in-app warning notification to a player via the running server')
  .requiredOption('-i, --id <userId>', 'User ID to warn')
  .requiredOption('-m, --message <text>', 'Warning message')
  .option('-s, --server <url>', 'Server URL (default: http://localhost:25565)', 'http://localhost:25565')
  .option('-p, --password <password>', 'Admin password (defaults to ADMIN_PASSWORD env var)')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin warn --id abc123 --message "Please follow the rules"
  chess-admin warn --id abc123 --message "Warning: unsportsmanlike conduct" --password mypass

Output:
  Warning sent to user abc123...

Requires: Chess API server running. Uses /admin/api/warn endpoint.
`,
  )
  .action(async (opts: { id: string; message: string; server: string; password?: string }) => {
    const password = opts.password || process.env.ADMIN_PASSWORD;
    if (!password) {
      console.error('Admin password required via --password or ADMIN_PASSWORD env var');
      process.exit(1);
    }
    const baseUrl = opts.server.replace(/\/+$/, '');
    try {
      const loginRes = await fetch(baseUrl + '/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.ADMIN_USERNAME || 'admin', password }),
      });
      if (!loginRes.ok) {
        console.error('Login failed (HTTP ' + loginRes.status + ')' + (await loginRes.text()));
        process.exit(1);
      }
      const { token } = (await loginRes.json()) as { token: string };
      const warnRes = await fetch(baseUrl + '/admin/api/warn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ userId: opts.id, message: opts.message }),
      });
      if (!warnRes.ok) {
        const body = await warnRes.text();
        console.error('Warn failed (HTTP ' + warnRes.status + '): ' + body);
        process.exit(1);
      }
      console.log('Warning sent to user ' + opts.id.slice(0, 8) + '…');
    } catch (err) {
      console.error(
        'Failed to connect to server at ' + baseUrl + ': ' + (err instanceof Error ? err.message : String(err)),
      );
      process.exit(1);
    }
  });

/* ─── SET ENV ─── */

const setCmd = program
  .command('set')
  .description('Set runtime configuration values (temporary — does not survive restart)');

setCmd
  .command('env')
  .description('Set a runtime env override stored in DB. Use actual env vars for permanent changes.')
  .requiredOption('-k, --key <key>', 'Configuration key (e.g. MAX_GAMES_PER_PLAYER)')
  .requiredOption('-v, --value <value>', 'Configuration value')
  .addHelpText(
    'after',
    `
Examples:
  chess-admin set env --key MAX_GAMES_PER_PLAYER --value 10
  chess-admin set env --key CHAT_MAX_LENGTH --value 200

Output:
  MAX_GAMES_PER_PLAYER = 10 (runtime override set)

Note: This stores the value in the database as a runtime override.
It does NOT change the actual environment — permanent changes must
be made via the .env file or the process environment.
`,
  )
  .action(async (opts: { key: string; value: string }) => {
    await withDb(async (pool) => {
      await pool.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3',
        ['config.' + opts.key, opts.value, Date.now()],
      );
      console.log(opts.key + ' = ' + opts.value + ' (runtime override set)');
    });
  });

/* ─── Parse ─── */

if (process.env.DISABLE_CLI === 'true' || process.env.DISABLE_CLI === '1') {
  console.error('CLI is disabled (DISABLE_CLI is set)');
  process.exit(1);
}

program.parse(process.argv);
