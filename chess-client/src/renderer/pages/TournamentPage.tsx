import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import logger from '../logger';
import * as api from '../api';
import { store } from '../store';
import { t } from '../translate';
import { useNavigate } from 'react-router-dom';
import { copyToClipboard } from '../clipboard';
import { ArrowLeft, X } from 'lucide-react';
import { SkeletonCard } from '../components/Skeleton';
import type { TournamentData } from '../../types';

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
        await copyToClipboard(result.join_code);
        store.toast('Code copied: ' + result.join_code, 'info');
      }
      onClose();
      window.location.hash = '#/tournaments';
    } catch (err: unknown) {
      store.toast(err instanceof Error ? err.message : String(err), 'error');
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
  tournament: TournamentData;
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
    } catch (err: unknown) {
      store.toast(err instanceof Error ? err.message : String(err), 'error');
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
    } catch (err: unknown) {
      store.toast(err instanceof Error ? err.message : String(err), 'error');
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
            <X size={18} />
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
  const [searchParams, setSearchParams] = useSearchParams();
  const myId = store.get('playerId');
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [selected, setSelected] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);

  useEffect(() => {
    load();
  }, []);

  /* On mount, auto-open tournament from ?id= param */
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      api
        .getTournament(id)
        .then((t) => setSelected(t))
        .catch(() => {});
    }
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
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('id', id);
          return next;
        },
        { replace: true },
      );
    } catch {
      logger.warn('Failed to load tournament');
    }
  }

  async function handleJoin(tid: string) {
    try {
      await api.joinTournament(tid);
      store.toast('Joined tournament!', 'info');
      openDetails(tid);
    } catch (err: unknown) {
      store.toast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function handleLeave(tid: string) {
    try {
      await api.leaveTournament(tid);
      store.toast('Left tournament', 'info');
      openDetails(tid);
    } catch (err: unknown) {
      store.toast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function handleStart(tid: string) {
    try {
      await api.startTournament(tid);
      store.toast('Tournament started!', 'info');
      openDetails(tid);
    } catch (err: unknown) {
      store.toast(err instanceof Error ? err.message : String(err), 'error');
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
    } catch (err: unknown) {
      store.toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setJoiningCode(false);
    }
  }

  function handleCopyCode() {
    if (selected?.join_code) {
      copyToClipboard(selected.join_code);
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

  function renderBracket(matches: NonNullable<TournamentData['matches']>) {
    if (!matches || matches.length === 0)
      return <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: 24 }}>No matches yet</p>;
    const nameMap = new Map<string, string>();
    for (const p of selected?.participants || []) {
      nameMap.set(p.player_id, p.display_name || p.player_id.slice(0, 8));
    }
    function playerName(pid: string | null | undefined): string {
      if (!pid) return 'BYE';
      if (pid === myId) return t('common.you');
      return nameMap.get(pid) || pid.slice(0, 8);
    }
    const rounds = [...new Set(matches.map((m) => m.round))].sort();
    return (
      <div style={{ display: 'flex', gap: 24, overflowX: 'auto', padding: '8px 0' }}>
        {rounds.map((round) => {
          const roundMatches = matches.filter((m) => m.round === round);
          return (
            <div key={round} style={{ minWidth: 220 }}>
              <h4
                style={{ fontSize: 12, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}
              >
                Round {round}
              </h4>
              {roundMatches.map((m) => (
                <div
                  key={m.id}
                  className="card"
                  style={{ padding: 10, marginBottom: 8, fontSize: 12, cursor: m.game_id ? 'pointer' : undefined }}
                  onClick={() => m.game_id && navigate('/result/' + m.game_id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: m.winner_id === m.white_player_id ? '#4f8ef7' : '#888',
                    }}
                  >
                    <span>{playerName(m.white_player_id)}</span>
                    {m.winner_id === m.white_player_id && <span style={{ fontSize: 10, fontWeight: 700 }}>WIN</span>}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: m.winner_id === m.black_player_id ? '#4f8ef7' : '#888',
                    }}
                  >
                    <span>{playerName(m.black_player_id)}</span>
                    {m.winner_id === m.black_player_id && <span style={{ fontSize: 10, fontWeight: 700 }}>WIN</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 4, textAlign: 'center' }}>
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
      <div className="page-container" style={{ padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 16px' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSelected(null);
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('id');
                  return next;
                },
                { replace: true },
              );
            }}
          >
            <ArrowLeft size={16} style={{ marginRight: 4 }} /> Back
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

        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Players</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {selected.participantCount || selected.participants?.length || 0} / {selected.max_players}
              </div>
            </div>
            {selected.created_at && (
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Created</div>
                <div style={{ fontSize: 13 }}>
                  {new Date(selected.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
            {selected.started_at && (
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Started</div>
                <div style={{ fontSize: 13 }}>
                  {new Date(selected.started_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
            {selected.completed_at && (
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Completed</div>
                <div style={{ fontSize: 13 }}>
                  {new Date(selected.completed_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
            {selected.started_at && selected.completed_at && (
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Duration</div>
                <div style={{ fontSize: 13 }}>
                  {Math.floor((selected.completed_at - selected.started_at) / 60000)} min
                </div>
              </div>
            )}
            {selected.winner_id && (
              <div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>Winner</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f5a623' }}>
                  {selected.participants?.find((p) => p.player_id === selected.winner_id)?.display_name ||
                    selected.winner_id?.slice(0, 8)}
                </div>
              </div>
            )}
          </div>
          {selected.status === 'waiting' && selected.max_players > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width:
                        ((selected.participantCount || selected.participants?.length || 0) / selected.max_players) *
                          100 +
                        '%',
                      height: 6,
                      background: 'var(--accent)',
                      borderRadius: 3,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: '#888' }}>
                  {Math.round(
                    ((selected.participantCount || selected.participants?.length || 0) / selected.max_players) * 100,
                  )}
                  %
                </span>
              </div>
            </div>
          )}
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
            {!selected.participants?.find((p) => p.player_id === myId) ? (
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

        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Participants ({selected.participants?.length || 0} / {selected.max_players})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(selected.participants || []).map((p) => (
              <div
                key={p.id || p.player_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/profile/' + p.player_id)}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: p.player_id === myId ? 'var(--primary)' : '#2a2a2a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#ddd',
                    flexShrink: 0,
                  }}
                >
                  {(p.display_name || p.player_id || '?')[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.display_name || p.player_id?.slice(0, 8)}</span>
                {p.player_id === myId && (
                  <span style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 'auto' }}>You</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {(selected.matches?.length || 0) > 0 && (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Bracket</h3>
            {renderBracket(selected.matches ?? [])}
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
    <div className="page-container" style={{ padding: '0 24px' }}>
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
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} width={260} height={180} />
          ))}
        </div>
      ) : tournaments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{t('tournaments.none')}</div>
      ) : (
        <div>
          {tournaments.map((t) => {
            const players = t.participantCount || t.participants?.length || 0;
            const isCreator = t.created_by === myId;
            const participants = t.participants || [];
            const maxShow = 5;
            const extra = Math.max(0, players - maxShow);
            const createdDate = t.created_at ? new Date(t.created_at) : null;
            const createdStr =
              createdDate && t.created_at
                ? Date.now() - t.created_at < 86400000
                  ? Math.floor((Date.now() - t.created_at) / 3600000) + 'h ago'
                  : createdDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : null;
            return (
              <div
                key={t.id}
                className="game-card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
                onClick={() => openDetails(t.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.name}
                    {isCreator && (
                      <span style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 6, fontWeight: 400 }}>
                        (Creator)
                      </span>
                    )}
                  </div>
                  {participants.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                      {participants.slice(0, maxShow).map((p, idx) => (
                        <span
                          key={p.id || p.player_id + idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: p.player_id === myId ? 'var(--primary)' : '#2a2a2a',
                            color: '#ccc',
                            fontSize: 10,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                          title={p.display_name || p.player_id}
                        >
                          {(p.display_name || p.player_id || '?')[0].toUpperCase()}
                        </span>
                      ))}
                      {extra > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{extra}</span>}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    {players} / {t.max_players} {players === 1 ? 'player' : 'players'}
                    {t.is_private === 1 && <span style={{ marginLeft: 8 }}>— Private</span>}
                    {createdStr && <span style={{ marginLeft: 8, color: '#555' }}>{createdStr}</span>}
                  </div>
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}
                >
                  <span className={`badge badge-${t.status}`} style={{ fontSize: 11 }}>
                    {t.status}
                  </span>
                  {players === t.max_players && t.status === 'waiting' && (
                    <span style={{ fontSize: 9, color: 'var(--success)', fontWeight: 600 }}>Full</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
