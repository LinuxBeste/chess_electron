import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { api, AccountRow } from './api';

interface Props {
  account: AccountRow;
  onClose: () => void;
  onSaved: () => void;
}

export default function AccountEditModal({ account, onClose, onSaved }: Props) {
  const [username, setUsername] = useState(account.username);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [wins, setWins] = useState(String(account.wins));
  const [losses, setLosses] = useState(String(account.losses));
  const [draws, setDraws] = useState(String(account.draws));
  const [rating, setRating] = useState(String(account.rating || 0));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError('');
    if (!username.trim() || !displayName.trim()) {
      setError('Username and display name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await api('/accounts/' + account.id, {
        method: 'PUT',
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          wins: parseInt(wins, 10) || 0,
          losses: parseInt(losses, 10) || 0,
          draws: parseInt(draws, 10) || 0,
          rating: parseInt(rating, 10) || 0,
        }),
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setSaving(false); }
  }

  async function handleClearAvatar() {
    if (!confirm("Clear this account's profile picture?")) return;
    try {
      await api('/accounts/' + account.id + '/avatar', { method: 'DELETE' });
      onSaved();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
  }

  async function handleTestNotification() {
    try {
      await api('/accounts/' + account.id + '/test-notification', { method: 'POST' });
      alert('Test notification sent.');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 w-[420px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-semibold text-[#e0e0e0]">Edit Account</h2>
          <button onClick={onClose} className="text-[#888] hover:text-[#ccc]"><X size={18} /></button>
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex flex-col gap-3.5">
          {account.avatarUrl && (
            <div className="flex items-center gap-3">
              <img src={account.avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover" />
              <button onClick={handleClearAvatar}
                className="px-2.5 py-1 text-xs border border-[#555] text-[#ccc] rounded hover:bg-[#333]">
                Clear Avatar
              </button>
            </div>
          )}

          <div>
            <label className="text-xs text-[#888] block mb-1">Username</label>
            <input className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Display Name</label>
            <input className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-[#888] block mb-1">Wins</label>
              <input type="number" min={0} className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={wins} onChange={(e) => setWins(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#888] block mb-1">Losses</label>
              <input type="number" min={0} className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={losses} onChange={(e) => setLosses(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#888] block mb-1">Draws</label>
              <input type="number" min={0} className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={draws} onChange={(e) => setDraws(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] block mb-1">Rating</label>
            <input type="number" min={0} className="w-full px-2.5 py-1.5 text-sm bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" value={rating} onChange={(e) => setRating(e.target.value)} />
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-[#222] rounded-lg text-xs text-[#555]">
            <span>ID: <span className="font-mono text-[#888]">{account.id}</span></span>
            <span className="text-[#333]">|</span>
            <span>Created: {new Date(account.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex gap-2 justify-between mt-5">
          <button onClick={handleTestNotification}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">
            <Send size={12} /> Test Notification
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-1.5 text-xs bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
