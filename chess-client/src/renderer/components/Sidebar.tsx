import { useEffect, useLayoutEffect, useRef } from 'react';
import { useStoreValue } from '../hooks/useStore';
import { store } from '../store';
import ChatPanel from './ChatPanel';
import FriendsPanel from './FriendsPanel';
import LobbyPanel from './LobbyPanel';
import { t } from '../translate';
import logger from '../logger';
import { Swords, MessageCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react';

function updateSidebarPush(
  sidebarOpen: boolean,
  sidebarMinimized: boolean,
  sidebarPosition: 'left' | 'right',
  isMobile: boolean,
) {
  let width: string;
  if (!sidebarOpen) {
    width = '0px';
  } else if (sidebarMinimized) {
    width = '48px';
  } else if (isMobile) {
    width = '0px';
  } else {
    width = 'clamp(320px, 30vw, 420px)';
  }
  if (sidebarPosition === 'right') {
    document.documentElement.style.setProperty('--sidebar-push-right', width);
    document.documentElement.style.setProperty('--sidebar-push-left', '0px');
  } else {
    document.documentElement.style.setProperty('--sidebar-push-left', width);
    document.documentElement.style.setProperty('--sidebar-push-right', '0px');
  }
}

updateSidebarPush(
  store.get('sidebarOpen'),
  store.get('sidebarMinimized'),
  store.get('sidebarPosition'),
  typeof window !== 'undefined' && window.innerWidth < 900,
);

export default function Sidebar() {
  const sidebarOpen = useStoreValue('sidebarOpen');
  const sidebarMinimized = useStoreValue('sidebarMinimized');
  const sidebarPosition = useStoreValue('sidebarPosition');
  const sidebarTab = useStoreValue('sidebarTab');
  const unreadCount = useStoreValue('unreadCount');
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 900;
  const prevOpen = useRef(sidebarOpen);

  useLayoutEffect(() => {
    updateSidebarPush(sidebarOpen, sidebarMinimized, sidebarPosition, isMobile);
  }, [sidebarOpen, sidebarMinimized, sidebarPosition, isMobile]);

  useEffect(() => {
    if (sidebarOpen && !prevOpen.current) {
      logger.info('Sidebar opened');
    } else if (!sidebarOpen && prevOpen.current) {
      logger.info('Sidebar closed');
    }
    prevOpen.current = sidebarOpen;
  }, [sidebarOpen]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && sidebarOpen && !sidebarMinimized) {
        store.set('sidebarOpen', false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [sidebarOpen, sidebarMinimized]);

  if (!sidebarOpen) return null;

  const tabs = [
    { key: 'play', icon: Swords, label: t('sidebar.lobby') },
    { key: 'chat', icon: MessageCircle, label: t('sidebar.chat') },
    { key: 'friends', icon: Users, label: t('sidebar.friends') },
  ] as const;

  const posClass = sidebarPosition === 'left' ? 'sidebar-left' : '';

  if (sidebarMinimized) {
    const ExpandIcon = sidebarPosition === 'right' ? ChevronLeft : ChevronRight;
    return (
      <div className={`sidebar-minimized ${posClass} ${isMobile ? 'sidebar-minimized-mobile' : ''}`}>
        <button
          className="sidebar-minimize-btn sidebar-expand-btn"
          onClick={() => store.set('sidebarMinimized', false)}
          title={t('sidebar.expand')}
        >
          <ExpandIcon size={16} />
        </button>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`sidebar-mini-tab ${sidebarTab === tab.key ? 'sidebar-mini-tab-active' : ''}`}
              onClick={() => {
                store.set('sidebarTab', tab.key);
                store.set('sidebarMinimized', false);
              }}
              title={tab.label}
            >
              <TabIcon size={20} />
              {tab.key === 'chat' && unreadCount > 0 && (
                <span className="sidebar-badge sidebar-mini-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  const MinimizeIcon = sidebarPosition === 'right' ? ChevronRight : ChevronLeft;

  if (isMobile) {
    const overlay = (
      <div
        className="sidebar-overlay"
        onClick={() => store.set('sidebarOpen', false)}
        onKeyDown={() => {}}
        role="presentation"
      />
    );
    return (
      <>
        {overlay}
        <div className="sidebar-panel-container sidebar-bottom-sheet">
          <div className="sidebar-tabs">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  className={`sidebar-tab ${sidebarTab === tab.key ? 'sidebar-tab-active' : ''}`}
                  onClick={() => store.set('sidebarTab', tab.key)}
                >
                  <TabIcon size={16} style={{ marginRight: 4 }} />
                  {tab.label}
                  {tab.key === 'chat' && unreadCount > 0 && (
                    <span className="sidebar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </button>
              );
            })}
            <button
              className="sidebar-tab sidebar-tab-minimize"
              onClick={() => store.set('sidebarMinimized', true)}
              title={t('sidebar.minimize')}
            >
              <MinimizeIcon size={14} />
            </button>
          </div>
          <div className="sidebar-body">
            {sidebarTab === 'play' && <LobbyPanel />}
            {sidebarTab === 'chat' && <ChatPanel />}
            {sidebarTab === 'friends' && <FriendsPanel />}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={`sidebar-panel-container sidebar-slide-in ${posClass}`}>
      <div className="sidebar-tabs">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`sidebar-tab ${sidebarTab === tab.key ? 'sidebar-tab-active' : ''}`}
              onClick={() => store.set('sidebarTab', tab.key)}
            >
              <TabIcon size={16} style={{ marginRight: 4 }} />
              {tab.label}
              {tab.key === 'chat' && unreadCount > 0 && (
                <span className="sidebar-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          );
        })}
        <button
          className="sidebar-tab sidebar-tab-minimize"
          onClick={() => store.set('sidebarMinimized', true)}
          title={t('sidebar.minimize')}
        >
          <MinimizeIcon size={14} />
        </button>
      </div>
      <div className="sidebar-body">
        {sidebarTab === 'play' && <LobbyPanel />}
        {sidebarTab === 'chat' && <ChatPanel />}
        {sidebarTab === 'friends' && <FriendsPanel />}
      </div>
    </div>
  );
}
