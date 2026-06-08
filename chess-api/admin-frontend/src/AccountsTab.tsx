import { useEffect, useState } from 'react';
import { Pencil, Key, Trash2, X } from 'lucide-react';
import { api, AccountRow } from './api';

export default function AccountsTab() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<React.ReactNode | null>(null);

  function load() {
    api<AccountRow[]>('/accounts').then(setAccounts).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleEdit(id: string, name: string) {
    const newName = prompt('Display Name:', name);
    if (!newName || newName.trim() === '') return;
    try {
      await api('/accounts/' + id, { method: 'PUT', body: JSON.stringify({ displayName: newName.trim() }) });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

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

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (accounts.length === 0) return <p className="text-[#666]">No accounts.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
            <th className="text-left px-4 py-2.5">ID</th>
            <th className="text-left px-4 py-2.5">Username</th>
            <th className="text-left px-4 py-2.5">Display Name</th>
            <th className="text-left px-4 py-2.5">W / L / D</th>
            <th className="text-left px-4 py-2.5">Created</th>
            <th className="text-left px-4 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
              <td className="px-4 py-2.5 font-mono">{a.id.slice(0, 8)}&hellip;</td>
              <td className="px-4 py-2.5">{a.username}</td>
              <td className="px-4 py-2.5">{a.displayName}</td>
              <td className="px-4 py-2.5">{a.wins} / {a.losses} / {a.draws}</td>
              <td className="px-4 py-2.5">{new Date(a.createdAt).toLocaleDateString()}</td>
              <td className="px-4 py-2.5 flex gap-1">
                <button
                  onClick={() => handleEdit(a.id, a.displayName)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#4a9eff] text-white rounded hover:bg-[#3a8eef]"
                >
                  <Pencil size={12} /> Edit
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
  );
}
