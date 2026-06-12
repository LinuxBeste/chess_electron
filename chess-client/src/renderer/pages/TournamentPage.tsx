import { useState, useEffect } from 'react';
import logger from '../logger';
import * as api from '../api';
import { store } from '../store';
import { t } from '../translate';
import { useNavigate } from 'react-router-dom';

export default function TournamentPage() {
  const navigate = useNavigate();
  const myId = store.get('playerId');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createMax, setCreateMax] = useState(8);

  useEffect(() => {
    load();
  }, []);

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

  async function handleCreate() {
    if (!createName.trim()) return;
    try {
      const t = await api.createTournament(createName.trim(), createMax);
      store.toast('Tournament created!', 'info');
      setShowCreate(false);
      setCreateName('');
      load();
      openDetails(t.id);
    } catch (err: any) {
      store.toast(err.message || 'Failed to create', 'error');
    }
  }

  function renderBracket(matches: any[]) {
    if (!matches || matches.length === 0) return <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: 24 }}>No matches yet</p>;
    const rounds = [...new Set(matches.map((m: any) => m.round))].sort();
    return (
      <div style={{ display: 'flex', gap: 24, overflowX: 'auto', padding: '8px 0' }}>
        {rounds.map((round) => {
          const roundMatches = matches.filter((m: any) => m.round === round);
          return (
            <div key={round} style={{ minWidth: 200 }}>
              <h4 style={{ fontSize: 12, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
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
                    {m.white_player_id ? (m.white_player_id === myId ? t('common.you') : m.white_player_id?.slice(0, 8)) : 'BYE'}
                  </div>
                  <div style={{ color: m.winner_id === m.black_player_id ? '#4f8ef7' : '#888' }}>
                    {m.black_player_id ? (m.black_player_id === myId ? t('common.you') : m.black_player_id?.slice(0, 8)) : 'BYE'}
                  </div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
                    {m.status === 'completed' ? (m.winner_id ? 'Completed' : 'Draw') : m.game_id ? 'Playing' : 'Pending'}
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
    return (
      <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 16px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>← Back</button>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{selected.name}</h2>
          <span className={`badge badge-${selected.status}`}>{selected.status}</span>
        </div>

        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          Players: {selected.participantCount || selected.participants?.length || 0} / {selected.max_players}
        </div>

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
                {selected.created_by === myId && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleStart(selected.id)}>
                    Start
                  </button>
                )}
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
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 16px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{t('tournaments.title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          {t('tournaments.create')}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <input
            className="input"
            type="text"
            placeholder="Tournament name"
            style={{ width: '100%', marginBottom: 8, fontSize: 13 }}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Max players:</span>
            <select className="input" style={{ width: 80, fontSize: 12 }} value={createMax} onChange={(e) => setCreateMax(parseInt(e.target.value))}>
              {[2, 4, 8, 16, 32, 64].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleCreate}>
            {t('tournaments.create')}
          </button>
        </div>
      )}

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
                <div style={{ fontWeight: 500, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {t.participantCount || 0} players — {t.status}
                </div>
              </div>
              <span className={`badge badge-${t.status}`} style={{ fontSize: 11 }}>{t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
