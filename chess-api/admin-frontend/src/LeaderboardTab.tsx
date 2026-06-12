import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api } from './api';
import Pagination from './Pagination';
import SearchBar from './SearchBar';

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

export default function LeaderboardTab() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  function load() {
    api<{ entries: LeaderboardEntry[]; total: number }>('/leaderboard?page=' + page + '&limit=' + limit)
      .then((d) => {
        setEntries(d.entries);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [page, limit]);

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
    <div className="max-w-4xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
            <Trophy size={16} className="text-yellow-400" />
            Leaderboard
            <span className="text-xs font-normal text-[#666]">({total} players)</span>
          </h2>
          <div className="w-56">
            <SearchBar value={query} onChange={setQuery} placeholder="Filter by name..." />
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
                      <th className="text-center px-3 py-2.5">W</th>
                      <th className="text-center px-3 py-2.5">L</th>
                      <th className="text-center px-3 py-2.5">D</th>
                      <th className="text-center px-3 py-2.5">Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, idx) => {
                      const totalGames = e.wins + e.losses + e.draws;
                      const winPct = totalGames > 0 ? ((e.wins / totalGames) * 100).toFixed(1) : '—';
                      const rankColor =
                        e.rank === 1 ? 'text-yellow-400' : e.rank === 2 ? 'text-gray-300' : e.rank === 3 ? 'text-amber-600' : 'text-[#666]';
                      return (
                        <tr key={e.id} className="border-b border-[#222] last:border-0 hover:bg-[#222]">
                          <td className={`px-3 py-2.5 text-center font-bold ${rankColor}`}>{e.rank}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-[#e0e0e0]">{e.displayName || e.username}</div>
                            {e.username && e.displayName && (
                              <div className="text-xs text-[#666]">@{e.username}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-[#4a9eff]">{e.rating}</td>
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
    </div>
  );
}
