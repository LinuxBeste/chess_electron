import { useState } from 'react';
import { LogOut, LayoutDashboard, Swords, Users, UserCog, ShieldBan, FileText } from 'lucide-react';
import { setToken } from './api';
import OverviewTab from './OverviewTab';
import GamesTab from './GamesTab';
import PlayersTab from './PlayersTab';
import AccountsTab from './AccountsTab';
import BansTab from './BansTab';
import LogsTab from './LogsTab';

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'games', label: 'Active Games', icon: Swords },
  { key: 'players', label: 'Active Players', icon: Users },
  { key: 'accounts', label: 'Accounts', icon: UserCog },
  { key: 'bans', label: 'Bans', icon: ShieldBan },
  { key: 'logs', label: 'Logs', icon: FileText },
];

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState('overview');

  function handleLogout() {
    setToken(null);
    onLogout();
  }

  function renderTab() {
    switch (active) {
      case 'overview':
        return <OverviewTab />;
      case 'games':
        return <GamesTab />;
      case 'players':
        return <PlayersTab />;
      case 'accounts':
        return <AccountsTab />;
      case 'bans':
        return <BansTab />;
      case 'logs':
        return <LogsTab />;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        <h1 className="text-lg font-semibold">Chess API Admin</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#ccc] border border-[#444] rounded-lg hover:bg-[#2a2a2a] hover:text-white"
        >
          <LogOut size={15} />
          Logout
        </button>
      </header>

      <nav className="flex gap-0 pl-6 bg-[#141414] border-b border-[#2a2a2a]">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
                active === t.key
                  ? 'text-[#4a9eff] border-[#4a9eff]'
                  : 'text-[#888] border-transparent hover:text-[#ccc]'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 p-6">{renderTab()}</main>
    </div>
  );
}
