import { useEffect, useState } from 'react';
import { ShieldOff, ShieldBan, Trash2, RotateCcw, Plus, Clock, Copy, CheckSquare, Square } from 'lucide-react';
import { api, BanList } from './api';
import SearchBar from './SearchBar';
import { useToast } from './Toast';

export default function BansTab() {
  const [bans, setBans] = useState<BanList>({ players: [], ips: [] });
  const [error, setError] = useState('');
  const [newIp, setNewIp] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showDuration, setShowDuration] = useState(false);
  const [banDuration, setBanDuration] = useState(0);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set());
  const [bulkUnbanning, setBulkUnbanning] = useState(false);
  const { addToast } = useToast();
  const [sortKey, setSortKey] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);

  function load() {
    api<BanList>('/bans')
      .then(setBans)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  // client-side sort with nullable-safe date fallback (?? 0)
  const filteredPlayers = (
    query ? bans.players.filter((b) => b.id && b.id.toLowerCase().includes(query.toLowerCase())) : bans.players
  ).sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === 'date') return ((a.bannedAt ?? 0) - (b.bannedAt ?? 0)) * dir;
    return String(a.id || '').localeCompare(String(b.id || '')) * dir;
  });

  const filteredIps = (
    query ? bans.ips.filter((b) => b.ip && b.ip.toLowerCase().includes(query.toLowerCase())) : bans.ips
  ).sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === 'date') return ((a.bannedAt ?? 0) - (b.bannedAt ?? 0)) * dir;
    return String(a.ip || '').localeCompare(String(b.ip || '')) * dir;
  });

  // add IP ban with optional timed duration (undefined = permanent)
  async function handleAddIpBan() {
    const ip = newIp.trim();
    if (!ip) return;
    setActionId('add');
    try {
      await api('/bans/ip', { method: 'POST', body: JSON.stringify({ ip, duration: banDuration || undefined }) });
      setNewIp('');
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleUnbanPlayer(id: string) {
    setActionId(id);
    try {
      await api('/bans/player/' + encodeURIComponent(id), { method: 'DELETE' });
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleUnbanIp(ip: string) {
    setActionId('ip:' + ip);
    try {
      await api('/bans/ip/' + encodeURIComponent(ip), { method: 'DELETE' });
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionId(null);
    }
  }

  // bulk unban tolerates partial failures, encodeURIComponent for special chars in IPs/IDs
  async function handleBulkUnban(type: 'players' | 'ips') {
    const items = type === 'players' ? selectedPlayers : selectedIps;
    if (items.size === 0) return;
    if (!confirm(`Unban ${items.size} selected ${type}?`)) return;
    setBulkUnbanning(true);
    let ok = 0,
      fail = 0;
    for (const id of items) {
      try {
        if (type === 'players') await api('/bans/player/' + encodeURIComponent(id), { method: 'DELETE' });
        else await api('/bans/ip/' + encodeURIComponent(id), { method: 'DELETE' });
        ok++;
      } catch {
        fail++;
      }
    }
    addToast(`Unbanned ${ok} ${type}` + (fail ? `, ${fail} failed` : ''), fail ? 'error' : 'success');
    setSelectedPlayers(new Set());
    setSelectedIps(new Set());
    setBulkUnbanning(false);
    load();
  }

  function togglePlayer(id: string) {
    const next = new Set(selectedPlayers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPlayers(next);
  }

  function toggleIp(ip: string) {
    const next = new Set(selectedIps);
    if (next.has(ip)) next.delete(ip);
    else next.add(ip);
    setSelectedIps(next);
  }

  function copyIp(ip: string) {
    navigator.clipboard.writeText(ip);
    addToast('IP copied', 'success');
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="IP address to ban..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddIpBan()} // Enter shortcut to submit IP ban
            className="flex-1 px-3 py-2 text-sm bg-[#1a1a1a] border border-[#333] rounded-lg text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff]"
          />
          <button
            onClick={() => setShowDuration(!showDuration)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border ${showDuration ? 'bg-[#333] border-[#4a9eff] text-[#4a9eff]' : 'bg-[#1a1a1a] border-[#333] text-[#888] hover:text-[#ccc]'}`}
          >
            <Clock size={14} />
          </button>
        </div>
        <button
          onClick={handleAddIpBan}
          disabled={actionId === 'add' || !newIp.trim()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40"
        >
          {actionId === 'add' ? <RotateCcw size={14} className="animate-spin" /> : <Plus size={14} />}
          Ban IP
        </button>
      </div>

      {showDuration && (
        <div className="mb-4 flex gap-2 items-center px-3 py-2 bg-[#222] rounded-lg text-sm">
          <span className="text-[#888] text-xs">Ban duration (minutes, 0=permanent):</span>
          <input
            type="number"
            min={0}
            value={banDuration}
            onChange={(e) => setBanDuration(parseInt(e.target.value) || 0)}
            className="w-20 px-2 py-1 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
          />
          <span className="text-xs text-[#555]">
            {banDuration > 0 ? `~${(banDuration / 60).toFixed(1)}h` : 'Permanent'}
          </span>
        </div>
      )}

      <div className="mb-4 max-w-md">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search bans by player ID or IP..."
          sortOptions={[
            { key: 'date', label: 'Date' },
            { key: 'id', label: 'Name' },
          ]}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSortChange={(k, a) => {
            setSortKey(k);
            setSortAsc(a);
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2 mb-3">
            <ShieldOff size={16} className="text-red-400" />
            Banned Players
            <span className="text-xs font-normal text-[#666]">({bans.players.length})</span>
          </h3>
          {selectedPlayers.size > 0 && (
            <div className="mb-2 flex items-center gap-2 px-2 py-1.5 bg-[#222] rounded text-xs">
              <span className="text-[#888]">{selectedPlayers.size} selected</span>
              <button
                onClick={() => handleBulkUnban('players')}
                disabled={bulkUnbanning}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-700 text-[#ccc] rounded hover:bg-gray-600 disabled:opacity-40"
              >
                {bulkUnbanning ? <RotateCcw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                Unban Selected
              </button>
            </div>
          )}
          {filteredPlayers.length === 0 ? (
            <p className="text-xs text-[#666]">{query ? 'No matching bans.' : 'No banned players.'}</p>
          ) : (
            <ul className="space-y-1">
              {filteredPlayers.map((b) => {
                const pid = b.id ?? '';
                return (
                  <li key={pid} className="flex items-center justify-between px-3 py-2 bg-[#222] rounded text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <button onClick={() => togglePlayer(pid)} className="text-[#888] hover:text-[#ccc] shrink-0">
                        {selectedPlayers.has(pid) ? <CheckSquare size={12} /> : <Square size={12} />}
                      </button>
                      <span className="font-mono text-[#ccc] truncate">{pid.slice(0, 12)}…</span>
                      {b.bannedAt && (
                        <span className="text-[#555] shrink-0">{new Date(b.bannedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnbanPlayer(pid)}
                      disabled={actionId === pid}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 text-[#ccc] rounded hover:bg-gray-600 disabled:opacity-40 shrink-0"
                    >
                      {actionId === pid ? <RotateCcw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      Unban
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2 mb-3">
            <ShieldBan size={16} className="text-red-400" />
            Banned IPs
            <span className="text-xs font-normal text-[#666]">({bans.ips.length})</span>
          </h3>
          {selectedIps.size > 0 && (
            <div className="mb-2 flex items-center gap-2 px-2 py-1.5 bg-[#222] rounded text-xs">
              <span className="text-[#888]">{selectedIps.size} selected</span>
              <button
                onClick={() => handleBulkUnban('ips')}
                disabled={bulkUnbanning}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-700 text-[#ccc] rounded hover:bg-gray-600 disabled:opacity-40"
              >
                {bulkUnbanning ? <RotateCcw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                Unban Selected
              </button>
            </div>
          )}
          {filteredIps.length === 0 ? (
            <p className="text-xs text-[#666]">{query ? 'No matching bans.' : 'No banned IPs.'}</p>
          ) : (
            <ul className="space-y-1">
              {filteredIps.map((b) => {
                const ip = b.ip ?? '';
                return (
                  <li key={ip} className="flex items-center justify-between px-3 py-2 bg-[#222] rounded text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <button onClick={() => toggleIp(ip)} className="text-[#888] hover:text-[#ccc] shrink-0">
                        {selectedIps.has(ip) ? <CheckSquare size={12} /> : <Square size={12} />}
                      </button>
                      <span className="text-[#ccc]">{ip}</span>
                      <button onClick={() => copyIp(ip)} className="text-[#555] hover:text-[#ccc]" title="Copy IP">
                        <Copy size={10} />
                      </button>
                      {b.bannedAt && <span className="text-[#555]">{new Date(b.bannedAt).toLocaleDateString()}</span>}
                    </div>
                    <button
                      onClick={() => handleUnbanIp(ip)}
                      disabled={actionId === 'ip:' + ip}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 text-[#ccc] rounded hover:bg-gray-600 disabled:opacity-40 shrink-0"
                    >
                      {actionId === 'ip:' + ip ? (
                        <RotateCcw size={10} className="animate-spin" />
                      ) : (
                        <Trash2 size={10} />
                      )}
                      Unban
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
