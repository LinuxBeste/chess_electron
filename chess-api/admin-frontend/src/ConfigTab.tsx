import { useEffect, useState } from 'react';
import { Settings, Edit3, X, Check, RotateCcw } from 'lucide-react';
import { api, ServerConfig } from './api';

const DEFAULTS: Record<string, string> = {
  maxGamesPerPlayer: '20',
  rateLimitWindowMs: '60000',
  rateLimitMaxRequests: '100',
  waitingTtl: '10',
};

export default function ConfigTab() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<string, string>>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<ServerConfig>('/config')
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  function startEdit() {
    if (!config) return;
    setDraft({
      maxGamesPerPlayer: String(config.maxGamesPerPlayer),
      rateLimitWindowMs: String(config.rateLimitWindowMs),
      rateLimitMaxRequests: String(config.rateLimitMaxRequests),
      waitingTtl: String(config.waitingTtl),
    });
    setEditing(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!config) return;
    setSaved(false);
    const envVars: string[] = [];
    if (draft.maxGamesPerPlayer) envVars.push('MAX_GAMES_PER_PLAYER=' + draft.maxGamesPerPlayer);
    if (draft.rateLimitWindowMs) envVars.push('RATE_LIMIT_WINDOW_MS=' + draft.rateLimitWindowMs);
    if (draft.rateLimitMaxRequests) envVars.push('RATE_LIMIT_MAX_REQUESTS=' + draft.rateLimitMaxRequests);
    if (draft.waitingTtl) envVars.push('WAITING_TTL_MINUTES=' + draft.waitingTtl);
    const configStr = envVars.join('\n');
    await navigator.clipboard.writeText(configStr);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset(key: string) {
    setDraft((prev) => ({ ...prev, [key]: DEFAULTS[key] }));
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!config) return <p className="text-[#666] text-center py-12">Loading...</p>;

  const editableFields: { key: string; label: string; envVar: string }[] = [
    { key: 'maxGamesPerPlayer', label: 'Max Games Per Player', envVar: 'MAX_GAMES_PER_PLAYER' },
    { key: 'rateLimitWindowMs', label: 'Rate Limit Window (ms)', envVar: 'RATE_LIMIT_WINDOW_MS' },
    { key: 'rateLimitMaxRequests', label: 'Rate Limit Max Requests', envVar: 'RATE_LIMIT_MAX_REQUESTS' },
    { key: 'waitingTtl', label: 'Waiting TTL (min)', envVar: 'WAITING_TTL_MINUTES' },
  ];

  const readOnlyRows: [string, string][] = [
    ['Admin Username', config.adminUsername],
    ['Database Path', config.dbPath],
    ['Node.js Version', config.nodeVersion],
    ['Platform', config.platform],
  ];

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
              <Settings size={16} className="text-blue-400" />
              Server Configuration
            </h2>
            <button onClick={editing ? handleSave : startEdit}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#4a9eff] text-white rounded hover:bg-[#3a8eef]">
              {editing ? <><Check size={12} /> Apply</> : <><Edit3 size={12} /> Edit</>}
            </button>
          </div>
        </div>

        <div className="p-4">
          {saved && (
            <div className="mb-3 px-3 py-2 bg-green-900 text-green-400 rounded-lg text-xs">
              Environment variable config copied to clipboard. Restart server to apply.
            </div>
          )}
          <table className="w-full text-sm">
            <tbody>
              {editableFields.map((field) => {
                const k = field.key as keyof ServerConfig;
                const src = config._sources?.[field.key];
                return (
                  <tr key={field.key} className="border-b border-[#2a2a2a]">
                    <td className="px-4 py-3 text-xs text-[#888] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {field.label}
                        {src && (
                          <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-mono ${src === 'env' ? 'bg-green-900 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                            {src === 'env' ? '.env' : 'default'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {editing ? (
                        <div className="flex items-center gap-1">
                          <input value={draft[field.key] || ''} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                            className="flex-1 px-2 py-1 bg-[#111] border border-[#333] rounded text-[#e0e0e0] focus:outline-none focus:border-[#4a9eff]" />
                          <button onClick={() => handleReset(field.key)}
                            className="p-1 text-[#888] hover:text-[#ccc]"
                            title="Reset to default">
                            <RotateCcw size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-[#e0e0e0]">{String((config as Record<string, string | number>)[field.key])}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {readOnlyRows.map(([label, value]) => (
                <tr key={label} className="border-b border-[#2a2a2a]">
                  <td className="px-4 py-3 text-xs text-[#888] whitespace-nowrap">{label}</td>
                  <td className="px-4 py-3 text-xs font-mono text-[#e0e0e0]">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-[#2a2a2a]">
          <p className="text-xs text-[#555]">Editable values are copied as environment variables. Restart the server to apply changes.</p>
        </div>
      </div>
    </div>
  );
}