import { useEffect, useState } from 'react';
import { Trophy, Trash2, RotateCcw, Users, Swords, Edit3, Play, X, Bell, Copy } from 'lucide-react';
import { api } from './api';
import { useToast } from './Toast';
import SearchBar from './SearchBar';

interface Tournament {
  id: string;
  name: string;
  status: string;
  created_by: string;
  max_players: number;
  created_at: number;
  participantCount: number;
}

interface TournamentParticipant {
  player_id: string;
  display_name?: string;
  seed?: number;
}

interface TournamentMatch {
  id: string;
  round: number;
  white_player_id?: string;
  black_player_id?: string;
  winner?: string;
}

interface TournamentDetail {
  id: string;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
}

function EditTournamentModal({ tournament, onClose, onSaved }: { tournament: Tournament; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tournament.name);
  const [maxPlayers, setMaxPlayers] = useState(String(tournament.max_players));
  const [status, setStatus] = useState(tournament.status);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      await api('/tournaments/' + tournament.id, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), maxPlayers: parseInt(maxPlayers, 10) || 2, status }),
      });
      onSaved();
      onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-[380px] max-w-[90vw]">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-semibold text-[#e0e0e0]">Edit Tournament</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#ccc]"><X size={18} /></button>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs text-[#888] block mb-1">Name</label>
            <input className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Max Players</label>
            <input type="number" min={2} max={256} className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff] cursor-pointer">
              <option value="waiting">Waiting</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 text-xs bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloneTournamentModal({ tournament, onClose, onSaved }: { tournament: Tournament; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tournament.name + ' (Copy)');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleClone() {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      await api('/tournaments/' + tournament.id + '/clone', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      onSaved();
      onClose();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-[380px] max-w-[90vw]">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-semibold text-[#e0e0e0]">Clone Tournament</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#ccc]"><X size={18} /></button>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div>
          <label className="text-xs text-[#888] block mb-1">New Name</label>
          <input className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">Cancel</button>
          <button onClick={handleClone} disabled={saving}
            className="px-3 py-1.5 text-xs bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] disabled:opacity-60">
            {saving ? 'Cloning...' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BracketView({ matches }: { matches: TournamentMatch[] }) {
  const maxRound = Math.max(...matches.map((m) => m.round), 0);
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  return (
    <div className="flex gap-4 overflow-x-auto py-2">
      {rounds.length === 0 ? (
        <span className="text-xs text-[#555]">No matches</span>
      ) : (
        rounds.map((r) => {
          const roundMatches = matches.filter((m) => m.round === r);
          return (
            <div key={r} className="min-w-[120px]">
              <div className="text-[10px] text-[#555] uppercase font-semibold mb-2 text-center">Round {r}</div>
              {roundMatches.map((m) => (
                <div key={m.id} className="bg-[#222] rounded px-2 py-1.5 mb-1 text-[10px]">
                  <div className={`flex items-center gap-1 ${m.winner === m.white_player_id ? 'text-green-400' : 'text-[#ccc]'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    {m.white_player_id ? m.white_player_id.slice(0, 8) : 'BYE'}
                  </div>
                  <div className={`flex items-center gap-1 ${m.winner === m.black_player_id ? 'text-green-400' : 'text-[#ccc]'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-black/40" />
                    {m.black_player_id ? m.black_player_id.slice(0, 8) : 'BYE'}
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

function fmtDuration(createdAt: number): string {
  const diff = Math.floor((Date.now() - createdAt) / 1000);
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return 'Now';
}

export default function TournamentsTab() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [forceStarting, setForceStarting] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [cloning, setCloning] = useState<Tournament | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [sortKey, setSortKey] = useState('date');
  const [sortAsc, setSortAsc] = useState(false);
  const { addToast } = useToast();

  function load() {
    api<Tournament[]>('/tournaments')
      .then(setTournaments)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  let detailCancel: (() => void) | null = null;
  function loadDetail(id: string) {
    if (detailCancel) detailCancel();
    let cancelled = false;
    detailCancel = () => { cancelled = true; };
    api<TournamentDetail>('/tournaments/' + id)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) addToast(e instanceof Error ? err.message : String(e), 'error'); });
  }

  const filtered = (query
    ? tournaments.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()) || t.id.toLowerCase().includes(query.toLowerCase()))
    : tournaments
  ).sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === 'date') return (a.created_at - b.created_at) * dir;
    if (sortKey === 'players') return (a.participantCount - b.participantCount) * dir;
    return String(a[sortKey as keyof typeof a] || '').localeCompare(String(b[sortKey as keyof typeof b] || '')) * dir;
  });

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete tournament "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api('/tournaments/' + id, { method: 'DELETE' });
      addToast('Tournament deleted', 'success');
      load();
      if (expanded === id) { setExpanded(null); setDetail(null); }
    } catch (err: unknown) { addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally { setDeleting(null); }
  }

  async function handleForceStart(id: string, name: string) {
    if (!confirm(`Force start tournament "${name}"?`)) return;
    setForceStarting(id);
    try {
      await api('/tournaments/' + id + '/force-start', { method: 'POST' });
      addToast('Tournament started!', 'success');
      load();
    } catch (err: unknown) { addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally { setForceStarting(null); }
  }

  async function handleNotifyAll(id: string, name: string) {
    if (!confirm(`Send notification to all participants of "${name}"?`)) return;
    setNotifying(id);
    try {
      await api('/tournaments/' + id + '/notify', { method: 'POST' });
      addToast('Notification sent!', 'success');
    } catch (err: unknown) { addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally { setNotifying(null); }
  }

  function toggleDetail(id: string) {
    if (expanded === id) { setExpanded(null); setDetail(null); }
    else { setExpanded(id); loadDetail(id); }
  }

  const statusColors: Record<string, string> = {
    waiting: 'bg-yellow-900 text-yellow-400',
    running: 'bg-green-900 text-green-400',
    completed: 'bg-blue-900 text-blue-400',
  };

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
              <Trophy size={16} className="text-yellow-400" />
              Tournaments
            </h2>
            <div className="w-72">
              <SearchBar value={query} onChange={setQuery} placeholder="Search by name or ID..."
                sortOptions={[
                  { key: 'date', label: 'Date' },
                  { key: 'name', label: 'Name' },
                  { key: 'status', label: 'Status' },
                  { key: 'players', label: 'Players' },
                ]}
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSortChange={(k, a) => { setSortKey(k); setSortAsc(a); }}
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          {filtered.length === 0 ? (
            <p className="text-[#666] text-center py-8">{query ? 'No matching tournaments.' : 'No tournaments.'}</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <div key={t.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#222]" onClick={() => toggleDetail(t.id)}>
                    <div className="flex items-center gap-3">
                      <Trophy size={16} className="text-yellow-400" />
                      <div>
                        <div className="text-sm font-medium text-[#e0e0e0]">{t.name}</div>
                        <div className="text-xs text-[#666]">
                          {new Date(t.created_at).toLocaleDateString()} · {t.participantCount}/{t.max_players} players · {fmtDuration(t.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusColors[t.status] || 'bg-gray-800 text-gray-400'}`}>{t.status}</span>
                      {t.status === 'waiting' && (
                        <>
                          <button onClick={() => handleForceStart(t.id, t.name)} disabled={forceStarting === t.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40" title="Force start">
                            {forceStarting === t.id ? <RotateCcw size={10} className="animate-spin" /> : <Play size={10} />}
                          </button>
                          <button onClick={() => handleNotifyAll(t.id, t.name)} disabled={notifying === t.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40" title="Notify all participants">
                            {notifying === t.id ? <RotateCcw size={10} className="animate-spin" /> : <Bell size={10} />}
                          </button>
                        </>
                      )}
                      <button onClick={() => setCloning(t)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700" title="Clone tournament">
                        <Copy size={10} />
                      </button>
                      <button onClick={() => setEditing(t)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                        <Edit3 size={10} />
                      </button>
                      <button onClick={() => handleDelete(t.id, t.name)} disabled={deleting === t.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40">
                        {deleting === t.id ? <RotateCcw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      </button>
                    </div>
                  </div>

                  {expanded === t.id && detail && detail.id === t.id && (
                    <div className="border-t border-[#2a2a2a] px-4 py-3 bg-[#181818]">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                        <div>
                          <h4 className="text-xs font-semibold text-[#888] uppercase mb-2 flex items-center gap-1"><Users size={12} /> Participants ({detail.participants.length})</h4>
                          <div className="text-xs text-[#ccc] space-y-1">
                            {detail.participants.map((p) => (
                              <div key={p.player_id} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                {p.display_name || p.player_id.slice(0, 8)}
                                {p.seed && <span className="text-[#555]">(Seed #{p.seed})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-[#888] uppercase mb-2 flex items-center gap-1"><Swords size={12} /> Bracket</h4>
                          <BracketView matches={detail.matches} />
                        </div>
                      </div>
                      <div className="text-xs text-[#555]">Created by: {t.created_by.slice(0, 8)}… · ID: {t.id}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {editing && <EditTournamentModal tournament={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {cloning && <CloneTournamentModal tournament={cloning} onClose={() => setCloning(null)} onSaved={load} />}
    </div>
  );
}
