import { useEffect, useState } from 'react';
import { Radio, RotateCcw, Wifi, Eye, Activity } from 'lucide-react';
import { api, WsConnectionInfo } from './api';

export default function WebSocketMonitorTab() {
  const [data, setData] = useState<WsConnectionInfo | null>(null);
  const [error, setError] = useState('');

  function load() {
    api<WsConnectionInfo>('/ws')
      .then(setData)
      .catch((e) => setError(e.message));
  }

  // load on mount, manual refresh button
  useEffect(load, []);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return <p className="text-[#666] text-center py-12">Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
          <Radio size={16} className="text-purple-400" />
          WebSocket Monitor
        </h2>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
        >
          <RotateCcw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-[#4a9eff]">{data.totalPlayerConnections}</div>
          <div className="text-xs text-[#888] mt-1">Total Player WS</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-green-400">{data.connectedPlayers}</div>
          <div className="text-xs text-[#888] mt-1">Connected Players</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-purple-400">{data.totalSpectatorConnections}</div>
          <div className="text-xs text-[#888] mt-1">Total Spectator WS</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-orange-400">{data.spectatedGames}</div>
          <div className="text-xs text-[#888] mt-1">Spectated Games</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-red-400">{data.disconnectEvents}</div>
          <div className="text-xs text-[#888] mt-1 flex items-center justify-center gap-1">
            <Activity size={10} /> Disconnects
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#888] uppercase mb-3 flex items-center gap-1">
            <Wifi size={12} /> Player Connections ({data.players.length})
          </h3>
          {data.players.length === 0 ? (
            <p className="text-xs text-[#666]">No players connected.</p>
          ) : (
            <div className="space-y-1">
              {data.players.map((p) => (
                <div key={p.playerId} className="flex items-center justify-between px-3 py-2 bg-[#222] rounded text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-[#ccc]">{p.username}</span>
                    <span className="text-[#555] font-mono">{p.playerId.slice(0, 8)}</span>
                  </div>
                  <span className="text-[#888]">
                    {p.connectionCount} connection{p.connectionCount !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#888] uppercase mb-3 flex items-center gap-1">
            <Eye size={12} /> Spectator Connections ({data.spectators.length})
          </h3>
          {data.spectators.length === 0 ? (
            <p className="text-xs text-[#666]">No spectators.</p>
          ) : (
            <div className="space-y-1">
              {data.spectators.map((s) => (
                <div key={s.gameId} className="flex items-center justify-between px-3 py-2 bg-[#222] rounded text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="font-mono text-[#ccc]">{s.gameId.slice(0, 12)}&hellip;</span>
                  </div>
                  <span className="text-[#888]">
                    {s.connectionCount} connection{s.connectionCount !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
