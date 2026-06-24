import { useEffect, useState } from 'react';
import { Users, Ban, LogOut, RotateCcw, ShieldBan, CheckSquare, Square, Copy, MessageSquare, ExternalLink } from 'lucide-react';
import { api, PlayerRow } from './api';
import { useToast } from './Toast';
import SearchBar from './SearchBar';
import Pagination from './Pagination';
import { useNavigateTab } from './TabContext';

function WhisperModal({ playerId, playerName, onClose }: { playerId: string; playerName: string; onClose: () => void }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { addToast } = useToast();

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await api('/players/' + playerId + '/whisper', {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      });
      addToast('Message sent to ' + playerName, 'success');
      onClose();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-[380px] max-w-[90vw]">
        <h2 className="text-sm font-semibold text-[#e0e0e0] mb-4">Whisper to {playerName}</h2>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Type your message..."
          className="w-full px-3 py-2 text-sm bg-[#111] border border-[#333] rounded-lg text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff] resize-none" />
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">Cancel</button>
          <button onClick={handleSend} disabled={sending || !message.trim()}
            className="px-3 py-1.5 text-xs bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] disabled:opacity-40">
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlayersTab() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'ban' | 'kick' | null>(null);
  const [whisperTarget, setWhisperTarget] = useState<{ id: string; name: string } | null>(null);
  const { addToast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const navigate = useNavigateTab();
  const [sortKey, setSortKey] = useState('username');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterOnline, setFilterOnline] = useState(false);
  const [filterTemp, setFilterTemp] = useState(false);

  function load() {
    api<PlayerRow[]>('/players')
      .then(setPlayers)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const filtered = players
    .filter((p) => !filterOnline || p.online)
    .filter((p) => !filterTemp || !p.isRegistered)
    .filter((p) => !query ||
      [p.id, p.username, p.displayName, p.ip].some((v) => v && v.toLowerCase().includes(query.toLowerCase()))
    );

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === 'tokens') return (a.tokens - b.tokens) * dir;
    if (sortKey === 'registeredAt') return ((a.registeredAt ?? 0) - (b.registeredAt ?? 0)) * dir;
    const va = String(a[sortKey as keyof typeof a] || '').toLowerCase();
    const vb = String(b[sortKey as keyof typeof b] || '').toLowerCase();
    return va.localeCompare(vb) * dir;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleAll() {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleBan(id: string, name: string) {
    if (!confirm(`Ban player "${name}"? They will be disconnected and cannot rejoin.`)) return;
    setActionId(id);
    try {
      await api('/players/' + id + '/ban', { method: 'POST' });
      addToast(`Banned ${name}`, 'success');
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleKick(id: string, name: string) {
    if (!confirm(`Kick player "${name}"? They will be disconnected but can reconnect.`)) return;
    setActionId(id);
    try {
      await api('/players/' + id + '/kick', { method: 'POST' });
      addToast(`Kicked ${name}`, 'success');
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleBanIp(ip: string) {
    if (!confirm(`Ban IP ${ip}? All players on this IP will be disconnected.`)) return;
    setActionId('ip:' + ip);
    try {
      await api('/bans/ip', { method: 'POST', body: JSON.stringify({ ip }) });
      addToast(`Banned IP ${ip}`, 'success');
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setActionId(null);
    }
  }

  async function handleBulk(action: 'ban' | 'kick') {
    if (selected.size === 0) return;
    const verb = action === 'ban' ? 'Ban' : 'Kick';
    if (!confirm(`${verb} ${selected.size} selected player(s)?`)) return;
    setBulkAction(action);
    let ok = 0, fail = 0;
    for (const id of selected) {
      try {
        await api('/players/' + id + '/' + action, { method: 'POST' });
        ok++;
      } catch { fail++; }
    }
    addToast(`${verb}ed ${ok} player(s)` + (fail ? `, ${fail} failed` : ''), fail ? 'error' : 'success');
    setSelected(new Set());
    setBulkAction(null);
    load();
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id);
    addToast('ID copied', 'success');
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              Active Players
            </h2>
            <div className="w-96">
              <SearchBar value={query} onChange={setQuery} placeholder="Search players by ID, username, display name, IP..."
                sortOptions={[
                  { key: 'username', label: 'Username' },
                  { key: 'displayName', label: 'Display Name' },
                  { key: 'tokens', label: 'Tokens' },
                  { key: 'registeredAt', label: 'Registered' },
                  { key: 'ip', label: 'IP' },
                ]}
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSortChange={(k, a) => { setSortKey(k); setSortAsc(a); }}
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="flex gap-1.5 mb-3">
            <button onClick={() => setFilterOnline(!filterOnline)}
              className={`px-2.5 py-1 text-[11px] rounded-full font-medium border ${
                filterOnline
                  ? 'bg-green-900 border-green-600 text-green-400'
                  : 'bg-[#1a1a1a] border-[#333] text-[#888] hover:text-[#ccc]'
              }`}>
              Online only
            </button>
            <button onClick={() => setFilterTemp(!filterTemp)}
              className={`px-2.5 py-1 text-[11px] rounded-full font-medium border ${
                filterTemp
                  ? 'bg-gray-800 border-gray-500 text-gray-300'
                  : 'bg-[#1a1a1a] border-[#333] text-[#888] hover:text-[#ccc]'
              }`}>
              Temporary only
            </button>
            {(filterOnline || filterTemp) && (
              <button onClick={() => { setFilterOnline(false); setFilterTemp(false); }}
                className="text-[11px] text-[#555] hover:text-[#888] px-2">Clear</button>
            )}
          </div>
          {selected.size > 0 && (
            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-[#222] rounded-lg text-sm">
              <span className="text-[#888]">{selected.size} selected</span>
              <button onClick={() => handleBulk('kick')} disabled={bulkAction !== null}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-40">
                {bulkAction === 'kick' ? <RotateCcw size={12} className="animate-spin" /> : <LogOut size={12} />}
                Kick Selected
              </button>
              <button onClick={() => handleBulk('ban')} disabled={bulkAction !== null}
                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40">
                {bulkAction === 'ban' ? <RotateCcw size={12} className="animate-spin" /> : <Ban size={12} />}
                Ban Selected
              </button>
              <button onClick={() => setSelected(new Set())} className="px-2 py-1 text-xs text-[#888] hover:text-[#ccc]">Clear</button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-[#666] text-center py-8">{query ? 'No matching players.' : 'No players.'}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#888] uppercase text-xs tracking-wider border-b border-[#2a2a2a]">
                      <th className="text-center px-2 py-2.5 w-8">
                        <button onClick={toggleAll} className="text-[#888] hover:text-[#ccc]">
                          {selected.size === paginated.length && paginated.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </th>
                      <th className="text-left px-4 py-2.5">ID</th>
                      <th className="text-left px-4 py-2.5">Username</th>
                      <th className="text-left px-4 py-2.5">Display Name</th>
                      <th className="text-left px-4 py-2.5">Type</th>
                      <th className="text-left px-4 py-2.5">Status</th>
                      <th className="text-left px-4 py-2.5">IP</th>
                      <th className="text-left px-4 py-2.5">Tokens</th>
                      <th className="text-left px-4 py-2.5">Registered</th>
                      <th className="text-left px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((p) => (
                      <tr key={p.id} className="border-b border-[#222] last:border-0 hover:bg-[#222]">
                        <td className="px-2 py-2.5 text-center">
                          <button onClick={() => toggleOne(p.id)} className="text-[#888] hover:text-[#ccc]">
                            {selected.has(p.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="font-mono">{p.id.slice(0, 8)}…</span>
                            <button onClick={() => copyId(p.id)} className="text-[#555] hover:text-[#ccc]" title="Copy ID">
                              <Copy size={11} />
                            </button>
                          </div>
                        </td>
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
                        <td className="px-4 py-2.5 font-mono text-xs text-[#888]">{p.ip || '—'}</td>
                        <td className="px-4 py-2.5" title={`${p.tokens} tokens`}>
                          <span className="text-yellow-400 font-mono text-xs">{p.tokens}</span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#888]">
                          {p.registeredAt ? new Date(p.registeredAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 flex-nowrap">
                            <button onClick={() => setWhisperTarget({ id: p.id, name: p.displayName })}
                              disabled={!p.online}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40" title="Whisper">
                              <MessageSquare size={10} />
                            </button>
                            {p.currentGameId && (
                              <button onClick={() => navigate('replay', { gameId: p.currentGameId! })}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-700 text-white rounded hover:bg-green-800" title="View game">
                                <ExternalLink size={10} />
                              </button>
                            )}
                            <button onClick={() => handleKick(p.id, p.displayName)} disabled={actionId === p.id || !p.online}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-40">
                              {actionId === p.id ? <RotateCcw size={10} className="animate-spin" /> : <LogOut size={10} />}
                            </button>
                            <button onClick={() => handleBan(p.id, p.displayName)} disabled={actionId === p.id}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40">
                              {actionId === p.id ? <RotateCcw size={10} className="animate-spin" /> : <Ban size={10} />}
                            </button>
                            {p.ip && (
                              <button onClick={() => handleBanIp(p.ip!)} disabled={actionId === 'ip:' + p.ip}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-40">
                                {actionId === 'ip:' + p.ip ? <RotateCcw size={10} className="animate-spin" /> : <ShieldBan size={10} />}
                              </button>
                            )}
                          </div>
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
      {whisperTarget && <WhisperModal playerId={whisperTarget.id} playerName={whisperTarget.name} onClose={() => setWhisperTarget(null)} />}
    </div>
  );
}
