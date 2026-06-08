import { useEffect, useState } from 'react';
import { api, Stats } from './api';

export default function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Stats>('/stats').then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!stats) return <p className="text-[#666]">Loading...</p>;

  const cards = [
    { label: 'Active Games', value: stats.gamesActive },
    { label: 'Online Players', value: stats.playersOnline },
    { label: 'Logged-In Users', value: stats.registeredUsers },
    { label: 'Total Accounts', value: stats.totalUsers },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-[#4a9eff]">{c.value}</div>
          <div className="text-xs text-[#888] mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
