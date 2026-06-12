import { useState, useEffect } from 'react';
import logger from '../logger';
import * as api from '../api';
import { store } from '../store';
import { t } from '../translate';
import { useNavigate } from 'react-router-dom';

function CreateTournamentMenu({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await api.createTournament(name.trim(), maxPlayers, isPrivate);
      store.toast('Tournament created!', 'info');
      if (result.join_code) {
        await navigator.clipboard.writeText(result.join_code);
        store.toast('Code copied: ' + result.join_code, 'info');
      }
      onClose();
      window.location.hash = '#/tournaments';
    } catch (err: any) {
      store.toast(err.message || 'Failed to create', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="card"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        width: 340,
        padding: 16,
        marginTop: 6,
        zIndex: 100,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600 }}>
          Tournament Name
        </label>
        <input
          className="input"
          type="text"
          placeholder="Enter name..."
          style={{ width: '100%', fontSize: 13 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600 }}>
          Max Players
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[2, 4, 8, 16, 32, 64].map((n) => (
            <button
              key={n}
              className={`btn btn-sm ${maxPlayers === n ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
              onClick={() => setMaxPlayers(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600 }}>
          Visibility
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn btn-sm ${!isPrivate ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
            onClick={() => setIsPrivate(false)}
          >
            {t('tournaments.public')}
          </button>
          <button
            className={`btn btn-sm ${isPrivate ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
            onClick={() => setIsPrivate(true)}
          >
            {t('tournaments.private')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="btn btn-primary btn-sm"
          style={{ flex: 1, fontSize: 12 }}
          onClick={handleCreate}
          disabled={creating || !name.trim()}
        >
          {creating ? 'Creating...' : t('tournaments.create')}
        </button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ManageTournamentDialog({
  tournament,
  onClose,
  onSaved,
}: {
  tournament: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(tournament.name || '');
  const [maxPlayers, setMaxPlayers] = useState(tournament.max_players || 8);
  const [isPrivate, setIsPrivate] = useState(tournament.is_private === 1);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.updateTournament(tournament.id, { name: name.trim(), maxPlayers, isPrivate });
      store.toast('Tournament updated!', 'info');
      onSaved();
      onClose();
    } catch (err: any) {
      store.toast(err.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this tournament? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.deleteTournament(tournament.id);
      store.toast('Tournament deleted', 'info');
      onClose();
      onSaved();
    } catch (err: any) {
      store.toast(err.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-card"
        style={{ width: 420, maxWidth: '95vw', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Manage Tournament</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 18,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600 }}>
              Tournament Name
            </label>
            <input
              className="input"
              type="text"
              style={{ width: '100%', fontSize: 13 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600 }}>
              Max Players
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[2, 4, 8, 16, 32, 64].map((n) => (
                <button
                  key={n}
                  className={`btn btn-sm ${maxPlayers === n ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
                  onClick={() => setMaxPlayers(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600 }}>
              Visibility
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`btn btn-sm ${!isPrivate ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
                onClick={() => setIsPrivate(false)}
              >
                {t('tournaments.public')}
              </button>
              <button
                className={`btn btn-sm ${isPrivate ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: 11, padding: '4px 0' }}
                onClick={() => setIsPrivate(true)}
              >
                {t('tournaments.private')}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1, fontSize: 12 }}
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={onClose}>
              Cancel
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
            <button
              className="btn btn-sm"
              style={{ fontSize: 12, color: '#e74c3c', borderColor: '#e74c3c' }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Tournament'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TournamentPage() {
  const navigate = useNavigate();
  const myId = store.get('playerId');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function handleToggleCreate() {
    setShowCreate((v) => !v);
  }

  function handleCloseCreate() {
    setShowCreate(false);
  }

  async function load() {
    setLoading(true);
    try {
      const tlist = await api.getTournaments();
      setTournaments(tlist);
    } catch {
      logger.warn('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(id: string) {
    try {
      const t = await api.getTournament(id);
      setSelected(t);
    } catch {
      logger.warn('Failed to load tournament');
    }
  }

  async function handleJoin(tid: string) {
    try {
      await api.joinTournament(tid);
      store.toast('Joined tournament!', 'info');
      openDetails(tid);
    } catch (err: any) {
      store.toast(err.message || 'Failed to join', 'error');
    }
  }

  async function handleLeave(tid: string) {
    try {
      await api.leaveTournament(tid);
      store.toast('Left tournament', 'info');
      openDetails(tid);
    } catch (err: any) {
      store.toast(err.message || 'Failed to leave', 'error');
    }
  }

  async function handleStart(tid: string) {
    try {
      await api.startTournament(tid);
      store.toast('Tournament started!', 'info');
      openDetails(tid);
    } catch (err: any) {
      store.toast(err.message || 'Failed to start', 'error');
    }
  }

  async function handleJoinByCode() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoiningCode(true);
    try {
      const t = await api.joinTournamentByCode(code);
      store.toast('Joined tournament!', 'info');
      setJoinCode('');
      openDetails(t.id);
    } catch (err: any) {
      store.toast(err.message || 'Invalid code', 'error');
    } finally {
      setJoiningCode(false);
    }
  }

  function handleCopyCode() {
    if (selected?.join_code) {
      navigator.clipboard.writeText(selected.join_code);
      store.toast(t('tournaments.codeCopied'), 'info');
    }
  }

  function handleManageSaved() {
    if (selected) {
      openDetails(selected.id);
    } else {
      load();
    }
  }

  function renderBracket(matches: any[]) {
    if (!matches || matches.length === 0)
      return <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: 24 }}>No matches yet</p>;
    const rounds = [...new Set(matches.map((m: any) => m.round))].sort();
    return (
      <div style={{ display: 'flex', gap: 24, overflowX: 'auto', padding: '8px 0' }}>
        {rounds.map((round) => {
          const roundMatches = matches.filter((m: any) => m.round === round);
          return (
            <div key={round} style={{ minWidth: 200 }}>
              <h4
                style={{ fontSize: 12, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}
              >
                Round {round}
              </h4>
              {roundMatches.map((m: any) => (
                <div
                  key={m.id}
                  className="card"
                  style={{ padding: 10, marginBottom: 8, fontSize: 12, cursor: m.game_id ? 'pointer' : undefined }}
                  onClick={() => m.game_id && navigate('/result/' + m.game_id)}
                >
                  <div style={{ color: m.winner_id === m.white_player_id ? '#4f8ef7' : '#888' }}>
                    {m.white_player_id
                      ? m.white_player_id === myId
                        ? t('common.you')
                        : m.white_player_id?.slice(0, 8)
                      : 'BYE'}
                  </div>
                  <div style={{ color: m.winner_id === m.black_player_id ? '#4f8ef7' : '#888' }}>
                    {m.black_player_id
                      ? m.black_player_id === myId
                        ? t('common.you')
                        : m.black_player_id?.slice(0, 8)
                      : 'BYE'}
                  </div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
                    {m.status === 'completed'
                      ? m.winner_id
                        ? 'Completed'
                        : 'Draw'
                      : m.game_id
                        ? 'Playing'
                        : 'Pending'}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  if (selected) {
    const isCreator = selected.created_by === myId;
    return (
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
            ← Back
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{selected.name}</h2>
          <span className={`badge badge-${selected.status}`}>{selected.status}</span>
          {selected.is_private === 1 && (
            <span className="badge badge-private" style={{ fontSize: 10 }}>
              {t('tournaments.private')}
            </span>
          )}
          {isCreator && <span style={{ fontSize: 11, color: 'var(--primary)', marginLeft: 4 }}>Creator</span>}
        </div>

        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          Players: {selected.participantCount || selected.participants?.length || 0} / {selected.max_players}
        </div>

        {selected.join_code && (
          <div
            className="card"
            style={{
              padding: '12px 16px',
              marginBottom: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onClick={handleCopyCode}
          >
            <span style={{ fontSize: 11, color: '#888' }}>Share Code:</span>
            <code style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', letterSpacing: 1 }}>
              {selected.join_code}
            </code>
            <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>Click to copy</span>
          </div>
        )}

        {selected.status === 'waiting' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {!selected.participants?.find((p: any) => p.player_id === myId) ? (
              <button className="btn btn-primary btn-sm" onClick={() => handleJoin(selected.id)}>
                {t('lobby.join')}
              </button>
            ) : (
              <>
                <span style={{ fontSize: 13, color: 'var(--success)', alignSelf: 'center' }}>Joined</span>
                <button className="btn btn-ghost btn-sm" onClick={() => handleLeave(selected.id)}>
                  {t('friends.remove')}
                </button>
              </>
            )}
            {isCreator && (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => handleStart(selected.id)}>
                  Start
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowManage(true)}>
                  Manage
                </button>
              </>
            )}
          </div>
        )}

        <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Participants</h3>
        <div style={{ marginBottom: 24 }}>
          {(selected.participants || []).map((p: any) => (
            <div key={p.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              {p.display_name || p.player_id?.slice(0, 8)}
            </div>
          ))}
        </div>

        {(selected.matches?.length || 0) > 0 && (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Bracket</h3>
            {renderBracket(selected.matches)}
          </>
        )}

        {showManage && (
          <ManageTournamentDialog
            tournament={selected}
            onClose={() => setShowManage(false)}
            onSaved={handleManageSaved}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 16px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{t('tournaments.title')}</h2>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-primary btn-sm" onClick={handleToggleCreate}>
            {t('tournaments.create')}
          </button>
          {showCreate && <CreateTournamentMenu onClose={handleCloseCreate} />}
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input
          className="input"
          type="text"
          placeholder={t('tournaments.joinByCode') + '...'}
          style={{ flex: 1, fontSize: 13 }}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleJoinByCode}
          disabled={joiningCode || !joinCode.trim()}
        >
          {joiningCode ? '...' : t('tournaments.joinByCode')}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('common.loading')}</div>
      ) : tournaments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('tournaments.none')}</div>
      ) : (
        <div>
          {tournaments.map((t: any) => (
            <div
              key={t.id}
              className="game-card"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
              onClick={() => openDetails(t.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>
                  {t.name}
                  {t.created_by === myId && (
                    <span style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 6, fontWeight: 400 }}>
                      Created by you
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {t.participantCount || 0} players — {t.status}
                </div>
              </div>
              <span className={`badge badge-${t.status}`} style={{ fontSize: 11 }}>
                {t.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
