export interface Shortcut {
  id: string;
  keys: string;
  label: string;
  description: string;
  category: 'general' | 'game' | 'navigation';
  implemented: boolean;
}

export const shortcuts: Shortcut[] = [
  /* ── General ── */
  {
    id: 'toggle-palette',
    keys: 'Ctrl+K / ?',
    label: 'shortcuts.togglePalette',
    description: 'shortcuts.togglePaletteDesc',
    category: 'general',
    implemented: true,
  },
  {
    id: 'toggle-sidebar',
    keys: 'G S',
    label: 'shortcuts.toggleSidebar',
    description: 'shortcuts.toggleSidebarDesc',
    category: 'general',
    implemented: false,
  },
  {
    id: 'toggle-sound',
    keys: 'G U',
    label: 'shortcuts.toggleSound',
    description: 'shortcuts.toggleSoundDesc',
    category: 'general',
    implemented: false,
  },
  {
    id: 'open-settings',
    keys: 'G ,',
    label: 'shortcuts.openSettings',
    description: 'shortcuts.openSettingsDesc',
    category: 'general',
    implemented: false,
  },
  {
    id: 'reload-app',
    keys: 'G R',
    label: 'shortcuts.reloadApp',
    description: 'shortcuts.reloadAppDesc',
    category: 'general',
    implemented: false,
  },

  /* ── Game ── */
  {
    id: 'flip-board',
    keys: 'F',
    label: 'shortcuts.flipBoard',
    description: 'shortcuts.flipBoardDesc',
    category: 'game',
    implemented: false,
  },
  {
    id: 'prev-move',
    keys: '←',
    label: 'shortcuts.prevMove',
    description: 'shortcuts.prevMoveDesc',
    category: 'game',
    implemented: false,
  },
  {
    id: 'next-move',
    keys: '→',
    label: 'shortcuts.nextMove',
    description: 'shortcuts.nextMoveDesc',
    category: 'game',
    implemented: false,
  },
  {
    id: 'start-review',
    keys: '↑',
    label: 'shortcuts.startReview',
    description: 'shortcuts.startReviewDesc',
    category: 'game',
    implemented: false,
  },
  {
    id: 'end-review',
    keys: '↓',
    label: 'shortcuts.endReview',
    description: 'shortcuts.endReviewDesc',
    category: 'game',
    implemented: false,
  },
  {
    id: 'offer-draw',
    keys: 'G D',
    label: 'shortcuts.offerDraw',
    description: 'shortcuts.offerDrawDesc',
    category: 'game',
    implemented: false,
  },
  {
    id: 'resign-game',
    keys: 'G R',
    label: 'shortcuts.resignGame',
    description: 'shortcuts.resignGameDesc',
    category: 'game',
    implemented: false,
  },
  {
    id: 'new-game',
    keys: 'G N',
    label: 'shortcuts.newGame',
    description: 'shortcuts.newGameDesc',
    category: 'game',
    implemented: false,
  },
  {
    id: 'toggle-chat',
    keys: 'G C',
    label: 'shortcuts.toggleChat',
    description: 'shortcuts.toggleChatDesc',
    category: 'game',
    implemented: false,
  },

  /* ── Navigation ── */
  {
    id: 'go-home',
    keys: 'G H',
    label: 'shortcuts.goHome',
    description: 'shortcuts.goHomeDesc',
    category: 'navigation',
    implemented: false,
  },
  {
    id: 'go-play',
    keys: 'G P',
    label: 'shortcuts.goPlay',
    description: 'shortcuts.goPlayDesc',
    category: 'navigation',
    implemented: false,
  },
  {
    id: 'go-friends',
    keys: 'G F',
    label: 'shortcuts.goFriends',
    description: 'shortcuts.goFriendsDesc',
    category: 'navigation',
    implemented: false,
  },
  {
    id: 'go-settings',
    keys: 'G ,',
    label: 'shortcuts.goSettings',
    description: 'shortcuts.goSettingsDesc',
    category: 'navigation',
    implemented: false,
  },
];
