import { useEffect, useState } from 'react';
import { Key, Trash2, Plus, Eye, UserCheck, X, Download, SearchX, CheckSquare, Square, Shield } from 'lucide-react';
import { api, AccountRow, UserGamesResponse, ImpersonateResponse } from './api';
import { useToast } from './Toast';
import SearchBar from './SearchBar';
import AccountEditModal from './AccountEditModal';

// heuristic client-side password strength: length + char variety
function passwordStrength(pw: string): { label: string; color: string; score: number } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'text-red-400', score };
  if (score <= 3) return { label: 'Medium', color: 'text-yellow-400', score };
  return { label: 'Strong', color: 'text-green-400', score };
}

function CreateAccountModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setSaving(true);
    try {
      await api('/accounts', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password, displayName: displayName.trim() || undefined }),
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const strength = passwordStrength(password);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-[380px] max-w-[90vw]">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-semibold text-[#e0e0e0]">Create Account</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#ccc]">
            <X size={18} />
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs text-[#888] block mb-1">Username *</label>
            <input
              className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Password *</label>
            <input
              type="password"
              className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password && <span className={`text-xs mt-1 ${strength.color}`}>{strength.label}</span>}
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Display Name</label>
            <input
              className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] disabled:opacity-60"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserGamesModal({ userId, username, onClose }: { userId: string; username: string; onClose: () => void }) {
  const [data, setData] = useState<UserGamesResponse | null>(null);
  const [error, setError] = useState('');

  // cancelled flag prevents setState after unmount (fast tab switching)
  useEffect(() => {
    let cancelled = false;
    api<UserGamesResponse>('/accounts/' + userId + '/games')
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-[700px] max-w-[90vw] max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-semibold text-[#e0e0e0]">Games — {username}</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#ccc]">
            <X size={18} />
          </button>
        </div>
        {error ? (
          <p className="text-red-400 text-xs">{error}</p>
        ) : !data ? (
          <p className="text-xs text-[#666]">Loading...</p>
        ) : (
          <>
            {data.active.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-[#4a9eff] mb-2">Active Games ({data.active.length})</h3>
                {data.active.map((g) => (
                  <div key={g.id} className="flex gap-3 px-2.5 py-1.5 bg-[#222] rounded mb-1 text-xs text-[#ccc]">
                    <span className="font-mono text-[#888]">{g.id.slice(0, 8)}</span>
                    <span>
                      {g.white} vs {g.black}
                    </span>
                    <span className="text-[#888]">
                      {g.status} · {g.moves} moves
                    </span>
                  </div>
                ))}
              </div>
            )}
            <h3 className="text-xs font-semibold text-[#888] mb-2">Completed Games ({data.totalCompleted})</h3>
            {data.completed.length === 0 ? (
              <p className="text-xs text-[#666]">No completed games.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#888] border-b border-[#2a2a2a] text-left">
                    <th className="px-2 py-1.5">ID</th>
                    <th className="px-2 py-1.5">White</th>
                    <th className="px-2 py-1.5">Black</th>
                    <th className="px-2 py-1.5">Result</th>
                    <th className="px-2 py-1.5">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.completed.slice(0, 20).map((g) => (
                    <tr key={g.id} className="border-b border-[#222]">
                      <td className="px-2 py-1.5 font-mono text-[#888]">{g.id.slice(0, 8)}</td>
                      <td className="px-2 py-1.5 text-[#ccc]">{g.white}</td>
                      <td className="px-2 py-1.5 text-[#ccc]">{g.black}</td>
                      <td className="px-2 py-1.5">
                        {g.winner === userId ? (
                          <span className="text-green-400">Won</span>
                        ) : g.winner ? (
                          <span className="text-red-400">Lost</span>
                        ) : (
                          <span className="text-yellow-400">Draw</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[#888]">{new Date(g.playedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type SortKey = 'username' | 'displayName' | 'wins' | 'rating' | 'createdAt';

export default function AccountsTab() {
  const { addToast } = useToast();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editAccount, setEditAccount] = useState<AccountRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [gamesUser, setGamesUser] = useState<{ id: string; username: string } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  function load() {
    api<AccountRow[]>('/accounts')
      .then(setAccounts)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const filtered = query
    ? accounts.filter((a) =>
        [a.id, a.username, a.displayName].some((v) => v && v.toLowerCase().includes(query.toLowerCase())),
      )
    : accounts;

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortAsc ? 1 : -1;
    if (sortKey === 'wins') return (a.wins - b.wins) * dir;
    if (sortKey === 'rating') return (a.rating - b.rating) * dir;
    if (sortKey === 'createdAt') return (a.createdAt - b.createdAt) * dir;
    return String(a[sortKey] || '').localeCompare(String(b[sortKey] || '')) * dir;
  });

  function toggleAll() {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((a) => a.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  // sequential bulk delete, tolerates per-account failures
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected account(s)? This cannot be undone.`)) return;
    setDeleting(true);
    let ok = 0,
      fail = 0;
    for (const id of selected) {
      try {
        await api('/accounts/' + id, { method: 'DELETE' });
        ok++;
      } catch {
        fail++;
      }
    }
    addToast(`Deleted ${ok} account(s)` + (fail ? `, ${fail} failed` : ''), fail ? 'error' : 'success');
    setSelected(new Set());
    setDeleting(false);
    load();
  }

  function handleExportCsv() {
    const headers = ['ID', 'Username', 'Display Name', 'Rating', 'Wins', 'Losses', 'Draws', 'Created'];
    const rows = sorted.map((a) => [
      a.id,
      a.username,
      a.displayName,
      String(a.rating),
      String(a.wins),
      String(a.losses),
      String(a.draws),
      new Date(a.createdAt).toISOString(),
    ]);
    // CSV spec: quote-escape embedded double-quotes
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))].join(
      '\n',
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accounts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleReset(id: string) {
    const pw = prompt('New password (min 4 chars):');
    if (!pw || pw.length < 4) return;
    try {
      await api('/accounts/' + id + '/reset-password', { method: 'POST', body: JSON.stringify({ newPassword: pw }) });
      addToast('Password reset.', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`Delete ${username}? This cannot be undone.`)) return;
    try {
      await api('/accounts/' + id, { method: 'DELETE' });
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function handleImpersonate(id: string) {
    try {
      const result = await api<ImpersonateResponse>('/accounts/' + id + '/impersonate', { method: 'POST' });
      addToast('Impersonation token generated for ' + result.username, 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  const totalStats = accounts.reduce(
    (acc, a) => ({
      wins: acc.wins + a.wins,
      losses: acc.losses + a.losses,
      draws: acc.draws + a.draws,
    }),
    { wins: 0, losses: 0, draws: 0 },
  );

  function SortHeader({ k, label }: { k: SortKey; label: string }) {
    return (
      <th className="text-left px-4 py-2.5 cursor-pointer hover:text-[#ccc] select-none" onClick={() => toggleSort(k)}>
        {label} {sortKey === k ? (sortAsc ? '▲' : '▼') : ''}
      </th>
    );
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 flex-1">
          <SearchBar value={query} onChange={setQuery} placeholder="Search accounts by ID, username, display name..." />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#888] hover:text-[#ccc] p-1" title="Clear search">
              <SearchX size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] whitespace-nowrap"
          >
            <Plus size={15} /> Create Account
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-[#222] rounded-lg text-sm">
          <span className="text-[#888]">{selected.size} selected</span>
          <button
            onClick={handleBulkDelete}
            disabled={deleting}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-40"
          >
            <Trash2 size={12} /> Delete Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="px-2 py-1 text-xs text-[#888] hover:text-[#ccc]">
            Clear
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-[#666]">{query ? 'No matching accounts.' : 'No accounts.'}</p>
      ) : (
        <>
          {sorted.length > 0 && (
            <div className="mb-3 flex items-center gap-4 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-xs text-[#888]">
              <span>{sorted.length} accounts</span>
              <span>
                {totalStats.wins}W / {totalStats.losses}L / {totalStats.draws}D
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
                  <th className="text-center px-2 py-2.5 w-8">
                    <button onClick={toggleAll} className="text-[#888] hover:text-[#ccc]">
                      {selected.size === sorted.length && sorted.length > 0 ? (
                        <CheckSquare size={14} />
                      ) : (
                        <Square size={14} />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-4 py-2.5">ID</th>
                  <SortHeader k="username" label="Username" />
                  <SortHeader k="displayName" label="Display Name" />
                  <SortHeader k="rating" label="Rating" />
                  <SortHeader k="wins" label="W/L/D" />
                  <SortHeader k="createdAt" label="Created" />
                  <th className="text-center px-4 py-2.5">Admin</th>
                  <th className="text-left px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
                    <td className="px-2 py-2.5 text-center">
                      <button onClick={() => toggleOne(a.id)} className="text-[#888] hover:text-[#ccc]">
                        {selected.has(a.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-mono">{a.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2.5">{a.username}</td>
                    <td className="px-4 py-2.5">{a.displayName}</td>
                    <td className="px-4 py-2.5 text-[#4a9eff] font-semibold">{a.rating}</td>
                    <td className="px-4 py-2.5">
                      {a.wins} / {a.losses} / {a.draws}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={async () => {
                          try {
                            await api('/accounts/' + a.id + '/toggle-admin', { method: 'PUT' });
                            load();
                          } catch (err: unknown) {
                            addToast(err instanceof Error ? err.message : String(err), 'error');
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                          a.isAdmin
                            ? 'bg-purple-500 text-white hover:bg-purple-600'
                            : 'bg-[#2a2a2a] text-[#888] hover:bg-[#333]'
                        }`}
                        title={a.isAdmin ? 'Revoke admin' : 'Grant admin'}
                      >
                        <Shield size={10} />
                        {a.isAdmin ? 'Yes' : 'No'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => setEditAccount(a)}
                          className="px-2 py-1 text-xs bg-[#4a9eff] text-white rounded hover:bg-[#3a8eef]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setGamesUser({ id: a.id, username: a.username })}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Eye size={10} /> Games
                        </button>
                        <button
                          onClick={() => handleImpersonate(a.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                          <UserCheck size={10} /> Impersonate
                        </button>
                        <button
                          onClick={() => handleReset(a.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                        >
                          <Key size={10} /> Reset PW
                        </button>
                        <button
                          onClick={() => handleDelete(a.id, a.username)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editAccount && <AccountEditModal account={editAccount} onClose={() => setEditAccount(null)} onSaved={load} />}
      {showCreate && <CreateAccountModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {gamesUser && (
        <UserGamesModal userId={gamesUser.id} username={gamesUser.username} onClose={() => setGamesUser(null)} />
      )}
    </div>
  );
}
