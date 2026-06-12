import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { api } from './api';

interface ServerConfig {
  maxGamesPerPlayer: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  waitingTtl: number;
  adminUsername: string;
  dbPath: string;
  nodeVersion: string;
  platform: string;
}

export default function ConfigTab() {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ServerConfig>('/config')
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!config) return <p className="text-[#666] text-center py-12">Loading...</p>;

  const rows: [string, string][] = [
    ['Max Games Per Player', String(config.maxGamesPerPlayer)],
    ['Rate Limit Window', config.rateLimitWindowMs + 'ms'],
    ['Rate Limit Max Requests', String(config.rateLimitMaxRequests)],
    ['Waiting TTL', config.waitingTtl + ' min'],
    ['Admin Username', config.adminUsername],
    ['Database Path', config.dbPath],
    ['Node.js Version', config.nodeVersion],
    ['Platform', config.platform],
  ];

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
            <Settings size={16} className="text-blue-400" />
            Server Configuration
          </h2>
        </div>

        <div className="p-4">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([label, value], i) => (
                <tr key={label} className={i < rows.length - 1 ? 'border-b border-[#2a2a2a]' : ''}>
                  <td className="px-4 py-3 text-xs text-[#888] whitespace-nowrap">{label}</td>
                  <td className="px-4 py-3 text-xs text-[#e0e0e0] font-mono">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-[#2a2a2a]">
          <p className="text-xs text-[#555]">
            Configuration is read from environment variables at server start. Restart the server to apply changes.
          </p>
        </div>
      </div>
    </div>
  );
}
