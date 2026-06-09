import { useState } from 'react';
import { X } from 'lucide-react';
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
        }),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearAvatar() {
    if (!confirm("Clear this account's profile picture?")) return;
    try {
      await api('/accounts/' + account.id + '/avatar', { method: 'DELETE' });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid #333',
    background: '#111',
    color: '#e0e0e0',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: 12,
          padding: 24,
          width: 400,
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Edit Account</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {error && <p style={{ color: '#f44336', fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Avatar preview */}
          {account.avatarUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={account.avatarUrl}
                alt="Avatar"
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
              />
              <button
                onClick={handleClearAvatar}
                style={{
                  background: 'none',
                  border: '1px solid #555',
                  color: '#ccc',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Clear Avatar
              </button>
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Username</label>
            <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Display Name</label>
            <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Wins</label>
              <input type="number" min={0} style={inputStyle} value={wins} onChange={(e) => setWins(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Losses</label>
              <input
                type="number"
                min={0}
                style={inputStyle}
                value={losses}
                onChange={(e) => setLosses(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Draws</label>
              <input
                type="number"
                min={0}
                style={inputStyle}
                value={draws}
                onChange={(e) => setDraws(e.target.value)}
              />
            </div>
          </div>

          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            ID: <span className="font-mono">{account.id}</span> &mdash; Created:{' '}
            {new Date(account.createdAt).toLocaleDateString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #333',
              color: '#aaa',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#4a9eff',
              border: 'none',
              color: '#fff',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
