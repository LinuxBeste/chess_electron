import { useEffect, useState } from 'react';
import { api, Stats, SystemStats } from './api';

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function Bar({ label, value, color, total }: { label: string; value: number; color: string; total: number }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#aaa', marginBottom: 4 }}>
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 8, background: '#2a2a2a', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
      <div className="text-xs text-[#888]">{label}</div>
      <div className="text-sm font-semibold text-[#e0e0e0] mt-0.5">{value}</div>
    </div>
  );
}

export default function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sys, setSys] = useState<SystemStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<Stats>('/stats'),
      api<SystemStats>('/system'),
    ])
      .then(([s, sy]) => { setStats(s); setSys(sy); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!stats || !sys) return <p className="text-[#666]">Loading...</p>;

  const cards = [
    { label: 'Active Games', value: stats.gamesActive },
    { label: 'Online Players', value: stats.playersOnline },
    { label: 'Logged-In Users', value: stats.registeredUsers },
    { label: 'Total Accounts', value: stats.totalUsers },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Game / Player stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
            <div className="text-3xl font-bold text-[#4a9eff]">{c.value}</div>
            <div className="text-xs text-[#888] mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* System Performance */}
      <div>
        <h3 className="text-sm font-semibold text-[#e0e0e0] mb-3 tracking-wide uppercase">System Performance</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column: bars */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="text-xs font-semibold text-[#888] mb-3 uppercase tracking-wide">Usage</div>
            <Bar label="RAM" value={sys.memory.used} color="#4a9eff" total={sys.memory.total} />
            <Bar label="Disk" value={sys.disk.used} color="#4caf50" total={sys.disk.total} />
            <Bar label="Heap" value={sys.process.heapUsed} color="#ff9800" total={sys.process.heapTotal} />
          </div>

          {/* Right column: info cards */}
          <div className="grid grid-cols-2 gap-2">
            <InfoCard label="CPU Cores" value={String(sys.cpu.cores)} />
            <InfoCard label="CPU Model" value={sys.cpu.model.length > 30 ? sys.cpu.model.slice(0, 28) + '…' : sys.cpu.model} />
            <InfoCard label="Load (1m)" value={sys.cpu.loadAverage1.toFixed(2)} />
            <InfoCard label="Load (5m)" value={sys.cpu.loadAverage5.toFixed(2)} />
            <InfoCard label="Load (15m)" value={sys.cpu.loadAverage15.toFixed(2)} />
            <InfoCard label="RAM Total" value={fmtBytes(sys.memory.total)} />
            <InfoCard label="RAM Free" value={fmtBytes(sys.memory.free)} />
            <InfoCard label="RAM Used" value={fmtBytes(sys.memory.used)} />
            <InfoCard label="Disk Total" value={sys.disk.total > 0 ? fmtBytes(sys.disk.total) : 'N/A'} />
            <InfoCard label="Disk Free" value={sys.disk.total > 0 ? fmtBytes(sys.disk.free) : 'N/A'} />
            <InfoCard label="Process Uptime" value={fmtUptime(sys.process.uptime)} />
            <InfoCard label="System Uptime" value={fmtUptime(sys.system.uptime)} />
            <InfoCard label="Node.js" value={sys.process.nodeVersion} />
            <InfoCard label="Platform" value={sys.system.platform + ' ' + sys.system.arch} />
            <InfoCard label="Hostname" value={sys.system.hostname} />
            <InfoCard label="PID" value={String(sys.process.pid)} />
          </div>
        </div>
      </div>
    </div>
  );
}