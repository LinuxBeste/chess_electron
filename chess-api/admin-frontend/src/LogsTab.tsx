import { useEffect, useState, useRef, useMemo } from 'react';
import { FileText, RotateCcw, Download, Search, Copy } from 'lucide-react';
import { api, LogFileInfo } from './api';

interface LogResponse {
  logs: Record<string, string[]>;
  files: LogFileInfo[];
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function LogsTab() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [error, setError] = useState('');
  const [type, setType] = useState('all');
  const [lines, setLines] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

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

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [data]);

  function handleDownload(file: LogFileInfo) {
    const section = file.name.startsWith('audit') ? 'audit' : file.name.startsWith('http') ? 'http' : 'app';
    const logLines = data?.logs[section];
    if (!logLines) return;
    const blob = new Blob([logLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopyAll() {
    const all: string[] = [];
    if (filteredLogs?.app) all.push(...filteredLogs.app);
    if (filteredLogs?.audit) all.push(...filteredLogs.audit);
    if (filteredLogs?.http) all.push(...filteredLogs.http);
    navigator.clipboard.writeText(all.join('\n'));
  }

  function fmtSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  const filteredLogs = useMemo(() => {
    if (!data?.logs) return null;
    const result: Record<string, string[]> = {};
    for (const [key, lines] of Object.entries(data.logs)) {
      let filtered = lines;
      if (searchQuery) {
        filtered = filtered.filter((l) => l.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      if (quickFilter) {
        filtered = filtered.filter((l) => l.includes(quickFilter));
      }
      result[key] = filtered;
    }
    return result;
  }, [data, searchQuery, quickFilter]);

  const levelFilters = ['[ERROR]', '[WARN]', '[INFO]', '[DEBUG]'];

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  const hasApp = filteredLogs?.app && filteredLogs.app.length > 0;
  const hasAudit = filteredLogs?.audit && filteredLogs.audit.length > 0;
  const hasHttp = filteredLogs?.http && filteredLogs.http.length > 0;

  return (
    <div>
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

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in logs..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[#1a1a1a] border border-[#333] rounded-lg text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff]"
          />
        </div>

        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
        >
          <RotateCcw size={14} /> Refresh
        </button>

        <button
          onClick={handleCopyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333]"
        >
          <Copy size={14} /> Copy All
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
          {hasApp && filteredLogs!.app!.length + ' app lines'}
          {hasAudit && (hasApp ? ' · ' : '') + filteredLogs!.audit!.length + ' audit lines'}
          {hasHttp && (hasApp || hasAudit ? ' · ' : '') + filteredLogs!.http!.length + ' http lines'}
        </span>
      </div>

      {data?.files && data.files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {data.files.map((f) => (
            <button
              key={f.name}
              onClick={() => handleDownload(f)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[#1a1a1a] border border-[#333] rounded text-[#888] hover:text-[#ccc] hover:border-[#555]"
            >
              <FileText size={12} /> {f.name} <span className="text-[#555]">({fmtSize(f.size)})</span>{' '}
              <Download size={10} />
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex gap-1.5">
        {levelFilters.map((level) => (
          <button
            key={level}
            onClick={() => setQuickFilter(quickFilter === level ? null : level)}
            className={`px-2 py-0.5 text-[10px] rounded-full font-mono border ${
              quickFilter === level
                ? 'bg-[#4a9eff] border-[#4a9eff] text-white'
                : 'bg-[#1a1a1a] border-[#333] text-[#888] hover:text-[#ccc]'
            }`}
          >
            {level.replace(/[\[\]]/g, '')}
          </button>
        ))}
        {quickFilter && (
          <button onClick={() => setQuickFilter(null)} className="text-[10px] text-[#555] hover:text-[#888]">
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {hasApp && <LogSection title="App Logs" lines={filteredLogs!.app!} searchQuery={searchQuery} />}
        {hasAudit && <LogSection title="Audit Logs" lines={filteredLogs!.audit!} highlight searchQuery={searchQuery} />}
        {hasHttp && <LogSection title="HTTP Logs" lines={filteredLogs!.http!} searchQuery={searchQuery} />}
        {!hasApp && !hasAudit && !hasHttp && <p className="text-xs text-[#666]">No log entries found for today.</p>}
      </div>
    </div>
  );
}

function LogSection({
  title,
  lines,
  highlight,
  searchQuery,
}: {
  title: string;
  lines: string[];
  highlight?: boolean;
  searchQuery?: string;
}) {
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
      <pre className="p-4 text-xs font-mono leading-relaxed overflow-auto max-h-[500px]">
        {lines.map((line, i) => (
          <div key={i} className={colorize(line)}>
            {searchQuery ? highlightText(line, searchQuery) : line}
          </div>
        ))}
      </pre>
    </div>
  );
}
