import { useEffect, useRef, useState } from 'react';
import { api, SystemMetricsSample } from './api';

const MAX_POINTS = 60;
const POLL_MS = 2000;

function fmtBytes(v: number): string {
  if (v <= 0) return '0';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(v) / Math.log(1024)), units.length - 1);
  return (v / Math.pow(1024, i)).toFixed(v > 1024 * 1024 ? 1 : 0) + units[i];
}

function fmtRate(bytesPerSec: number): string {
  return fmtBytes(bytesPerSec) + '/s';
}

type ChartDef = {
  label: string;
  color: string;
  extract: (s: SystemMetricsSample) => number;
  format: (v: number) => string;
  suffix?: string;
};

const CHARTS: ChartDef[] = [
  { label: 'CPU', color: '#4a9eff', extract: (s) => s.cpu, format: (v) => v.toFixed(1) + '%' },
  { label: 'RAM', color: '#4caf50', extract: (s) => s.memory.percent, format: (v) => v.toFixed(1) + '%' },
  { label: 'Net RX', color: '#2196f3', extract: (s) => s.net.rx, format: (v) => fmtRate(v) },
  { label: 'Net TX', color: '#f44336', extract: (s) => s.net.tx, format: (v) => fmtRate(v) },
  { label: 'Disk Read', color: '#ff9800', extract: (s) => s.disk.read, format: (v) => fmtRate(v) },
  { label: 'Disk Write', color: '#9c27b0', extract: (s) => s.disk.write, format: (v) => fmtRate(v) },
];

function Sparkline({
  data,
  width,
  height,
  color,
  maxVal,
}: {
  data: number[];
  width: number;
  height: number;
  color: string;
  maxVal: number;
}) {
  // need at least 2 points and positive max for meaningful sparkline
  if (data.length < 2 || maxVal <= 0) {
    return <svg width={width} height={height} />;
  }
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / maxVal) * height;
      return `${x},${y}`;
    })
    .join(' ');
  const area = points + ` ${width},${height} 0,${height}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polygon points={area} fill={`${color}18`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function ChartCard({ def, samples }: { def: ChartDef; samples: SystemMetricsSample[] }) {
  const vals = samples.map(def.extract);
  const current = vals.length > 0 ? vals[vals.length - 1] : 0;
  const maxVal = Math.max(...vals, 1);
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {def.label}
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: def.color }}>{def.format(current)}</span>
      </div>
      <Sparkline data={vals} width={280} height={60} color={def.color} maxVal={maxVal} />
    </div>
  );
}

export default function SystemCharts() {
  const [samples, setSamples] = useState<SystemMetricsSample[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function poll() {
      api<SystemMetricsSample>('/system/metrics')
        .then((s) => setSamples((prev) => [...prev.slice(-(MAX_POINTS - 1)), s])) // ring buffer of MAX_POINTS
        .catch(() => {}); // silently ignore poll errors to avoid console noise
    }
    poll();
    intervalRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (samples.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[#e0e0e0] mb-3 tracking-wide uppercase">Live Graphs</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHARTS.map((def, i) => (
          <ChartCard key={i} def={def} samples={samples} />
        ))}
      </div>
    </div>
  );
}
