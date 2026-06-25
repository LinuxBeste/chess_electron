import { useEffect, useState, useRef } from 'react';
import { api, Stats, SystemStats, ProcessRow } from './api';
import SystemCharts from './SystemCharts';
import SearchBar from './SearchBar';
import { useNavigateTab } from './TabContext';

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B'; // log(0) is -Infinity, handle separately
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
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

function InfoCard({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
      <div className="text-xs text-[#888]">{label}</div>
      <div className="text-sm font-semibold text-[#e0e0e0] mt-0.5" style={{ wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  );
}

// color-code CPU load relative to core count (not raw percentage)
function cpuColor(load: number, cores: number): string {
  const pct = (load / cores) * 100;
  if (pct > 80) return 'text-red-400';
  if (pct > 50) return 'text-yellow-400';
  return 'text-green-400';
}

export default function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sys, setSys] = useState<SystemStats | null>(null);
  const [procs, setProcs] = useState<ProcessRow[]>([]);
  const [procQuery, setProcQuery] = useState('');
  const [error, setError] = useState('');
  const [uptime, setUptime] = useState(0);
  const uptimeRef = useRef(0); // ref avoids stale closure in interval callback
  const navigate = useNavigateTab();
  const [procSortKey, setProcSortKey] = useState('cpu');
  const [procSortAsc, setProcSortAsc] = useState(false);

  function load() {
    // fetch all dashboard data in parallel
    return Promise.all([api<Stats>('/stats'), api<SystemStats>('/system'), api<ProcessRow[]>('/system/processes')])
      .then(([s, sy, p]) => {
        setStats(s);
        setSys(sy);
        uptimeRef.current = sy.process.uptime;
        setUptime(sy.process.uptime);
        setProcs(p);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      await load();
      if (!cancelled) setTimeout(poll, 30000); // poll every 30s
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // local uptime ticker independent of server data freshness
    const tick = setInterval(() => {
      uptimeRef.current++;
      setUptime(uptimeRef.current);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  function exportJson() {
    const blob = new Blob([JSON.stringify({ stats, system: sys, processes: procs }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'server-overview.json';
    a.click();
    URL.revokeObjectURL(url); // free blob memory after download
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!stats || !sys) return <p className="text-[#666]">Loading...</p>;

  const cards = [
    { label: 'Active Games', value: stats.gamesActive, tab: 'games' },
    { label: 'Online Players', value: stats.playersOnline, tab: 'players' },
    { label: 'Logged-In Users', value: stats.registeredUsers, tab: 'accounts' },
    { label: 'Total Accounts', value: stats.totalUsers, tab: 'accounts' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#e0e0e0]">Dashboard Overview</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#555]">
            Uptime: <span className="text-[#aaa] font-mono">{fmtUptime(uptime)}</span>
          </span>
          <button onClick={load} className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]">
            Refresh
          </button>
          <button
            onClick={exportJson}
            className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={() => navigate(c.tab)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center hover:bg-[#222] hover:border-[#4a9eff] transition-colors cursor-pointer"
          >
            <div className="text-3xl font-bold text-[#4a9eff]">{c.value}</div>
            <div className="text-xs text-[#888] mt-1">{c.label}</div>
          </button>
        ))}
      </div>

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
              value={
                <span>
                  <span className={cpuColor(sys.cpu.loadAverage1, sys.cpu.cores)}>
                    {sys.cpu.loadAverage1.toFixed(2)}
                  </span>
                  {' / '}
                  <span className={cpuColor(sys.cpu.loadAverage5, sys.cpu.cores)}>
                    {sys.cpu.loadAverage5.toFixed(2)}
                  </span>
                  {' / '}
                  <span className={cpuColor(sys.cpu.loadAverage15, sys.cpu.cores)}>
                    {sys.cpu.loadAverage15.toFixed(2)}
                  </span>
                </span>
              }
            />
            <InfoCard label="RAM Total" value={fmtBytes(sys.memory.total)} />
            <InfoCard label="RAM Free" value={fmtBytes(sys.memory.free)} />
            <InfoCard label="RAM Used" value={fmtBytes(sys.memory.used)} />
            <InfoCard label="Disk Total" value={sys.disk.total > 0 ? fmtBytes(sys.disk.total) : 'N/A'} />
            <InfoCard label="Disk Free" value={sys.disk.total > 0 ? fmtBytes(sys.disk.free) : 'N/A'} />
            <InfoCard label="Process Uptime" value={fmtUptime(uptime)} />
            <InfoCard label="System Uptime" value={fmtUptime(sys.system.uptime)} />
            <InfoCard label="Node.js" value={sys.process.nodeVersion} />
            <InfoCard label="Hostname" value={sys.system.hostname} />
            <InfoCard label="PID" value={String(sys.process.pid)} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#e0e0e0] mb-3 tracking-wide uppercase">Networks</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sys.networks.map((n, i) => (
            <InfoCard key={i} label={`${n.name} (${n.family})`} value={n.address} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[#e0e0e0] mb-3 tracking-wide uppercase">
          Running Processes (top 20 by CPU)
        </h3>
        <div className="mb-3">
          <SearchBar
            value={procQuery}
            onChange={setProcQuery}
            placeholder="Search processes by user, PID, command..."
            sortOptions={[
              { key: 'cpu', label: 'CPU' },
              { key: 'mem', label: 'Mem' },
              { key: 'rss', label: 'RSS' },
              { key: 'pid', label: 'PID' },
              { key: 'user', label: 'User' },
              { key: 'command', label: 'Command' },
            ]}
            sortKey={procSortKey}
            sortAsc={procSortAsc}
            onSortChange={(k, a) => {
              setProcSortKey(k);
              setProcSortAsc(a);
            }}
          />
        </div>
        {(() => {
          const filtered = procQuery
            ? procs.filter((p) =>
                [p.user, String(p.pid), p.command].some((v) => v.toLowerCase().includes(procQuery.toLowerCase())),
              )
            : procs;
          const sorted = [...filtered].sort((a, b) => {
            const dir = procSortAsc ? 1 : -1;
            if (procSortKey === 'cpu') return (a.cpu - b.cpu) * dir;
            if (procSortKey === 'mem') return (a.mem - b.mem) * dir;
            if (procSortKey === 'rss') return (a.rss - b.rss) * dir;
            if (procSortKey === 'pid') return (a.pid - b.pid) * dir;
            return (
              String(a[procSortKey as keyof typeof a] || '').localeCompare(
                String(b[procSortKey as keyof typeof b] || ''),
              ) * dir
            );
          });
          return sorted.length > 0 ? (
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
                  {sorted.map((p, i) => (
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
              {procQuery ? 'No matching processes.' : 'No process data available.'}
            </div>
          );
        })()}
      </div>

      <SystemCharts />
    </div>
  );
}
