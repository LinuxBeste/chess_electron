import { useEffect, useState } from 'react';
import { ShieldOff, ShieldBan, Trash2, RotateCcw, Plus } from 'lucide-react';
import { api, BanList } from './api';
import SearchBar from './SearchBar';

export default function BansTab() {
  const [bans, setBans] = useState<BanList>({ players: [], ips: [] });
  const [error, setError] = useState('');
  const [newIp, setNewIp] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  function load() {
    api<BanList>('/bans')
      .then(setBans)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const filteredPlayers = query
    ? bans.players.filter((pid) => pid.toLowerCase().includes(query.toLowerCase()))
    : bans.players;

  const filteredIps = query ? bans.ips.filter((ip) => ip.toLowerCase().includes(query.toLowerCase())) : bans.ips;

  async function handleAddIpBan() {
    const ip = newIp.trim();
    if (!ip) return;
    setActionId('add');
    try {
      await api('/bans/ip', { method: 'POST', body: JSON.stringify({ ip }) });
      setNewIp('');
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleUnbanPlayer(id: string) {
    setActionId(id);
    try {
      await api('/bans/player/' + encodeURIComponent(id), { method: 'DELETE' });
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function handleUnbanIp(ip: string) {
    setActionId('ip:' + ip);
    try {
      await api('/bans/ip/' + encodeURIComponent(ip), { method: 'DELETE' });
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
      {/* Add IP ban */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newIp}
          onChange={(e) => setNewIp(e.target.value)}
          placeholder="IP address to ban..."
          onKeyDown={(e) => e.key === 'Enter' && handleAddIpBan()}
          className="flex-1 px-3 py-2 text-sm bg-[#1a1a1a] border border-[#333] rounded-lg text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff]"
        />
        <button
          onClick={handleAddIpBan}
          disabled={actionId === 'add' || !newIp.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40"
        >
          {actionId === 'add' ? <RotateCcw size={14} className="animate-spin" /> : <Plus size={14} />}
          Ban IP
        </button>
      </div>

      <div className="mb-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search bans by player ID or IP..." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banned players */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2 mb-3">
            <ShieldOff size={16} className="text-red-400" />
            Banned Players
          </h3>
          {filteredPlayers.length === 0 ? (
            <p className="text-xs text-[#666]">{query ? 'No matching bans.' : 'No banned players.'}</p>
          ) : (
            <ul className="space-y-1">
              {filteredPlayers.map((pid) => (
                <li key={pid} className="flex items-center justify-between px-3 py-2 bg-[#222] rounded text-xs">
                  <span className="font-mono text-[#ccc]">{pid.slice(0, 12)}&hellip;</span>
                  <button
                    onClick={() => handleUnbanPlayer(pid)}
                    disabled={actionId === pid}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 text-[#ccc] rounded hover:bg-gray-600 disabled:opacity-40"
                  >
                    {actionId === pid ? <RotateCcw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                    Unban
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Banned IPs */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2 mb-3">
            <ShieldBan size={16} className="text-red-400" />
            Banned IPs
          </h3>
          {filteredIps.length === 0 ? (
            <p className="text-xs text-[#666]">{query ? 'No matching bans.' : 'No banned IPs.'}</p>
          ) : (
            <ul className="space-y-1">
              {filteredIps.map((ip) => (
                <li key={ip} className="flex items-center justify-between px-3 py-2 bg-[#222] rounded text-xs">
                  <span className="text-[#ccc]">{ip}</span>
                  <button
                    onClick={() => handleUnbanIp(ip)}
                    disabled={actionId === 'ip:' + ip}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 text-[#ccc] rounded hover:bg-gray-600 disabled:opacity-40"
                  >
                    {actionId === 'ip:' + ip ? <RotateCcw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                    Unban
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
