import { useEffect, useState, useRef } from 'react';
import { FileText, RotateCcw, Download } from 'lucide-react';
import { api } from './api';

interface LogResponse {
  logs: Record<string, string[]>;
  files: string[];
}

export default function LogsTab() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [error, setError] = useState('');
  const [type, setType] = useState('all');
  const [lines, setLines] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    api<LogResponse>('/logs?type=' + type + '&lines=' + lines)
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, [type, lines]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  function handleDownload(filename: string) {
    const section = filename.startsWith('audit') ? 'audit' : filename.startsWith('http') ? 'http' : 'app';
    const logLines = data?.logs[section];
    if (!logLines) return;
    const blob = new Blob([logLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  const hasApp = data?.logs?.app && data.logs.app.length > 0;
  const hasAudit = data?.logs?.audit && data.logs.audit.length > 0;
  const hasHttp = data?.logs?.http && data.logs.http.length > 0;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-1.5 text-sm bg-[#1a1a1a] border border-[#333] rounded-lg text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
        >
          <option value="all">All logs</option>
          <option value="app">App logs</option>
          <option value="audit">Audit logs</option>
          <option value="http">HTTP logs</option>
        </select>

        <select
          value={lines}
          onChange={(e) => setLines(Number(e.target.value))}
          className="px-3 py-1.5 text-sm bg-[#1a1a1a] border border-[#333] rounded-lg text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]"
        >
          <option value={100}>100 lines</option>
          <option value={200}>200 lines</option>
          <option value={500}>500 lines</option>
          <option value={1000}>1000 lines</option>
        </select>

        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
        >
          <RotateCcw size={14} />
          Refresh
        </button>

        <label className="flex items-center gap-1.5 text-sm text-[#aaa] cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="accent-[#4a9eff]"
          />
          Auto-refresh (5s)
        </label>

        <span className="text-xs text-[#555] ml-auto">
          {hasApp && data!.logs.app!.length + ' app lines'}
          {hasAudit && (hasApp ? ' · ' : '') + data!.logs.audit!.length + ' audit lines'}
          {hasHttp && (hasApp || hasAudit ? ' · ' : '') + data!.logs.http!.length + ' http lines'}
        </span>
      </div>

      {/* Log files list */}
      {data?.files && data.files.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider mb-2">Available log files</h3>
          <div className="flex flex-wrap gap-2">
            {data.files.map((f) => (
              <button
                key={f}
                onClick={() => handleDownload(f)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-[#1a1a1a] border border-[#333] rounded text-[#888] hover:text-[#ccc] hover:border-[#555]"
              >
                <FileText size={12} />
                {f}
                <Download size={10} className="ml-1" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Log content */}
      <div className="grid grid-cols-1 gap-4">
        {hasApp && <LogSection title="App Logs" lines={data!.logs.app!} />}
        {hasAudit && <LogSection title="Audit Logs" lines={data!.logs.audit!} highlight />}
        {hasHttp && <LogSection title="HTTP Logs" lines={data!.logs.http!} />}
        {!hasApp && !hasAudit && !hasHttp && <p className="text-xs text-[#666]">No log entries found for today.</p>}
      </div>
    </div>
  );
}

function LogSection({ title, lines, highlight }: { title: string; lines: string[]; highlight?: boolean }) {
  const preRef = useRef<HTMLPreElement>(null);

  function colorize(line: string): string {
    if (line.includes('[ERROR]')) return 'text-red-400';
    if (line.includes('[WARN]')) return 'text-yellow-400';
    if (line.includes('[AUDIT]')) return 'text-purple-400';
    if (line.includes('[INFO]')) return 'text-cyan-400';
    if (line.includes('[DEBUG]')) return 'text-gray-500';
    return 'text-[#ccc]';
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        <h3 className={`text-sm font-semibold ${highlight ? 'text-purple-400' : 'text-[#e0e0e0]'}`}>{title}</h3>
        <span className="text-xs text-[#555]">{lines.length} lines</span>
      </div>
      <pre
        ref={preRef}
        className="p-4 text-xs font-mono leading-relaxed overflow-auto max-h-[500px]"
        style={{ scrollBehavior: 'smooth' }}
      >
        {lines.map((line, i) => (
          <div key={i} className={colorize(line)}>
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}
