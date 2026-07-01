import { useState, useCallback, lazy, Suspense } from 'react';
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
  Flag,
} from 'lucide-react';
import { setToken } from './api';
import { ToastProvider } from './Toast';
import { TabProvider } from './TabContext';

// code-split each tab: loaded on demand, not in initial bundle
const OverviewTab = lazy(() => import('./OverviewTab'));
const GamesTab = lazy(() => import('./GamesTab'));
const PlayersTab = lazy(() => import('./PlayersTab'));
const AccountsTab = lazy(() => import('./AccountsTab'));
const BansTab = lazy(() => import('./BansTab'));
const LogsTab = lazy(() => import('./LogsTab'));
const LeaderboardTab = lazy(() => import('./LeaderboardTab'));
const ArchiveTab = lazy(() => import('./ArchiveTab'));
const TournamentsTab = lazy(() => import('./TournamentsTab'));
const BotGamesTab = lazy(() => import('./BotGamesTab'));
const BroadcastTab = lazy(() => import('./BroadcastTab'));
const ConfigTab = lazy(() => import('./ConfigTab'));
const GameReplayTab = lazy(() => import('./GameReplayTab'));
const WebSocketMonitorTab = lazy(() => import('./WebSocketMonitorTab'));
const HealthTab = lazy(() => import('./HealthTab'));
const DbBrowserTab = lazy(() => import('./DbBrowserTab'));
const ReportsTab = lazy(() => import('./ReportsTab'));

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
  { key: 'reports', label: 'Reports', icon: Flag },
  { key: 'ws', label: 'WS Monitor', icon: Radio },
  { key: 'health', label: 'Health', icon: HeartPulse },
];

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState('overview');
  const [navParams, setNavParams] = useState<Record<string, string> | undefined>(undefined);

  // cross-tab navigation: e.g. ArchiveTab receives player filter, GameReplayTab gets gameId
  const handleNavigate = useCallback((tab: string, params?: Record<string, string>) => {
    setActive(tab);
    setNavParams(params);
  }, []);

  // composite key forces tab re-mount when tab or params change, ensuring clean state
  const navKey = active + ':' + JSON.stringify(navParams);

  function handleLogout() {
    setToken(null); // clear from both memory and localStorage
    onLogout();
  }

  function renderTab() {
    const p = navParams ?? {};
    // Suspense fallback shown while lazy chunk loads
    const fallback = <div className="flex items-center justify-center py-12 text-[#888]">Loading…</div>;
    const tab = (() => {
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
        case 'reports':
          return <ReportsTab key={navKey} />;
        case 'ws':
          return <WebSocketMonitorTab key={navKey} />;
        case 'health':
          return <HealthTab key={navKey} />;
        case 'db':
          return <DbBrowserTab key={navKey} />;
        default:
          return null;
      }
    })();
    return <Suspense fallback={fallback}>{tab}</Suspense>;
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
                  onClick={() => {
                    setActive(t.key);
                    setNavParams(undefined); // clear cross-tab params when navigating directly
                  }}
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
