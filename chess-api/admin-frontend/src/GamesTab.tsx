import { useEffect, useState } from 'react';
import { Swords, Flag, RotateCcw, CheckSquare, Square } from 'lucide-react';
import { api, GameRow } from './api';
import { useToast } from './Toast';
import SearchBar from './SearchBar';
import Pagination from './Pagination';

const statusColors: Record<string, string> = {
  active: 'bg-green-900 text-green-400',
  waiting: 'bg-yellow-900 text-yellow-400',
  checkmate: 'bg-red-900 text-red-400',
  resigned: 'bg-red-900 text-red-400',
  stalemate: 'bg-gray-800 text-gray-400',
  draw: 'bg-gray-800 text-gray-400',
};

export default function GamesTab() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEnding, setBulkEnding] = useState(false);
  const { addToast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 30;

  function load() {
    api<GameRow[]>('/games')
      .then(setGames)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const filtered = query
    ? games.filter((g) =>
        [g.id, g.white, g.black, g.status, g.winner].some((v) => v && v.toLowerCase().includes(query.toLowerCase())),
      )
    : games;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function toggleAll() {
    if (selected.size === paginated.filter((g) => g.status === 'active' || g.status === 'waiting').length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.filter((g) => g.status === 'active' || g.status === 'waiting').map((g) => g.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleEndGame(gameId: string) {
    if (!confirm('End this game? It will be marked as a draw.')) return;
    setEnding(gameId);
    try {
      await api('/games/' + gameId + '/end', { method: 'POST' });
      addToast('Game ended', 'success');
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setEnding(null);
    }
  }

  async function handleBulkEnd() {
    if (selected.size === 0) return;
    if (!confirm('End ' + selected.size + ' selected game(s)? They will be marked as draws.')) return;
    setBulkEnding(true);
    let ok = 0,
      fail = 0;
    for (const id of selected) {
      try {
        await api('/games/' + id + '/end', { method: 'POST' });
        ok++;
      } catch {
        fail++;
      }
    }
    addToast(`Ended ${ok} game(s)` + (fail ? `, ${fail} failed` : ''), fail ? 'error' : 'success');
    setSelected(new Set());
    setBulkEnding(false);
    load();
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
              <Swords size={16} className="text-orange-400" />
              Active Games
            </h2>
            <div className="w-64">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search games by ID, player, status, winner..."
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          {selected.size > 0 && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-[#222] rounded-lg text-sm">
              <span className="text-[#888]">{selected.size} selected</span>
              <button
                onClick={handleBulkEnd}
                disabled={bulkEnding}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-40"
              >
                {bulkEnding ? <RotateCcw size={12} className="animate-spin" /> : <Flag size={12} />}
                End Selected
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="px-2 py-1 text-xs text-[#888] hover:text-[#ccc]"
              >
                Clear
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-[#666] text-center py-8">{query ? 'No matching games.' : 'No games.'}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#888] uppercase text-xs tracking-wider border-b border-[#2a2a2a]">
                      <th className="text-center px-2 py-2.5 w-8">
                        <button onClick={toggleAll} className="text-[#888] hover:text-[#ccc]">
                          {selected.size ===
                            paginated.filter((g) => g.status === 'active' || g.status === 'waiting').length &&
                          paginated.some((g) => g.status === 'active' || g.status === 'waiting') ? (
                            <CheckSquare size={14} />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </th>
                      <th className="text-left px-4 py-2.5">ID</th>
                      <th className="text-left px-4 py-2.5">Status</th>
                      <th className="text-left px-4 py-2.5">White</th>
                      <th className="text-left px-4 py-2.5">Black</th>
                      <th className="text-left px-4 py-2.5">Turn</th>
                      <th className="text-left px-4 py-2.5">Moves</th>
                      <th className="text-left px-4 py-2.5">Winner</th>
                      <th className="text-left px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((g) => (
                      <tr key={g.id} className="border-b border-[#222] last:border-0 hover:bg-[#222]">
                        <td className="px-2 py-2.5 text-center">
                          {(g.status === 'active' || g.status === 'waiting') && (
                            <button onClick={() => toggleOne(g.id)} className="text-[#888] hover:text-[#ccc]">
                              {selected.has(g.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{g.id.slice(0, 8)}&hellip;</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusColors[g.status] || 'bg-gray-800 text-gray-400'}`}
                          >
                            {g.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">{g.white}</td>
                        <td className="px-4 py-2.5">{g.black}</td>
                        <td className="px-4 py-2.5 capitalize">{g.turn}</td>
                        <td className="px-4 py-2.5">{g.moves}</td>
                        <td className="px-4 py-2.5">{g.winner || '\u2014'}</td>
                        <td className="px-4 py-2.5">
                          {(g.status === 'active' || g.status === 'waiting') && (
                            <button
                              onClick={() => handleEndGame(g.id)}
                              disabled={ending === g.id}
                              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
                            >
                              {ending === g.id ? <RotateCcw size={12} className="animate-spin" /> : <Flag size={12} />}
                              End
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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
