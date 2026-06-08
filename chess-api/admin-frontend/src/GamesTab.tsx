import { useEffect, useState } from 'react';
import { Flag, RotateCcw, Search } from 'lucide-react';
import { api, GameRow } from './api';
import SearchBar from './SearchBar';

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

  async function handleEndGame(gameId: string) {
    if (!confirm('End this game? It will be marked as a draw.')) return;
    setEnding(gameId);
    try {
      await api('/games/' + gameId + '/end', { method: 'POST' });
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEnding(null);
    }
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div>
      <div className="mb-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search games by ID, player, status, winner..." />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[#666]">{query ? 'No matching games.' : 'No games.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
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
              {filtered.map((g) => (
                <tr key={g.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
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
      )}
    </div>
  );
}
