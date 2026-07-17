import { useEffect, useState } from 'react';
import { X, Shield, BadgeCheck, Trophy, Swords, ExternalLink } from 'lucide-react';
import { api, PlayerProfileView } from './api';
import { useNavigateTab } from './TabContext';

export default function PlayerViewModal({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const [profile, setProfile] = useState<PlayerProfileView | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigateTab();

  useEffect(() => {
    let cancelled = false;
    api<PlayerProfileView>('/accounts/' + accountId + '/profile')
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const totalGames = profile ? profile.wins + profile.losses + profile.draws : 0;
  const winPct = totalGames > 0 ? ((profile!.wins / totalGames) * 100).toFixed(1) : '—';

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-[380px] max-w-[90vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {error ? (
          <div className="p-6 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
            >
              Close
            </button>
          </div>
        ) : !profile ? (
          <div className="p-6 text-center text-[#888] text-sm">Loading profile...</div>
        ) : (
          <>
            {/* Header with close */}
            <div className="flex justify-end px-4 pt-4">
              <button onClick={onClose} className="text-[#888] hover:text-[#ccc] p-1">
                <X size={18} />
              </button>
            </div>

            {/* Avatar */}
            <div className="flex justify-center">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#2a2a2a] flex items-center justify-center text-2xl text-[#555] font-bold">
                  {(profile.displayName || profile.username || '?')[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex justify-center mt-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs ${profile.isOnline ? 'text-green-400' : 'text-gray-500'}`}
              >
                <span className={`w-2 h-2 rounded-full ${profile.isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
                {profile.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Name and badges */}
            <div className="text-center mt-2 px-6">
              <h2 className="text-lg font-bold text-[#e0e0e0]">{profile.displayName || profile.username}</h2>
              {profile.username && profile.displayName && profile.username !== profile.displayName && (
                <p className="text-xs text-[#888]">@{profile.username}</p>
              )}
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-900 text-blue-400">
                  Registered
                </span>
                {profile.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-900 text-sky-400">
                    <BadgeCheck size={10} /> Verified
                  </span>
                )}
                {profile.isAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-900 text-purple-400">
                    <Shield size={10} /> Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-[#888] mt-2">Joined {new Date(profile.createdAt).toLocaleDateString()}</p>
            </div>

            {/* Rating */}
            <div className="flex justify-center mt-4">
              <div className="flex items-center gap-1.5 px-4 py-2 bg-[#222] rounded-lg">
                <Trophy size={14} className="text-yellow-400" />
                <span className="text-lg font-bold text-[#4a9eff]">{profile.rating}</span>
                <span className="text-xs text-[#888]">Rating</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex justify-center gap-6 mt-4 px-6 py-3 border-t border-[#2a2a2a] mx-4">
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">{profile.wins}</div>
                <div className="text-[10px] text-[#888] uppercase tracking-wider">Wins</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-red-400">{profile.losses}</div>
                <div className="text-[10px] text-[#888] uppercase tracking-wider">Losses</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-400">{profile.draws}</div>
                <div className="text-[10px] text-[#888] uppercase tracking-wider">Draws</div>
              </div>
            </div>

            {/* Win rate */}
            <div className="text-center text-xs text-[#888] pb-3 px-6">
              {totalGames > 0 ? (
                <>
                  {totalGames} games · Win rate {winPct}%
                </>
              ) : (
                <>No games played</>
              )}
            </div>

            {/* Current game */}
            {profile.currentGameId && (
              <div className="px-6 pb-3">
                <button
                  onClick={() => {
                    onClose();
                    navigate('replay', { gameId: profile.currentGameId! });
                  }}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs bg-green-700 text-white rounded-lg hover:bg-green-800"
                >
                  <Swords size={12} /> In a game
                  <ExternalLink size={12} />
                </button>
              </div>
            )}

            {/* Games button */}
            <div className="px-6 pb-4">
              <button
                onClick={() => {
                  onClose();
                  navigate('accounts');
                }}
                className="w-full px-3 py-2 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
              >
                View all accounts
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
