import { useState } from 'react';
import {
  LogOut,
  LayoutDashboard,
  Swords,
  Users,
  UserCog,
  ShieldBan,
  FileText,
  Trophy,
  Archive,
  ListTree,
  Bot,
  Send,
  Settings,
} from 'lucide-react';
import { setToken } from './api';
import { ToastProvider } from './Toast';
import OverviewTab from './OverviewTab';
import GamesTab from './GamesTab';
import PlayersTab from './PlayersTab';
import AccountsTab from './AccountsTab';
import BansTab from './BansTab';
import LogsTab from './LogsTab';
import LeaderboardTab from './LeaderboardTab';
import ArchiveTab from './ArchiveTab';
import TournamentsTab from './TournamentsTab';
import AIGamesTab from './AIGamesTab';
import BroadcastTab from './BroadcastTab';
import ConfigTab from './ConfigTab';

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'games', label: 'Active Games', icon: Swords },
  { key: 'players', label: 'Active Players', icon: Users },
  { key: 'accounts', label: 'Accounts', icon: UserCog },
  { key: 'bans', label: 'Bans', icon: ShieldBan },
  { key: 'logs', label: 'Logs', icon: FileText },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'archive', label: 'Archive', icon: Archive },
  { key: 'tournaments', label: 'Tournaments', icon: ListTree },
  { key: 'ai-games', label: 'AI Games', icon: Bot },
  { key: 'broadcast', label: 'Broadcast', icon: Send },
  { key: 'config', label: 'Config', icon: Settings },
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
      case 'leaderboard':
        return <LeaderboardTab />;
      case 'archive':
        return <ArchiveTab />;
      case 'tournaments':
        return <TournamentsTab />;
      case 'ai-games':
        return <AIGamesTab />;
      case 'broadcast':
        return <BroadcastTab />;
      case 'config':
        return <ConfigTab />;
      default:
        return null;
    }
  }

  return (
    <ToastProvider>
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

        <nav className="flex gap-0 pl-6 bg-[#141414] border-b border-[#2a2a2a] overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
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
    </ToastProvider>
  );
}
