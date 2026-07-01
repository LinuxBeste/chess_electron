import { useEffect, useState } from 'react';
import { Ban, X, CheckCircle, RefreshCw, SearchX } from 'lucide-react';
import { api } from './api';
import { useToast } from './Toast';

interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  gameId: string | null;
  reason: string;
  status: 'open' | 'dismissed' | 'resolved';
  createdAt: number;
  reviewedBy: string | null;
  reviewedAt: number | null;
}

interface ReportsResponse {
  reports: Report[];
  total: number;
  page: number;
  limit: number;
}

export default function ReportsTab() {
  const { addToast } = useToast();
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [page, setPage] = useState(1);

  function load() {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (statusFilter) params.set('status', statusFilter);
    api<ReportsResponse>('/reports?' + params.toString())
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [page, statusFilter]);

  async function handleStatus(id: string, status: 'dismissed' | 'resolved') {
    try {
      await api('/reports/' + id + '/status', {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      addToast('Report ' + status, 'success');
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  async function handleBan(report: Report) {
    if (!confirm('Ban ' + report.targetName + '? This will also resolve the report.')) return;
    try {
      await api('/reports/' + report.id + '/ban-target', { method: 'POST' });
      addToast('Banned ' + report.targetName, 'success');
      load();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    }
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[#e0e0e0]">Reports</h2>
          <button onClick={load} className="p-1 text-[#888] hover:text-[#ccc]" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex gap-1">
          {['open', 'dismissed', 'resolved', ''].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-2.5 py-1.5 text-xs rounded-lg ${
                statusFilter === s ? 'bg-[#4a9eff] text-white' : 'bg-[#2a2a2a] text-[#888] hover:text-[#ccc]'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="text-xs text-[#666]">Loading...</p>
      ) : data.reports.length === 0 ? (
        <div className="flex items-center gap-2 text-[#666] text-sm py-8 justify-center">
          <SearchX size={18} />
          No {statusFilter} reports
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-[#888]">
            {data.total} report{data.total !== 1 ? 's' : ''}
            {statusFilter ? ' (' + statusFilter + ')' : ''}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-[#1a1a1a] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#222] text-[#888] uppercase text-xs tracking-wider">
                  <th className="text-left px-4 py-2.5">Reporter</th>
                  <th className="text-left px-4 py-2.5">Target</th>
                  <th className="text-left px-4 py-2.5">Reason</th>
                  <th className="text-left px-4 py-2.5">Game</th>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((r) => (
                  <tr key={r.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
                    <td className="px-4 py-2.5 text-xs font-mono" title={r.reporterId}>
                      {r.reporterName}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono" title={r.targetId}>
                      {r.targetName}
                    </td>
                    <td className="px-4 py-2.5 text-xs max-w-[200px] truncate" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-[#888]">
                      {r.gameId ? r.gameId.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#888]">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          r.status === 'open'
                            ? 'text-yellow-400'
                            : r.status === 'dismissed'
                              ? 'text-[#888]'
                              : 'text-green-400'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.status === 'open' && (
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => handleBan(r)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            <Ban size={10} /> Ban & Resolve
                          </button>
                          <button
                            onClick={() => handleStatus(r.id, 'dismissed')}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-[#2a2a2a] text-[#ccc] rounded hover:bg-[#333]"
                          >
                            <X size={10} /> Dismiss
                          </button>
                          <button
                            onClick={() => handleStatus(r.id, 'resolved')}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <CheckCircle size={10} /> Resolve
                          </button>
                        </div>
                      )}
                      {r.status !== 'open' && (
                        <span className="text-xs text-[#666]">
                          {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > data.limit && (
            <div className="flex justify-center items-center gap-3 mt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-[#888]">
                Page {data.page} of {Math.ceil(data.total / data.limit)}
              </span>
              <button
                disabled={page >= Math.ceil(data.total / data.limit)}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-[#ccc] rounded-lg hover:bg-[#333] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
