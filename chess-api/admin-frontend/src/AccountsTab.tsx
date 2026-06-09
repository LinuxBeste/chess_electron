import { useEffect, useState } from 'react';
import { Key, Trash2 } from 'lucide-react';
import { api, AccountRow } from './api';
import SearchBar from './SearchBar';
import AccountEditModal from './AccountEditModal';

export default function AccountsTab() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editAccount, setEditAccount] = useState<AccountRow | null>(null);

  function load() {
    api<AccountRow[]>('/accounts')
      .then(setAccounts)
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  const filtered = query
    ? accounts.filter((a) =>
        [a.id, a.username, a.displayName].some((v) => v && v.toLowerCase().includes(query.toLowerCase())),
      )
    : accounts;

  async function handleReset(id: string) {
    const pw = prompt('New password (min 4 chars):');
    if (!pw || pw.length < 4) return;
    try {
      await api('/accounts/' + id + '/reset-password', { method: 'POST', body: JSON.stringify({ newPassword: pw }) });
      alert('Password reset.');
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`Delete ${username}? This cannot be undone.`)) return;
    try {
      await api('/accounts/' + id, { method: 'DELETE' });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function AvatarCell({ url, username }: { url: string | null; username: string }) {
    if (url) {
      return (
        <img
          src={url}
          alt=""
          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
        />
      );
    }
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: '#666',
        }}
      >
        {username[0]?.toUpperCase() || '?'}
      </div>
    );
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div>
      <div className="mb-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search accounts by ID, username, display name..." />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[#666]">{query ? 'No matching accounts.' : 'No accounts.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
                <th className="text-left px-4 py-2.5">ID</th>
                <th className="text-left px-4 py-2.5">Avatar</th>
                <th className="text-left px-4 py-2.5">Username</th>
                <th className="text-left px-4 py-2.5">Display Name</th>
                <th className="text-left px-4 py-2.5">W / L / D</th>
                <th className="text-left px-4 py-2.5">Created</th>
                <th className="text-left px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
                  <td className="px-4 py-2.5 font-mono">{a.id.slice(0, 8)}&hellip;</td>
                  <td className="px-4 py-2.5"><AvatarCell url={a.avatarUrl} username={a.username} /></td>
                  <td className="px-4 py-2.5">{a.username}</td>
                  <td className="px-4 py-2.5">{a.displayName}</td>
                  <td className="px-4 py-2.5">
                    {a.wins} / {a.losses} / {a.draws}
                  </td>
                  <td className="px-4 py-2.5">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 flex gap-1">
                    <button
                      onClick={() => setEditAccount(a)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#4a9eff] text-white rounded hover:bg-[#3a8eef]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleReset(a.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                    >
                      <Key size={12} /> Reset PW
                    </button>
                    <button
                      onClick={() => handleDelete(a.id, a.username)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editAccount && (
        <AccountEditModal
          account={editAccount}
          onClose={() => setEditAccount(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}