import { useEffect, useState } from 'react';
import { api, PlayerRow } from './api';

export default function PlayersTab() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<PlayerRow[]>('/players').then(setPlayers).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (players.length === 0) return <p className="text-[#666]">No players.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
            <th className="text-left px-4 py-2.5">ID</th>
            <th className="text-left px-4 py-2.5">Username</th>
            <th className="text-left px-4 py-2.5">Display Name</th>
            <th className="text-left px-4 py-2.5">Type</th>
            <th className="text-left px-4 py-2.5">Status</th>
            <th className="text-left px-4 py-2.5">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
              <td className="px-4 py-2.5 font-mono">{p.id.slice(0, 8)}&hellip;</td>
              <td className="px-4 py-2.5">{p.username}</td>
              <td className="px-4 py-2.5">{p.displayName}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${p.isRegistered ? 'bg-blue-900 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
                  {p.isRegistered ? 'Registered' : 'Temporary'}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center gap-1.5 ${p.online ? 'text-green-400' : 'text-gray-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${p.online ? 'bg-green-400' : 'bg-gray-600'}`} />
                  {p.online ? 'Online' : 'Offline'}
                </span>
              </td>
              <td className="px-4 py-2.5">{p.tokens}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
