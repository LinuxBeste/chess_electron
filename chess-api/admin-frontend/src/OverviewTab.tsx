import { useEffect, useState } from 'react';
import { api, Stats, SystemStats, ProcessRow } from './api';
import SystemCharts from './SystemCharts';
import SearchBar from './SearchBar';

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
        <div
          style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }}
        />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
      <div className="text-xs text-[#888]">{label}</div>
      <div className="text-sm font-semibold text-[#e0e0e0] mt-0.5" style={{ wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  );
}

export default function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sys, setSys] = useState<SystemStats | null>(null);
  const [procs, setProcs] = useState<ProcessRow[]>([]);
  const [procQuery, setProcQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api<Stats>('/stats'), api<SystemStats>('/system'), api<ProcessRow[]>('/system/processes')])
      .then(([s, sy, p]) => {
        setStats(s);
        setSys(sy);
        setProcs(p);
      })
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
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="text-xs font-semibold text-[#888] mb-3 uppercase tracking-wide">Usage</div>
            <Bar label="RAM" value={sys.memory.used} color="#4a9eff" total={sys.memory.total} />
            <Bar label="Disk" value={sys.disk.used} color="#4caf50" total={sys.disk.total} />
            <Bar label="Heap" value={sys.process.heapUsed} color="#ff9800" total={sys.process.heapTotal} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <InfoCard label="OS" value={`${sys.system.platform} ${sys.system.arch}`} />
            <InfoCard label="Release" value={sys.system.release} />
            <InfoCard label="CPU Cores" value={String(sys.cpu.cores)} />
            <InfoCard
              label="CPU Model"
              value={sys.cpu.model.length > 30 ? sys.cpu.model.slice(0, 28) + '…' : sys.cpu.model}
            />
            <InfoCard label="CPU Speed" value={sys.cpu.speed ? sys.cpu.speed + ' MHz' : '—'} />
            <InfoCard
              label="Load (1m / 5m / 15m)"
              value={`${sys.cpu.loadAverage1.toFixed(2)} / ${sys.cpu.loadAverage5.toFixed(2)} / ${sys.cpu.loadAverage15.toFixed(2)}`}
            />
            <InfoCard label="RAM Total" value={fmtBytes(sys.memory.total)} />
            <InfoCard label="RAM Free" value={fmtBytes(sys.memory.free)} />
            <InfoCard label="RAM Used" value={fmtBytes(sys.memory.used)} />
            <InfoCard label="Disk Total" value={sys.disk.total > 0 ? fmtBytes(sys.disk.total) : 'N/A'} />
            <InfoCard label="Disk Free" value={sys.disk.total > 0 ? fmtBytes(sys.disk.free) : 'N/A'} />
            <InfoCard label="Process Uptime" value={fmtUptime(sys.process.uptime)} />
            <InfoCard label="System Uptime" value={fmtUptime(sys.system.uptime)} />
            <InfoCard label="Node.js" value={sys.process.nodeVersion} />
            <InfoCard label="Hostname" value={sys.system.hostname} />
            <InfoCard label="PID" value={String(sys.process.pid)} />
          </div>
        </div>
      </div>

      {/* Networks */}
      <div>
        <h3 className="text-sm font-semibold text-[#e0e0e0] mb-3 tracking-wide uppercase">Networks</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sys.networks.map((n, i) => (
            <InfoCard key={i} label={`${n.name} (${n.family})`} value={n.address} />
          ))}
        </div>
      </div>

      {/* Running Processes */}
      <div>
        <h3 className="text-sm font-semibold text-[#e0e0e0] mb-3 tracking-wide uppercase">
          Running Processes (top 20 by CPU)
        </h3>
        <div className="mb-3">
          <SearchBar
            value={procQuery}
            onChange={setProcQuery}
            placeholder="Search processes by user, PID, command..."
          />
        </div>
        {(() => {
          const filtered = procQuery
            ? procs.filter((p) =>
                [p.user, String(p.pid), p.command].some((v) => v.toLowerCase().includes(procQuery.toLowerCase())),
              )
            : procs;
          return filtered.length > 0 ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      color: '#888',
                      textTransform: 'uppercase',
                      fontSize: 10,
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid #2a2a2a',
                    }}
                  >
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>User</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>PID</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>CPU%</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>Mem%</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px' }}>RSS</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px' }}>Command</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.pid} style={{ borderBottom: i < procs.length - 1 ? '1px solid #222' : 'none' }}>
                      <td style={{ padding: '6px 10px', color: '#ccc' }}>{p.user}</td>
                      <td style={{ padding: '6px 10px', color: '#ccc', textAlign: 'right' }}>{p.pid}</td>
                      <td style={{ padding: '6px 10px', color: '#4a9eff', textAlign: 'right' }}>{p.cpu.toFixed(1)}</td>
                      <td style={{ padding: '6px 10px', color: '#4caf50', textAlign: 'right' }}>{p.mem.toFixed(1)}</td>
                      <td style={{ padding: '6px 10px', color: '#ff9800', textAlign: 'right' }}>{fmtBytes(p.rss)}</td>
                      <td
                        style={{
                          padding: '6px 10px',
                          color: '#999',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 300,
                        }}
                      >
                        {p.command}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center"
              style={{ fontSize: 12, color: '#666' }}
            >
              {procQuery ? 'No matching processes.' : 'Process listing unavailable on this platform'}
            </div>
          );
        })()}
      </div>

      {/* Live Graphs */}
      <SystemCharts />
    </div>
  );
}
