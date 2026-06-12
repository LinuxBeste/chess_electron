import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { api } from './api';

interface AIGameInfo {
  id: string;
  status: string;
  players: { white?: string; black?: string };
  moves: number;
  createdAt: number;
}

interface AIGamesResponse {
  total: number;
  active: number;
  games: AIGameInfo[];
}

export default function AIGamesTab() {
  const [data, setData] = useState<AIGamesResponse | null>(null);
  const [error, setError] = useState('');

  function load() {
    api<AIGamesResponse>('/ai-games')
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return <p className="text-[#666]">Loading...</p>;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-[#4a9eff]">{data.total}</div>
          <div className="text-xs text-[#888] mt-1">Total AI Games</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-green-400">{data.active}</div>
          <div className="text-xs text-[#888] mt-1">Active Now</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-yellow-400">{data.total - data.active}</div>
          <div className="text-xs text-[#888] mt-1">Completed</div>
        </div>
      </div>

      {data.games.length === 0 ? (
        <p className="text-[#666]">No AI games have been played yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-2.5">ID</th>
                <th className="text-left px-4 py-2.5">Players</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-center px-3 py-2.5">Moves</th>
                <th className="text-left px-3 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.games.map((g) => (
                <tr key={g.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
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
                        g.status === 'active'
                          ? 'bg-green-900 text-green-400'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {g.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">{g.moves}</td>
                  <td className="px-3 py-2.5 text-xs text-[#888]">
                    {new Date(g.createdAt).toLocaleString()}
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
