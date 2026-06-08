import { useEffect, useState } from 'react';
import { Ban, LogOut, RotateCcw, ShieldBan } from 'lucide-react';
import { api, PlayerRow } from './api';
import SearchBar from './SearchBar';

export default function PlayersTab() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  function load() {
    api<PlayerRow[]>('/players').then(setPlayers).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const filtered = query
    ? players.filter((p) =>
        [p.id, p.username, p.displayName, p.ip].some((v) => v && v.toLowerCase().includes(query.toLowerCase())),
      )
    : players;

  async function handleBan(id: string, name: string) {
    if (!confirm(`Ban player "${name}"? They will be disconnected and cannot rejoin.`)) return;
    setActionId(id);
    try {
      await api('/players/' + id + '/ban', { method: 'POST' });
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleKick(id: string, name: string) {
    if (!confirm(`Kick player "${name}"? They will be disconnected but can reconnect.`)) return;
    setActionId(id);
    try {
      await api('/players/' + id + '/kick', { method: 'POST' });
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleBanIp(ip: string) {
    if (!confirm(`Ban IP ${ip}? All players on this IP will be disconnected.`)) return;
    setActionId('ip:' + ip);
    try {
      await api('/bans/ip', { method: 'POST', body: JSON.stringify({ ip }) });
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div>
      <div className="mb-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search players by ID, username, display name, IP..." />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[#666]">{query ? 'No matching players.' : 'No players.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-2.5">ID</th>
                <th className="text-left px-4 py-2.5">Username</th>
                <th className="text-left px-4 py-2.5">Display Name</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">IP</th>
                <th className="text-left px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
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
                  <td className="px-4 py-2.5 font-mono text-xs text-[#888]">
                    {p.ip || '\u2014'}
                  </td>
                  <td className="px-4 py-2.5 flex gap-1">
                    <button
                      onClick={() => handleKick(p.id, p.displayName)}
                      disabled={actionId === p.id || !p.online}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-40"
                    >
                      {actionId === p.id ? <RotateCcw size={12} className="animate-spin" /> : <LogOut size={12} />}
                      Kick
                    </button>
                    <button
                      onClick={() => handleBan(p.id, p.displayName)}
                      disabled={actionId === p.id}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40"
                    >
                      {actionId === p.id ? <RotateCcw size={12} className="animate-spin" /> : <Ban size={12} />}
                      Ban
                    </button>
                    {p.ip && (
                      <button
                        onClick={() => handleBanIp(p.ip!)}
                        disabled={actionId === 'ip:' + p.ip}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-40"
                      >
                        {actionId === 'ip:' + p.ip ? <RotateCcw size={12} className="animate-spin" /> : <ShieldBan size={12} />}
                        Ban IP
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