import { useEffect, useState } from 'react';
import { Archive, Search } from 'lucide-react';
import { api } from './api';
import Pagination from './Pagination';
import SearchBar from './SearchBar';

interface ArchiveGame {
  id: string;
  white_player_id: string;
  black_player_id: string;
  white_display_name: string | null;
  black_display_name: string | null;
  winner: string | null;
  status: string;
  played_at: number;
  pgn: string | null;
}

export default function ArchiveTab() {
  const [games, setGames] = useState<ArchiveGame[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [error, setError] = useState('');
  const [player, setPlayer] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  function load() {
    let path = '/archive?page=' + page + '&limit=' + limit;
    if (player) path += '&player=' + encodeURIComponent(player);
    if (statusFilter) path += '&status=' + encodeURIComponent(statusFilter);
    api<{ games: ArchiveGame[]; total: number }>(path)
      .then((d) => {
        setGames(d.games);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, [page, limit, player, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleString();
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
          <Archive size={16} className="text-blue-400" />
          Game Archive ({total} games)
        </h2>
        <div className="flex gap-2">
          <div className="w-48">
            <SearchBar value={player} onChange={setPlayer} placeholder="Filter by player ID..." />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm bg-[#1a1a1a] border border-[#333] rounded-lg text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
          >
            <option value="">All results</option>
            <option value="checkmate">Checkmate</option>
            <option value="resigned">Resigned</option>
            <option value="stalemate">Stalemate</option>
            <option value="draw">Draw</option>
          </select>
        </div>
      </div>

      {games.length === 0 ? (
        <p className="text-[#666]">No archived games found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-2.5">ID</th>
                <th className="text-left px-4 py-2.5">White</th>
                <th className="text-left px-4 py-2.5">Black</th>
                <th className="text-center px-3 py-2.5">Result</th>
                <th className="text-left px-3 py-2.5">Date</th>
                <th className="text-center px-3 py-2.5">PGN</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
                  <td className="px-4 py-2.5 font-mono">{g.id.slice(0, 8)}&hellip;</td>
                  <td className="px-4 py-2.5">{g.white_display_name || g.white_player_id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5">{g.black_display_name || g.black_player_id.slice(0, 8)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {g.winner === g.white_player_id ? (
                      <span className="text-green-400 font-semibold">1-0</span>
                    ) : g.winner === g.black_player_id ? (
                      <span className="text-green-400 font-semibold">0-1</span>
                    ) : (
                      <span className="text-yellow-400 font-semibold">&frac12;-&frac12;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[#888]">{fmtDate(g.played_at)}</td>
                  <td className="px-3 py-2.5 text-center">
                    {g.pgn ? (
                      <button
                        onClick={() => navigator.clipboard.writeText(g.pgn!)}
                        className="text-xs text-[#4a9eff] hover:underline"
                      >
                        Copy
                      </button>
                    ) : (
                      <span className="text-xs text-[#555]">&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
