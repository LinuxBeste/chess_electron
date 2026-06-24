import { useEffect, useState } from 'react';
import { Bot, ExternalLink, Clock } from 'lucide-react';
import { api } from './api';

interface BotGameInfo {
  id: string;
  status: string;
  players: { white?: string; black?: string };
  moves: number;
  createdAt: number;
}

interface BotGamesResponse {
  total: number;
  active: number;
  games: BotGameInfo[];
}

export default function BotGamesTab() {
  const [data, setData] = useState<BotGamesResponse | null>(null);
  const [error, setError] = useState('');

  function load() {
    api<BotGamesResponse>('/bot-games')
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return <p className="text-[#666] text-center py-12">Loading...</p>;

  const completedGames = data.games.filter((g) => g.status !== 'active');
  const avgDuration = completedGames.length > 0
    ? completedGames.reduce((sum, g) => sum + g.moves, 0) / completedGames.length
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
              <Bot size={16} className="text-green-400" />
              Bot Games
            </h2>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#4a9eff] border border-[#4a9eff] rounded-lg hover:bg-[#4a9eff] hover:text-white"
            >
              <ExternalLink size={14} />
              Play against bot
            </a>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#222] border border-[#333] rounded-lg p-5 text-center">
              <div className="text-3xl font-bold text-[#4a9eff]">{data.total}</div>
              <div className="text-xs text-[#888] mt-1">Total Bot Games</div>
            </div>
            <div className="bg-[#222] border border-[#333] rounded-lg p-5 text-center">
              <div className="text-3xl font-bold text-green-400">{data.active}</div>
              <div className="text-xs text-[#888] mt-1">Active Now</div>
            </div>
            <div className="bg-[#222] border border-[#333] rounded-lg p-5 text-center">
              <div className="text-3xl font-bold text-yellow-400">{data.total - data.active}</div>
              <div className="text-xs text-[#888] mt-1">Completed</div>
            </div>
            <div className="bg-[#222] border border-[#333] rounded-lg p-5 text-center">
              <div className="text-3xl font-bold text-purple-400">{avgDuration > 0 ? avgDuration.toFixed(0) : '—'}</div>
              <div className="text-xs text-[#888] mt-1 flex items-center justify-center gap-1">
                <Clock size={10} /> Avg Moves
              </div>
            </div>
          </div>

          {data.games.length === 0 ? (
            <p className="text-[#666] text-center py-4">No bot games have been played yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#888] uppercase text-xs tracking-wider border-b border-[#2a2a2a]">
                    <th className="text-left px-4 py-2.5">ID</th>
                    <th className="text-left px-4 py-2.5">Players</th>
                    <th className="text-left px-3 py-2.5">Status</th>
                    <th className="text-center px-3 py-2.5">Moves</th>
                    <th className="text-left px-3 py-2.5">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.games.map((g) => (
                    <tr key={g.id} className="border-b border-[#222] last:border-0 hover:bg-[#222]">
                      <td className="px-4 py-2.5 font-mono">{g.id.slice(0, 8)}&hellip;</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <Bot size={12} className="text-green-400" />
                          {g.players.white || '?'} vs {g.players.black || '?'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            g.status === 'active' ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-400'
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">{g.moves}</td>
                      <td className="px-3 py-2.5 text-xs text-[#888]">{new Date(g.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
