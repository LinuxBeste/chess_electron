import { useEffect, useState } from 'react';
import { Database, RotateCcw, Play, Terminal, Table, Copy, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { api, DbTableInfo, DbQueryResult } from './api';

export default function DbBrowserTab() {
  const [tables, setTables] = useState<DbTableInfo | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10');
  const [result, setResult] = useState<DbQueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [explain, setExplain] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dbQueryHistory') || '[]'); }
    catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  function loadTables() {
    api<DbTableInfo>('/db/tables')
      .then(setTables)
      .catch((e) => setError(e.message));
  }

  useEffect(loadTables, []);

  function addToHistory(sql: string) {
    const next = [sql, ...queryHistory.filter((h) => h !== sql)].slice(0, 20);
    setQueryHistory(next);
    localStorage.setItem('dbQueryHistory', JSON.stringify(next));
  }

  async function handleQuery(sql?: string) {
    const q = (sql || query).trim();
    if (!q) return;
    setRunning(true);
    setQueryError('');
    setResult(null);
    try {
      const res = await api<DbQueryResult>('/db/query', {
        method: 'POST',
        body: JSON.stringify({ sql: (explain ? 'EXPLAIN ANALYZE ' : '') + q }),
      });
      setResult(res);
      addToHistory(q);
      setSortCol(null);
      setSortAsc(true);
    } catch (err: unknown) {
      setQueryError(err instanceof Error ? err.message : String(err));
    } finally { setRunning(false); }
  }

  function browseTable(table: string) {
    setSelectedTable(table);
    const sql = 'SELECT * FROM ' + table + ' LIMIT 50';
    setQuery(sql);
    handleQuery(sql);
  }

  function handleSort(colIdx: number) {
    if (sortCol === colIdx) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(colIdx);
      setSortAsc(true);
    }
  }

  function copyJson() {
    if (!result) return;
    const json = JSON.stringify(result.rows.map((row) => {
      const obj: Record<string, string | null> = {};
      result.columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    }), null, 2);
    navigator.clipboard.writeText(json);
  }

  const sortedRows = result && sortCol !== null
    ? [...result.rows].sort((a, b) => {
        const va = a[sortCol] ?? '';
        const vb = b[sortCol] ?? '';
        const cmp = typeof va === 'number' ? va - Number(vb) : String(va).localeCompare(String(vb));
        return sortAsc ? cmp : -cmp;
      })
    : result?.rows;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-xs font-semibold text-[#888] uppercase mb-3 flex items-center gap-1">
              <Table size={12} /> Tables
            </h3>
            {error ? <p className="text-red-500 text-xs">{error}</p>
            : !tables ? <p className="text-xs text-[#666]">Loading...</p>
            : (<div className="space-y-1">
              {tables.tables.map((t) => (
                <button key={t.name} onClick={() => browseTable(t.name)}
                  className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                    selectedTable === t.name ? 'bg-[#4a9eff] text-white' : 'text-[#ccc] hover:bg-[#222]'
                  }`}>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-[10px] opacity-60">{t.estimatedRows.toLocaleString()} rows</div>
                </button>
              ))}
            </div>)}
            <button onClick={loadTables} className="mt-3 flex items-center gap-1 px-2 py-1 text-xs text-[#888] hover:text-[#ccc]">
              <RotateCcw size={10} /> Refresh
            </button>
          </div>

          {queryHistory.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 mt-4">
              <button onClick={() => setShowHistory(!showHistory)}
                className="text-xs font-semibold text-[#888] uppercase flex items-center gap-1 w-full">
                <Clock size={12} /> History ({queryHistory.length})
                {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                  {queryHistory.map((h, i) => (
                    <button key={i} onClick={() => { setQuery(h); handleQuery(h); }}
                      className="w-full text-left px-2 py-1 text-[10px] font-mono text-[#888] hover:text-[#ccc] hover:bg-[#222] rounded truncate">
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2a2a]">
              <h3 className="text-xs font-semibold text-[#888] uppercase flex items-center gap-1 mb-3">
                <Terminal size={12} /> SQL Query
              </h3>
              <div className="flex gap-2">
                <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={2}
                  placeholder="SELECT * FROM users LIMIT 10"
                  className="flex-1 px-3 py-2 text-xs font-mono bg-[#0d0d0d] border border-[#333] rounded-lg text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff] resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleQuery(); } }} />
                <button onClick={() => handleQuery()} disabled={running || !query.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] disabled:opacity-40 self-start">
                  {running ? <RotateCcw size={14} className="animate-spin" /> : <Play size={14} />}
                  Run
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-[#555]">Only SELECT queries. Press Ctrl+Enter to run.</p>
                <label className="flex items-center gap-1.5 text-[10px] text-[#888] cursor-pointer">
                  <input type="checkbox" checked={explain} onChange={(e) => setExplain(e.target.checked)} className="accent-[#4a9eff]" />
                  EXPLAIN ANALYZE
                </label>
              </div>
            </div>

            <div className="p-4">
              {queryError && (
                <div className="mb-3 px-3 py-2 bg-red-900 text-red-400 rounded-lg text-xs">{queryError}</div>
              )}

              {result && (
                <>
                  <div className="flex items-center justify-between mb-3 text-xs text-[#666]">
                    <div className="flex items-center gap-3">
                      <span>{result.totalRows.toLocaleString()} row{result.totalRows !== 1 ? 's' : ''}</span>
                      <span>{result.elapsedMs}ms</span>
                      {result.totalRows > 500 && <span className="text-yellow-400">Showing first 500 rows</span>}
                    </div>
                    <button onClick={copyJson}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-[#2a2a2a] text-[#ccc] rounded hover:bg-[#333]">
                      <Copy size={10} /> Copy JSON
                    </button>
                  </div>
                  {result.columns.length === 0 ? (
                    <p className="text-xs text-[#666]">Query returned no columns.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[#888] uppercase border-b border-[#2a2a2a]">
                            <th className="text-left px-3 py-2 font-mono">#</th>
                            {result.columns.map((col, idx) => (
                              <th key={col} className="text-left px-3 py-2 font-mono cursor-pointer hover:text-[#ccc] select-none"
                                onClick={() => handleSort(idx)}>
                                {col} {sortCol === idx ? (sortAsc ? '▲' : '▼') : ''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(sortedRows || result.rows).length === 0 ? (
                            <tr><td colSpan={result.columns.length + 1} className="px-3 py-8 text-center text-[#666]">No rows returned.</td></tr>
                          ) : (
                            (sortedRows || result.rows).map((row, i) => (
                              <tr key={i} className="border-b border-[#222] last:border-0 hover:bg-[#222]">
                                <td className="px-3 py-2 text-[#555] font-mono">{i + 1}</td>
                                {row.map((cell, j) => (
                                  <td key={j} className="px-3 py-2 text-[#ccc] font-mono max-w-[300px] truncate">
                                    {cell === null ? <span className="text-[#555] italic">NULL</span> : String(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
