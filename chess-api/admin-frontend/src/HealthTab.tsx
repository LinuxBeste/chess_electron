import { useEffect, useState, useRef } from 'react';
import { HeartPulse, RotateCcw, Database, Server, Gamepad2, TrendingUp } from 'lucide-react';
import { api, HealthStatus } from './api';

function fmtBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

// inline SVG sparkline for latency trend, needs 2+ data points
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(120);
  const h = 30;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.length < 2) return null;
  const maxVal = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / maxVal) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function HealthTab() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState('');
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    api<HealthStatus>('/health')
      .then(setHealth)
      .catch((e) => setError(e.message));
    api<{ history: number[] }>('/health/history')
      .then((d) => setLatencyHistory(d.history))
      .catch(() => {});
  }

  // poll health status every 15s, cleanup on unmount
  useEffect(() => {
    load();
    pollingRef.current = setInterval(load, 15000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!health) return <p className="text-[#666] text-center py-12">Loading...</p>;

  const overallOk = health.status === 'ok' && health.database.connected;
  const checkAge = Date.now() - health.timestamp;
  const ageColor = checkAge < 30000 ? 'text-green-400' : checkAge < 60000 ? 'text-yellow-400' : 'text-red-400'; // fresh / stale / expired

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
          <HeartPulse size={16} className="text-red-400" />
          Health Check
          <span className={`text-xs font-normal ${ageColor}`}>
            · {checkAge < 1000 ? 'just now' : `${Math.floor(checkAge / 1000)}s ago`}
          </span>
        </h2>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
        >
          <RotateCcw size={14} /> Refresh
        </button>
      </div>

      <div
        className={`px-4 py-3 rounded-lg mb-4 text-sm font-semibold ${overallOk ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}
      >
        {overallOk ? 'All systems operational' : 'System issues detected'}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#888] uppercase mb-3 flex items-center gap-1">
            <Database size={12} /> Database
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">Connected</div>
              <div className={`font-semibold mt-0.5 ${health.database.connected ? 'text-green-400' : 'text-red-400'}`}>
                {health.database.connected ? 'Yes' : 'No'}
              </div>
            </div>
            {health.database.latencyMs !== undefined && (
              <div className="bg-[#222] rounded p-3">
                <div className="text-xs text-[#888]">Latency</div>
                <div className="font-semibold mt-0.5 text-[#4a9eff]">
                  {health.database.latencyMs >= 1
                    ? `${health.database.latencyMs.toFixed(2)}ms`
                    : `${(health.database.latencyMs * 1000).toFixed(1)}μs`}
                </div>
              </div>
            )}
          </div>
          {latencyHistory.length > 0 && (
            <div className="mt-3 bg-[#222] rounded p-3">
              <div className="text-xs text-[#888] mb-1 flex items-center gap-1">
                <TrendingUp size={10} /> Latency Trend
              </div>
              <MiniSparkline data={latencyHistory} color="#4a9eff" />
            </div>
          )}
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#888] uppercase mb-3 flex items-center gap-1">
            <Gamepad2 size={12} /> Game Engine
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">Active Games</div>
              <div className="font-semibold mt-0.5 text-[#e0e0e0]">{health.game.activeGames}</div>
            </div>
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">Online Players</div>
              <div className="font-semibold mt-0.5 text-[#e0e0e0]">{health.game.onlinePlayers}</div>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h3 className="text-xs font-semibold text-[#888] uppercase mb-3 flex items-center gap-1">
            <Server size={12} /> Server
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">Uptime</div>
              <div className="font-semibold mt-0.5 text-[#e0e0e0]">{fmtUptime(health.server.uptime)}</div>
            </div>
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">Node.js</div>
              <div className="font-semibold mt-0.5 text-[#e0e0e0]">{health.server.nodeVersion}</div>
            </div>
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">PID</div>
              <div className="font-semibold mt-0.5 text-[#e0e0e0]">{health.server.pid}</div>
            </div>
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">RSS</div>
              <div className="font-semibold mt-0.5 text-[#e0e0e0]">{fmtBytes(health.server.memory.rss)}</div>
            </div>
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">Heap Used</div>
              <div className="font-semibold mt-0.5 text-[#e0e0e0]">{fmtBytes(health.server.memory.heapUsed)}</div>
            </div>
            <div className="bg-[#222] rounded p-3">
              <div className="text-xs text-[#888]">Heap Total</div>
              <div className="font-semibold mt-0.5 text-[#e0e0e0]">{fmtBytes(health.server.memory.heapTotal)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
