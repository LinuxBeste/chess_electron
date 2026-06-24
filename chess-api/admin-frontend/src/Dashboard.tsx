import { useState, useCallback } from 'react';
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
  Repeat,
  Radio,
  HeartPulse,
  Database,
} from 'lucide-react';
import { setToken } from './api';
import { ToastProvider } from './Toast';
import { TabProvider } from './TabContext';
import OverviewTab from './OverviewTab';
import GamesTab from './GamesTab';
import PlayersTab from './PlayersTab';
import AccountsTab from './AccountsTab';
import BansTab from './BansTab';
import LogsTab from './LogsTab';
import LeaderboardTab from './LeaderboardTab';
import ArchiveTab from './ArchiveTab';
import TournamentsTab from './TournamentsTab';
import BotGamesTab from './BotGamesTab';
import BroadcastTab from './BroadcastTab';
import ConfigTab from './ConfigTab';
import GameReplayTab from './GameReplayTab';
import WebSocketMonitorTab from './WebSocketMonitorTab';
import HealthTab from './HealthTab';
import DbBrowserTab from './DbBrowserTab';

const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'games', label: 'Active Games', icon: Swords },
  { key: 'players', label: 'Active Players', icon: Users },
  { key: 'accounts', label: 'Accounts', icon: UserCog },
  { key: 'bans', label: 'Bans', icon: ShieldBan },
  { key: 'logs', label: 'Logs', icon: FileText },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'archive', label: 'Archive', icon: Archive },
  { key: 'replay', label: 'Game Replay', icon: Repeat },
  { key: 'tournaments', label: 'Tournaments', icon: ListTree },
  { key: 'bot-games', label: 'Bot Games', icon: Bot },
  { key: 'broadcast', label: 'Broadcast', icon: Send },
  { key: 'config', label: 'Config', icon: Settings },
  { key: 'db', label: 'DB Browser', icon: Database },
  { key: 'ws', label: 'WS Monitor', icon: Radio },
  { key: 'health', label: 'Health', icon: HeartPulse },
];

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState('overview');
  const [navParams, setNavParams] = useState<Record<string, string> | undefined>(undefined);

  const handleNavigate = useCallback((tab: string, params?: Record<string, string>) => {
    setActive(tab);
    setNavParams(params);
  }, []);

  const navKey = active + ':' + JSON.stringify(navParams);

  function handleLogout() {
    setToken(null);
    onLogout();
  }

  function renderTab() {
    const p = navParams ?? {};
    switch (active) {
      case 'overview':
        return <OverviewTab key={navKey} />;
      case 'games':
        return <GamesTab key={navKey} />;
      case 'players':
        return <PlayersTab key={navKey} />;
      case 'accounts':
        return <AccountsTab key={navKey} />;
      case 'bans':
        return <BansTab key={navKey} />;
      case 'logs':
        return <LogsTab key={navKey} />;
      case 'leaderboard':
        return <LeaderboardTab key={navKey} />;
      case 'archive':
        return <ArchiveTab key={navKey} initialPlayer={p.player} />;
      case 'tournaments':
        return <TournamentsTab key={navKey} />;
      case 'bot-games':
        return <BotGamesTab key={navKey} />;
      case 'broadcast':
        return <BroadcastTab key={navKey} />;
      case 'config':
        return <ConfigTab key={navKey} />;
      case 'replay':
        return <GameReplayTab key={navKey} initialGameId={p.gameId} />;
      case 'ws':
        return <WebSocketMonitorTab key={navKey} />;
      case 'health':
        return <HealthTab key={navKey} />;
      case 'db':
        return <DbBrowserTab key={navKey} />;
      default:
        return null;
    }
  }

  return (
    <ToastProvider>
      <TabProvider onNavigate={handleNavigate}>
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
                  onClick={() => { setActive(t.key); setNavParams(undefined); }}
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
      </TabProvider>
    </ToastProvider>
  );
}
