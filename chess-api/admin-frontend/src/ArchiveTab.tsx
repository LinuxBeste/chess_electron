import { useEffect, useState, useRef } from 'react';
import { Archive, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { api } from './api';
import Pagination from './Pagination';
import SearchBar from './SearchBar';
import { useNavigateTab } from './TabContext';

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

// human-readable relative time for game date display
function fmtDuration(playedAt: number): string {
  const diff = Math.floor((Date.now() - playedAt) / 1000);
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

export default function ArchiveTab({ initialPlayer }: { initialPlayer?: string }) {
  const [games, setGames] = useState<ArchiveGame[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [error, setError] = useState('');
  const [player, setPlayer] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedPgn, setExpandedPgn] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [debouncedPlayer, setDebouncedPlayer] = useState('');
  const playerTimer = useRef<ReturnType<typeof setTimeout> | null>(null); 
  const navigate = useNavigateTab();

  function setPlayerDebounced(val: string) {
    setPlayer(val);
    if (playerTimer.current) clearTimeout(playerTimer.current);
    playerTimer.current = setTimeout(() => setDebouncedPlayer(val), 300);
  }

  function load() {
    let path = '/archive?page=' + page + '&limit=' + limit;
    if (debouncedPlayer) path += '&player=' + encodeURIComponent(debouncedPlayer);
    if (statusFilter) path += '&status=' + encodeURIComponent(statusFilter);
    if (fromDate) path += '&fromDate=' + encodeURIComponent(fromDate);
    if (toDate) path += '&toDate=' + encodeURIComponent(toDate);
    const sortParam =
      sortKey === 'date' ? 'played_at' : sortKey === 'white' ? 'white_display_name' : 'black_display_name';
    path += '&sortKey=' + sortParam + '&sortAsc=' + sortAsc;
    api<{ games: ArchiveGame[]; total: number }>(path)
      .then((d) => {
        setGames(d.games);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message));
  }

  // set initial player filter from nav params (e.g. OverviewTab → ArchiveTab)
  useEffect(() => {
    if (initialPlayer) {
      setPlayer(initialPlayer);
      setDebouncedPlayer(initialPlayer);
    }
  }, [initialPlayer]);

  useEffect(load, [page, limit, debouncedPlayer, statusFilter, fromDate, toDate, sortKey, sortAsc]);

  const totalPages = Math.ceil(total / limit);

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleString();
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
            <Archive size={16} className="text-blue-400" />
            Game Archive
            <span className="text-xs font-normal text-[#666]">({total} games)</span>
          </h2>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 text-xs bg-[#1a1a1a] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
            />
            <span className="text-xs text-[#555]">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 text-xs bg-[#1a1a1a] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
            />
            <div className="w-48">
              <SearchBar
                value={player}
                onChange={setPlayerDebounced}
                placeholder="Filter by player..."
                sortOptions={[
                  { key: 'date', label: 'Date' },
                  { key: 'white', label: 'White' },
                  { key: 'black', label: 'Black' },
                ]}
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSortChange={(k, a) => {
                  setSortKey(k);
                  setSortAsc(a);
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
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

        <div className="p-4">
          {games.length === 0 ? (
            <p className="text-[#666] text-center py-8">No archived games found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#888] uppercase text-xs tracking-wider border-b border-[#2a2a2a]">
                      <th className="text-left px-4 py-2.5">ID</th>
                      <th className="text-left px-4 py-2.5">White</th>
                      <th className="text-left px-4 py-2.5">Black</th>
                      <th className="text-center px-3 py-2.5">Result</th>
                      <th className="text-left px-3 py-2.5">Date</th>
                      <th className="text-left px-3 py-2.5">Duration</th>
                      <th className="text-center px-3 py-2.5">PGN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g) => (
                      <tr key={g.id} className="border-b border-[#222] last:border-0 hover:bg-[#222]">
                        <td className="px-4 py-2.5 font-mono">
                          <button
                            onClick={() => navigate('replay', { gameId: g.id })}
                            className="text-[#4a9eff] hover:underline flex items-center gap-1"
                          >
                            {g.id.slice(0, 8)}… <ExternalLink size={10} />
                          </button>
                        </td>
                        <td className="px-4 py-2.5">{g.white_display_name || g.white_player_id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5">{g.black_display_name || g.black_player_id.slice(0, 8)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {g.winner === g.white_player_id ? (
                            <span className="text-green-400 font-semibold">1-0</span>
                          ) : g.winner === g.black_player_id ? (
                            <span className="text-green-400 font-semibold">0-1</span>
                          ) : (
                            <span className="text-yellow-400 font-semibold">½-½</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#888]">{fmtDate(g.played_at)}</td>
                        <td className="px-3 py-2.5 text-xs text-[#888]">{fmtDuration(g.played_at)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {g.pgn ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => navigator.clipboard.writeText(g.pgn!)}
                                className="text-xs text-[#4a9eff] hover:underline"
                              >
                                Copy
                              </button>
                              <button
                                onClick={() => setExpandedPgn(expandedPgn === g.id ? null : g.id)}
                                className="text-[#888] hover:text-[#ccc]"
                              >
                                {expandedPgn === g.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[#555]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {expandedPgn &&
                (() => {
                  const g = games.find((x) => x.id === expandedPgn);
                  if (!g || !g.pgn) return null;
                  return (
                    <div className="mt-3 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
                      <pre className="text-xs font-mono text-[#ccc] whitespace-pre-wrap">{g.pgn}</pre>
                    </div>
                  );
                })()}
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
