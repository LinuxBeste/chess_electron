import { useEffect, useState } from 'react';
import { Trophy, Filter } from 'lucide-react';
import { api } from './api';
import Pagination from './Pagination';
import SearchBar from './SearchBar';
import PlayerViewModal from './PlayerViewModal';

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

// win rate vs 50% baseline, null until 10+ games for statistical significance
function ratingChange(entry: LeaderboardEntry): number | null {
  const total = entry.wins + entry.losses + entry.draws;
  if (total < 10) return null;
  const expected = entry.wins / total;
  return Math.round((expected - 0.5) * 100);
}

export default function LeaderboardTab() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [minGames, setMinGames] = useState('');
  const [sortKey, setSortKey] = useState('rating');
  const [sortAsc, setSortAsc] = useState(false);
  const [viewAccount, setViewAccount] = useState<string | null>(null);

  function load() {
    let path = '/leaderboard?page=' + page + '&limit=' + limit;
    const mg = parseInt(minGames, 10);
    if (mg > 0) path += '&minGames=' + mg;
    const sortParam = sortKey === 'rank' ? 'rating' : sortKey; // rank sort maps to rating on the server
    path += '&sortKey=' + sortParam + '&sortAsc=' + sortAsc;
    api<{ entries: LeaderboardEntry[]; total: number }>(path)
      .then((d) => {
        setEntries(d.entries);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message));
  }

  // refetch when any filter, sort, or page changes
  useEffect(load, [page, limit, minGames, sortKey, sortAsc]);

  const filtered = query
    ? entries.filter(
        (e) =>
          e.username?.toLowerCase().includes(query.toLowerCase()) ||
          e.displayName?.toLowerCase().includes(query.toLowerCase()),
      )
    : entries;

  const totalPages = Math.ceil(total / limit);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
            <Trophy size={16} className="text-yellow-400" />
            Leaderboard
            <span className="text-xs font-normal text-[#666]">({total} players)</span>
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-[#555]" />
              <input
                type="number"
                min={0}
                value={minGames}
                onChange={(e) => {
                  setMinGames(e.target.value);
                  setPage(1);
                }}
                placeholder="Min games"
                className="w-20 px-2 py-1.5 text-xs bg-[#1a1a1a] border border-[#333] rounded text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff]"
              />
            </div>
            <div className="w-64">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Filter by name..."
                sortOptions={[
                  { key: 'rank', label: 'Rank' },
                  { key: 'rating', label: 'Rating' },
                  { key: 'wins', label: 'Wins' },
                  { key: 'games', label: 'Games' },
                  { key: 'username', label: 'Name' },
                ]}
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSortChange={(k, a) => {
                  setSortKey(k);
                  setSortAsc(a);
                }}
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          {filtered.length === 0 ? (
            <p className="text-[#666] text-center py-8">{query ? 'No matching players.' : 'No leaderboard data.'}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#888] uppercase text-xs tracking-wider border-b border-[#2a2a2a]">
                      <th className="text-center px-3 py-2.5 w-12">#</th>
                      <th className="text-left px-4 py-2.5">Player</th>
                      <th className="text-center px-3 py-2.5">Rating</th>
                      <th className="text-center px-3 py-2.5">±</th>
                      <th className="text-center px-3 py-2.5">W</th>
                      <th className="text-center px-3 py-2.5">L</th>
                      <th className="text-center px-3 py-2.5">D</th>
                      <th className="text-center px-3 py-2.5">Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => {
                      const totalGames = e.wins + e.losses + e.draws;
                      const winPct = totalGames > 0 ? ((e.wins / totalGames) * 100).toFixed(1) : '—';
                      const change = ratingChange(e);
                      // gold / silver / bronze medal colors for top 3
                      const rankColor =
                        e.rank === 1
                          ? 'text-yellow-400'
                          : e.rank === 2
                            ? 'text-gray-300'
                            : e.rank === 3
                              ? 'text-amber-600'
                              : 'text-[#666]';
                      return (
                        <tr key={e.id} className="border-b border-[#222] last:border-0 hover:bg-[#222]">
                          <td className={`px-3 py-2.5 text-center font-bold ${rankColor}`}>{e.rank}</td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => setViewAccount(e.id)}
                              className="text-left font-medium text-[#e0e0e0] hover:text-[#4a9eff] transition-colors"
                            >
                              {e.displayName || e.username}
                            </button>
                            {e.username && e.displayName && <div className="text-xs text-[#666]">@{e.username}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-[#4a9eff]">{e.rating}</td>
                          <td
                            className={`px-3 py-2.5 text-center text-xs font-mono ${
                              change === null ? 'text-[#555]' : change > 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {change === null ? '—' : change > 0 ? `+${change}` : change}
                          </td>
                          <td className="px-3 py-2.5 text-center text-green-400">{e.wins}</td>
                          <td className="px-3 py-2.5 text-center text-red-400">{e.losses}</td>
                          <td className="px-3 py-2.5 text-center text-gray-400">{e.draws}</td>
                          <td className="px-3 py-2.5 text-center text-[#888]">{winPct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </div>
      </div>
      {viewAccount && <PlayerViewModal accountId={viewAccount} onClose={() => setViewAccount(null)} />}
    </div>
  );
}
