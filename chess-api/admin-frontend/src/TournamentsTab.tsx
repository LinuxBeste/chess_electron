import { useEffect, useState } from 'react';
import { Trophy, Trash2, RotateCcw, Users, Swords } from 'lucide-react';
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

export default function TournamentsTab() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const { addToast } = useToast();

  function load() {
    api<Tournament[]>('/tournaments')
      .then(setTournaments)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  function loadDetail(id: string) {
    api('/tournaments/' + id)
      .then(setDetail)
      .catch((e) => addToast(e.message, 'error'));
  }

  const filtered = query
    ? tournaments.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.id.toLowerCase().includes(query.toLowerCase()),
      )
    : tournaments;

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete tournament "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api('/tournaments/' + id, { method: 'DELETE' });
      addToast('Tournament deleted', 'success');
      load();
      if (expanded === id) {
        setExpanded(null);
        setDetail(null);
      }
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setDeleting(null);
    }
  }

  function toggleDetail(id: string) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
    } else {
      setExpanded(id);
      loadDetail(id);
    }
  }

  const statusColors: Record<string, string> = {
    waiting: 'bg-yellow-900 text-yellow-400',
    running: 'bg-green-900 text-green-400',
    completed: 'bg-blue-900 text-blue-400',
  };

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
              <Trophy size={16} className="text-yellow-400" />
              Tournaments
            </h2>
            <div className="w-56">
              <SearchBar value={query} onChange={setQuery} placeholder="Search by name or ID..." />
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
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#222]"
                    onClick={() => toggleDetail(t.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Trophy size={16} className="text-yellow-400" />
                      <div>
                        <div className="text-sm font-medium text-[#e0e0e0]">{t.name}</div>
                        <div className="text-xs text-[#666]">
                          {new Date(t.created_at).toLocaleDateString()} &middot; {t.participantCount}/{t.max_players} players
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusColors[t.status] || 'bg-gray-800 text-gray-400'}`}
                      >
                        {t.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t.id, t.name);
                        }}
                        disabled={deleting === t.id}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40"
                      >
                        {deleting === t.id ? <RotateCcw size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      </button>
                    </div>
                  </div>

                  {expanded === t.id && detail && detail.id === t.id && (
                    <div className="border-t border-[#2a2a2a] px-4 py-3 bg-[#181818]">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                        <div>
                          <h4 className="text-xs font-semibold text-[#888] uppercase mb-2 flex items-center gap-1">
                            <Users size={12} /> Participants ({detail.participants.length})
                          </h4>
                          <div className="text-xs text-[#ccc] space-y-1">
                            {detail.participants.map((p: any) => (
                              <div key={p.player_id} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                {p.display_name || p.player_id.slice(0, 8)}
                                {p.seed && <span className="text-[#555]">(Seed #{p.seed})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-[#888] uppercase mb-2 flex items-center gap-1">
                            <Swords size={12} /> Matches ({detail.matches.length})
                          </h4>
                          <div className="text-xs text-[#ccc] space-y-1">
                            {detail.matches.length === 0 ? (
                              <span className="text-[#555]">No matches yet</span>
                            ) : (
                              detail.matches.map((m: any) => (
                                <div key={m.id} className="flex items-center gap-2">
                                  <span className="text-[#888]">R{m.round}</span>
                                  <span>{m.white_player_id?.slice(0, 8) || 'BYE'}</span>
                                  <span className="text-[#555]">vs</span>
                                  <span>{m.black_player_id?.slice(0, 8) || 'BYE'}</span>
                                  {m.winner && (
                                    <span className="text-green-400">
                                      ({m.winner.slice(0, 8)} won)
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-[#555]">
                        Created by: {t.created_by.slice(0, 8)}&hellip; &middot; ID: {t.id}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
