export type TranslationKeys = {
  app: {
    loading: string;
    connectFailed: string;
    title: string;
  };
  common: {
    you: string;
    unknown: string;
    loading: string;
    copy: string;
    cancel: string;
    leave: string;
    backToLobby: string;
    copyGameId: string;
    copied: string;
    prev: string;
    next: string;
    start: string;
    end: string;
    white: string;
    black: string;
    vs: string;
    queen: string;
    rook: string;
    bishop: string;
    knight: string;
  };
  navbar: {
    chess: string;
    tagline: string;
    friends: string;
    stats: string;
    settings: string;
    history: string;
    leaderboard: string;
    archive: string;
    tournaments: string;
    logout: string;
  };
  friends: {
    title: string;
    friends: string;
    requests: string;
    sent: string;
    add: string;
    addPlaceholder: string;
    requestSent: string;
    accept: string;
    decline: string;
    remove: string;
    challenge: string;
    challengeSent: string;
    inGame: string;
    pending: string;
    noFriends: string;
    noRequests: string;
    noSent: string;
    friendRequest: string;
    friendRequestFrom: string;
    friendRequestAccepted: string;
    friendRequestDeclined: string;
    removedBy: string;
    cancel: string;
    failedCancel: string;
    challengeAccepted: string;
    challengeDeclined: string;
    friendOnline: string;
    friendOffline: string;
    failedAccept: string;
    failedDecline: string;
    failedRemove: string;
    failedChallenge: string;
    usernameTooShort: string;
    usernameTooLong: string;
  };
  login: {
    tagline: string;
    subtitle: string;
    quickPlay: string;
    signIn: string;
    register: string;
    serverUrl: string;
    displayName: string;
    username: string;
    password: string;
    passwordMin: string;
    connecting: string;
    enter: string;
    createAccount: string;
    noAccount: string;
    registerHere: string;
    haveAccount: string;
    signInLink: string;
    quickPlayInfo: string;
    registeredInfo: string;
    failedConnect: string;
    passwordTooShort: string;
    registrationFailed: string;
    credentialsRequired: string;
    loginFailed: string;
    offlineMode: string;
    offlineModeDesc: string;
  };
  lobby: {
    openGames: string;
    liveGames: string;
    local1v1: string;
    createGame: string;
    joinById: string;
    spectateById: string;
    noOpenGames: string;
    noActiveGames: string;
    cannotConnect: string;
    private: string;
    waiting: string;
    join: string;
    spectate: string;
    inProgress: string;
    localDescription: string;
    startLocal: string;
    privateGame: string;
    playAI: string;
    aiDifficulty: string;
    aiBeginner: string;
    aiIntermediate: string;
    aiAdvanced: string;
    aiExpert: string;
    aiMaster: string;
    startAI: string;
    newGame: string;
    newWindow: string;
    pasteGameId: string;
    failedCreate: string;
    failedJoin: string;
    failedLoad: string;
  };
  game: {
    youWhite: string;
    youBlack: string;
    waiting: string;
    gameId: string;
    opponentDraw: string;
    accept: string;
    decline: string;
    menu: string;
    resign: string;
    areYouSure: string;
    offerDraw: string;
    drawOffered: string;
    abortGame: string;
    leave: string;
    failedLoad: string;
    moveFailed: string;
    failedResign: string;
    challengedYou: string;
    challengeTitle: string;
    opponentRematch: string;
    spectators: string;
    playAs: string;
  };
  localGame: {
    blackToMove: string;
    whiteToMove: string;
    wins: string;
    stalemate: string;
    ranOutOfTime: string;
    gameOver: string;
    checkmate: string;
    noLegalMoves: string;
    timeout: string;
    leave: string;
    newGame: string;
    moves: string;
    local1v1: string;
    instruction: string;
  };
  result: {
    draw: string;
    youWon: string;
    youLost: string;
    byCheckmate: string;
    byResignation: string;
    opponentResigned: string;
    byStalemate: string;
    by50MoveRule: string;
    review: string;
    rematch: string;
    creating: string;
    failedRematch: string;
    failedCopy: string;
  };
  chat: {
    title: string;
    you: string;
    placeholder: string;
    send: string;
  };
  moveHistory: {
    title: string;
    noMoves: string;
    hash: string;
    white: string;
    black: string;
  };
  promotion: {
    title: string;
  };
  errorBoundary: {
    title: string;
    message: string;
    tryAgain: string;
    reload: string;
  };
  tournaments: {
    title: string;
    create: string;
    none: string;
  };
  stats: {
    title: string;
    loading: string;
    unregistered: string;
    signUpPrompt: string;
    wins: string;
    losses: string;
    draws: string;
    total: string;
  };
  matchHistory: {
    title: string;
    loading: string;
    noGames: string;
    searchPlayer: string;
    won: string;
    lost: string;
    draw: string;
    review: string;
  };
  settings: {
    title: string;
    reset: string;
    tabs: {
      general: string;
      board: string;
      display: string;
      gameplay: string;
      clock: string;
      advanced: string;
      account: string;
    };
    account: {
      section: string;
      username: string;
      usernameDesc: string;
      registered: string;
      temporary: string;
      joined: string;
      avatar: string;
      avatarDesc: string;
      avatarUpload: string;
      avatarRemove: string;
      avatarUpdated: string;
      avatarRemoved: string;
      avatarFailed: string;
      displayName: string;
      displayNameDesc: string;
      displayNamePlaceholder: string;
      save: string;
      saved: string;
      saveFailed: string;
      password: string;
      currentPassword: string;
      newPassword: string;
      changePassword: string;
      passwordChanged: string;
      passwordChangeFailed: string;
      passwordTooShort: string;
      currentPasswordIncorrect: string;
      stats: string;
      statsLoading: string;
      wins: string;
      losses: string;
      draws: string;
      notRegistered: string;
      signUpPrompt: string;
      danger: string;
      deleteAccount: string;
      deleteConfirm: string;
      deleteConfirmButton: string;
      deleteFailed: string;
      deleted: string;
    };
    general: {
      sound: string;
      soundEffects: string;
      soundEffectsDesc: string;
      soundVolume: string;
      soundVolumeDesc: string;
      moveSound: string;
      moveSoundDesc: string;
      captureSound: string;
      captureSoundDesc: string;
      notifications: string;
      notificationsDesc: string;
      animations: string;
      animationsToggle: string;
      animationsDesc: string;
      animationSpeed: string;
      animationSpeedDesc: string;
      pieceAnimation: string;
      pieceAnimationDesc: string;
      animateBoardFlip: string;
      animateBoardFlipDesc: string;
      reduceMotion: string;
      reduceMotionDesc: string;
      pieces: string;
      pieceSet: string;
      pieceSetDesc: string;
      pieceDropShadow: string;
      pieceDropShadowDesc: string;
      language: string;
      languageDesc: string;
    };
    board: {
      themeStyle: string;
      boardTheme: string;
      boardThemeDesc: string;
      boardStyle: string;
      boardStyleDesc: string;
      boardSize: string;
      boardSizeDesc: string;
      boardBorder: string;
      boardBorderDesc: string;
      coordinateStyle: string;
      coordinateStyleDesc: string;
      preview: string;
      labelsInfo: string;
      showCoordinates: string;
      showCoordinatesDesc: string;
      highlightLastMove: string;
      highlightLastMoveDesc: string;
      highlightCheck: string;
      highlightCheckDesc: string;
      moveHistory: string;
      moveHistoryDesc: string;
      capturedPieces: string;
      capturedPiecesDesc: string;
      materialDifference: string;
      materialDifferenceDesc: string;
      moveArrows: string;
      moveArrowsDesc: string;
    };
    display: {
      layout: string;
      alwaysWhiteBottom: string;
      alwaysWhiteBottomDesc: string;
      autoFlipBoard: string;
      autoFlipBoardDesc: string;
      compactMode: string;
      compactModeDesc: string;
      uiDensity: string;
      uiDensityDesc: string;
      showPlayerNames: string;
      showPlayerNamesDesc: string;
      showGameInfo: string;
      showGameInfoDesc: string;
      showResultPopup: string;
      showResultPopupDesc: string;
      visuals: string;
      backgroundPattern: string;
      backgroundPatternDesc: string;
      legalMoveHints: string;
      legalMoveHintsDesc: string;
      showThreats: string;
      showThreatsDesc: string;
      showOpponentClock: string;
      showOpponentClockDesc: string;
      clockDisplay: string;
      clockStyle: string;
      clockStyleDesc: string;
      decimalPlaces: string;
      decimalPlacesDesc: string;
    };
    gameplay: {
      moves: string;
      autoPromoteQueen: string;
      autoPromoteQueenDesc: string;
      premove: string;
      premoveDesc: string;
      clickToMove: string;
      clickToMoveDesc: string;
      showMovePreview: string;
      showMovePreviewDesc: string;
      moveNotation: string;
      moveNotationDesc: string;
      keyboardNavigation: string;
      keyboardNavigationDesc: string;
      openingBook: string;
      openingBookDesc: string;
      confirmation: string;
      confirmResign: string;
      confirmResignDesc: string;
      confirmDraw: string;
      confirmDrawDesc: string;
      confirmAbort: string;
      confirmAbortDesc: string;
      autoNextGame: string;
      autoNextGameDesc: string;
      history: string;
      showTimestamps: string;
      showTimestampsDesc: string;
    };
    clock: {
      timeControl: string;
      initialTime: string;
      increment: string;
      preview: string;
      bullet1: string;
      blitz3: string;
      blitz32: string;
      blitz5: string;
      rapid10: string;
      rapid105: string;
      classical30: string;
    };
    advanced: {
      server: string;
      alwaysAskUrl: string;
      alwaysAskUrlDesc: string;
      session: string;
      autoLogout: string;
      autoLogoutDesc: string;
      storedData: string;
      noData: string;
      clear: string;
      confirmClearAll: string;
      clearAll: string;
    };
    options: {
      defaultPurple: string;
      classicWood: string;
      oceanBlue: string;
      forestGreen: string;
      slateGray: string;
      amberGlow: string;
      fast: string;
      normal: string;
      slow: string;
      emoji: string;
      svgDecorative: string;
      none: string;
      slide: string;
      pop: string;
      default: string;
      rounded: string;
      framed: string;
      small: string;
      medium: string;
      large: string;
      dots: string;
      grid: string;
      click: string;
      wood: string;
      compact: string;
      spacious: string;
      digital: string;
      minimal: string;
      short: string;
      long: string;
      standard: string;
      disabled: string;
      min1: string;
      min5: string;
      min10: string;
      min15: string;
      min30: string;
      min60: string;
    };
  };
};

export const en: TranslationKeys = {
  app: {
    loading: 'Loading...',
    connectFailed: 'Failed to connect to server. Check the Server URL.',
    title: 'Chess',
  },
  common: {
    you: 'You',
    unknown: 'Unknown',
    loading: 'Loading...',
    copy: 'Copy',
    cancel: 'Cancel',
    leave: 'Leave',
    backToLobby: 'Back to Lobby',
    copyGameId: 'Copy Game ID',
    copied: 'Copied ✓',
    prev: '◀ Prev',
    next: 'Next ▶',
    start: 'Start',
    end: 'End',
    white: 'White',
    black: 'Black',
    vs: 'vs',
    queen: 'Queen',
    rook: 'Rook',
    bishop: 'Bishop',
    knight: 'Knight',
  },
  navbar: {
    chess: '♚ Chess',
    tagline: 'Where every move matters.',
    friends: 'Friends',
    stats: 'Stats',
    settings: 'Settings',
    history: 'History',
    leaderboard: 'Leaderboard',
    archive: 'Archive',
    tournaments: 'Tournaments',
    logout: 'Logout',
  },
  friends: {
    title: 'Friends',
    friends: 'Friends',
    requests: 'Requests',
    sent: 'Sent',
    add: 'Add',
    addPlaceholder: 'Enter username...',
    requestSent: 'Friend request sent to {name}',
    accept: 'Accept',
    decline: 'Decline',
    remove: 'Remove',
    challenge: 'Challenge',
    challengeSent: 'Challenge sent to {name}!',
    inGame: 'In game',
    pending: 'Pending',
    noFriends: 'No friends yet. Add some!',
    noRequests: 'No pending requests',
    noSent: 'No sent requests',
    friendRequest: 'Friend Request',
    friendRequestFrom: '{name} sent you a friend request',
    friendRequestAccepted: '{name} accepted your friend request!',
    friendRequestDeclined: '{name} declined your friend request',
    removedBy: '{name} removed you as a friend',
    cancel: 'Cancel',
    failedCancel: 'Failed to cancel request',
    challengeAccepted: 'Challenge accepted!',
    challengeDeclined: 'Challenge declined',
    friendOnline: '{name} is now online',
    friendOffline: '{name} went offline',
    failedAccept: 'Failed to accept request',
    failedDecline: 'Failed to decline request',
    failedRemove: 'Failed to remove friend',
    failedChallenge: 'Failed to send challenge',
    usernameTooShort: 'Username must be at least 2 characters',
    usernameTooLong: 'Username must be at most 30 characters',
  },
  login: {
    tagline: 'Every move matters.',
    subtitle: '♚ Chess',
    quickPlay: 'Quick Play',
    signIn: 'Sign In',
    register: 'Register',
    serverUrl: 'Server URL',
    displayName: 'Enter your display name',
    username: 'Username',
    password: 'Password',
    passwordMin: 'Password (min 4 chars)',
    connecting: 'Connecting...',
    enter: 'Enter',
    createAccount: 'Create Account',
    noAccount: 'No account?',
    registerHere: 'Register here',
    haveAccount: 'Already have an account?',
    signInLink: 'Sign in',
    quickPlayInfo: 'Quick play uses a display name only — no password, no saved stats.',
    registeredInfo: 'Registered accounts save your stats and let you log in from any device.',
    failedConnect: 'Failed to connect',
    passwordTooShort: 'Password must be at least 4 characters',
    registrationFailed: 'Registration failed',
    credentialsRequired: 'Username and password are required',
    loginFailed: 'Login failed',
    offlineMode: 'Offline mode',
    offlineModeDesc: 'Play locally without a server. No stats, no history.',
  },
  lobby: {
    openGames: 'Open Games',
    liveGames: 'Live Games',
    local1v1: 'Local 1v1',
    createGame: 'Create Game',
    joinById: 'Join by ID',
    spectateById: 'Spectate by ID',
    noOpenGames: 'No open games yet',
    noActiveGames: 'No active games',
    cannotConnect: 'Cannot connect to server',
    private: 'Private',
    waiting: 'Waiting',
    join: 'Join',
    spectate: 'Spectate',
    inProgress: 'In Progress',
    localDescription: 'Play against a friend on the same screen. No server needed.',
    startLocal: 'Start Local Game',
    privateGame: 'Private game',
    playAI: 'Play vs AI',
    aiDifficulty: 'Difficulty',
    aiBeginner: 'Beginner',
    aiIntermediate: 'Intermediate',
    aiAdvanced: 'Advanced',
    aiExpert: 'Expert',
    aiMaster: 'Master',
    startAI: 'Start AI Game',
    newGame: 'New Game',
    newWindow: 'New Window',
    pasteGameId: 'Paste game ID...',
    failedCreate: 'Failed to create game',
    failedJoin: 'Failed to join game',
    failedLoad: 'Failed to load game',
  },
  game: {
    youWhite: 'You (White)',
    youBlack: 'You (Black)',
    waiting: 'Waiting for opponent...',
    gameId: 'Game ID:',
    opponentDraw: 'Opponent offers a draw',
    accept: 'Accept',
    decline: 'Decline',
    menu: '☰ Menu',
    resign: 'Resign',
    areYouSure: 'Are you sure?',
    offerDraw: 'Offer Draw',
    drawOffered: 'Draw offered...',
    abortGame: 'Abort Game',
    leave: 'Leave',
    failedLoad: 'Failed to load game',
    moveFailed: 'Move failed',
    failedResign: 'Failed to resign',
    challengedYou: 'challenged you to a game!',
    challengeTitle: 'Challenge!',
    opponentRematch: 'Opponent wants a rematch',
    spectators: 'Spectators',
    playAs: 'Play as',
  },
  localGame: {
    blackToMove: '◄ Black to move',
    whiteToMove: 'White to move ◄',
    wins: '{color} wins!',
    stalemate: 'Stalemate — Draw',
    ranOutOfTime: '{color} ran out of time',
    gameOver: 'Game Over',
    checkmate: 'Checkmate',
    noLegalMoves: 'No legal moves',
    timeout: 'Timeout',
    leave: 'Leave',
    newGame: 'New Game',
    moves: 'Moves',
    local1v1: 'Local 1v1',
    instruction: 'Pass the keyboard to your opponent after each move.',
  },
  result: {
    draw: 'Draw',
    youWon: 'You Won',
    youLost: 'You Lost',
    byCheckmate: 'by checkmate',
    byResignation: 'by resignation',
    opponentResigned: 'opponent resigned',
    byStalemate: 'by stalemate',
    by50MoveRule: 'by 50-move rule',
    review: 'Review Game',
    rematch: 'Rematch',
    creating: 'Creating...',
    failedRematch: 'Failed to create rematch',
    failedCopy: 'Failed to copy',
  },
  chat: {
    title: 'Chat',
    you: 'You',
    placeholder: 'Type a message...',
    send: 'Send',
  },
  moveHistory: {
    title: 'Moves',
    noMoves: 'No moves yet',
    hash: '#',
    white: 'White',
    black: 'Black',
  },
  promotion: {
    title: 'Choose promotion piece',
  },
  errorBoundary: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred',
    tryAgain: 'Try Again',
    reload: 'Reload App',
  },
  tournaments: {
    title: 'Tournaments',
    create: 'Create Tournament',
    none: 'No tournaments yet',
  },
  stats: {
    title: 'Stats',
    loading: 'Loading...',
    unregistered: 'Stats are only available for registered accounts.',
    signUpPrompt: 'Log in or create an account to track your stats.',
    wins: 'Wins',
    losses: 'Losses',
    draws: 'Draws',
    total: 'Total: {count} games',
  },
  matchHistory: {
    title: 'Match History',
    loading: 'Loading...',
    noGames: 'No completed games yet',
    searchPlayer: 'Search by player...',
    won: 'Won',
    lost: 'Lost',
    draw: 'Draw',
    review: 'Review',
  },
  settings: {
    title: 'Settings',
    reset: 'Reset to Defaults',
    tabs: {
      general: 'General',
      board: 'Board',
      display: 'Display',
      gameplay: 'Gameplay',
      clock: 'Clock',
      advanced: 'Advanced',
      account: 'Account',
    },
    account: {
      section: 'Account',
      username: 'Username',
      usernameDesc: 'Your login name (cannot be changed)',
      registered: 'Registered',
      temporary: 'Temporary',
      joined: 'Joined',
      avatar: 'Profile Picture',
      avatarDesc: 'Shown on your profile',
      avatarUpload: 'Upload photo',
      avatarRemove: 'Remove',
      avatarUpdated: 'Profile picture updated!',
      avatarRemoved: 'Profile picture removed.',
      avatarFailed: 'Failed to update profile picture',
      displayName: 'Display Name',
      displayNameDesc: 'How your name appears to other players',
      displayNamePlaceholder: 'Enter display name...',
      save: 'Save',
      saved: 'Display name updated!',
      saveFailed: 'Failed to update display name',
      password: 'Password',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      changePassword: 'Change Password',
      passwordChanged: 'Password changed!',
      passwordChangeFailed: 'Failed to change password',
      passwordTooShort: 'Password must be at least 4 characters',
      currentPasswordIncorrect: 'Current password is incorrect',
      stats: 'Stats',
      statsLoading: 'Loading stats...',
      wins: 'Wins',
      losses: 'Losses',
      draws: 'Draws',
      notRegistered: 'Temporary Account',
      signUpPrompt: 'Sign up with a password to keep your stats and play from any device.',
      danger: 'Danger Zone',
      deleteAccount: 'Delete Account',
      deleteConfirm:
        'Are you sure? This will permanently delete your account and all stats. This action cannot be undone.',
      deleteConfirmButton: 'Yes, delete my account',
      deleteFailed: 'Failed to delete account',
      deleted: 'Account deleted',
    },
    general: {
      sound: 'Sound',
      soundEffects: 'Sound Effects',
      soundEffectsDesc: 'Play sounds for moves, captures, and check',
      soundVolume: 'Sound Volume',
      soundVolumeDesc: 'Master volume for game sounds',
      moveSound: 'Move Sound',
      moveSoundDesc: 'Sound style when a piece is moved',
      captureSound: 'Capture Sound',
      captureSoundDesc: 'Sound style when a piece is captured',
      notifications: 'Notifications',
      notificationsDesc: 'Show browser notifications for game events',
      animations: 'Animations',
      animationsToggle: 'Animations',
      animationsDesc: 'Animate piece movement and transitions',
      animationSpeed: 'Animation Speed',
      animationSpeedDesc: 'How fast pieces slide',
      pieceAnimation: 'Piece Animation',
      pieceAnimationDesc: 'How pieces animate when moved',
      animateBoardFlip: 'Animate Board Flip',
      animateBoardFlipDesc: 'Animate rotation when switching sides',
      reduceMotion: 'Reduce Motion',
      reduceMotionDesc: 'Disable all non-essential animations',
      pieces: 'Pieces',
      pieceSet: 'Piece Set',
      pieceSetDesc: 'Visual style for chess pieces',
      pieceDropShadow: 'Piece Drop Shadow',
      pieceDropShadowDesc: 'Soft shadow under pieces for depth',
      language: 'Language',
      languageDesc: 'UI language for the application',
    },
    board: {
      themeStyle: 'Theme & Style',
      boardTheme: 'Board Theme',
      boardThemeDesc: 'Color scheme for the chess board',
      boardStyle: 'Board Style',
      boardStyleDesc: 'Visual style of the board squares',
      boardSize: 'Board Size',
      boardSizeDesc: 'Overall size of the board',
      boardBorder: 'Board Border',
      boardBorderDesc: 'Show a border frame around the board',
      coordinateStyle: 'Coordinate Style',
      coordinateStyleDesc: 'Format for rank/file labels on the board',
      preview: 'Preview',
      labelsInfo: 'Labels & Info',
      showCoordinates: 'Show Coordinates',
      showCoordinatesDesc: 'Display rank and file labels on the board',
      highlightLastMove: 'Highlight Last Move',
      highlightLastMoveDesc: 'Highlight the from and to squares of the last move',
      highlightCheck: 'Highlight Check',
      highlightCheckDesc: 'Highlight the king when in check',
      moveHistory: 'Move History',
      moveHistoryDesc: 'Show the move history panel',
      capturedPieces: 'Captured Pieces',
      capturedPiecesDesc: 'Display captured pieces next to the board',
      materialDifference: 'Material Difference',
      materialDifferenceDesc: 'Show material advantage count',
      moveArrows: 'Move Arrows',
      moveArrowsDesc: 'Show arrows from the last move',
    },
    display: {
      layout: 'Layout',
      alwaysWhiteBottom: 'Always White at Bottom',
      alwaysWhiteBottomDesc: 'Keep white pieces at bottom regardless of your color',
      autoFlipBoard: 'Auto-Flip Board',
      autoFlipBoardDesc: 'Automatically flip board after each move',
      compactMode: 'Compact Mode',
      compactModeDesc: 'Tighter spacing for a more condensed UI',
      uiDensity: 'UI Density',
      uiDensityDesc: 'Overall spacing and sizing of the interface',
      showPlayerNames: 'Show Player Names',
      showPlayerNamesDesc: 'Display player names on the game screen',
      showGameInfo: 'Show Game Info',
      showGameInfoDesc: 'Display game status and result info',
      showResultPopup: 'Show Result Popup',
      showResultPopupDesc: 'Show a popup when the game ends',
      visuals: 'Visuals',
      backgroundPattern: 'Background Pattern',
      backgroundPatternDesc: 'Decorative pattern behind the board',
      legalMoveHints: 'Legal Move Hints',
      legalMoveHintsDesc: 'Display dots on valid destination squares',
      showThreats: 'Show Threats',
      showThreatsDesc: 'Highlight squares attacked by the opponent',
      showOpponentClock: 'Show Opponent Clock',
      showOpponentClockDesc: "Always display the opponent's remaining time",
      clockDisplay: 'Clock Display',
      clockStyle: 'Clock Style',
      clockStyleDesc: 'Visual style of the clock display',
      decimalPlaces: 'Decimal Places',
      decimalPlacesDesc: 'Show fractions of a second on the clock',
    },
    gameplay: {
      moves: 'Moves',
      autoPromoteQueen: 'Auto-Promote to Queen',
      autoPromoteQueenDesc: 'Skip promotion dialog, always promote to queen',
      premove: 'Premove',
      premoveDesc: "Queue a move to play as soon as it's your turn",
      clickToMove: 'Click to Move',
      clickToMoveDesc: 'Click source then destination (no drag)',
      showMovePreview: 'Show Move Preview',
      showMovePreviewDesc: 'Preview the piece on the destination before confirming',
      moveNotation: 'Move Notation',
      moveNotationDesc: 'Format for the move history list',
      keyboardNavigation: 'Keyboard Navigation',
      keyboardNavigationDesc: 'Navigate the board with arrow keys',
      openingBook: 'Opening Book',
      openingBookDesc: 'Show opening names during the game',
      confirmation: 'Confirmation',
      confirmResign: 'Confirm Resign',
      confirmResignDesc: 'Require double-click to resign',
      confirmDraw: 'Confirm Draw',
      confirmDrawDesc: 'Require confirmation to agree to a draw',
      confirmAbort: 'Confirm Abort',
      confirmAbortDesc: 'Require confirmation to abort a game',
      autoNextGame: 'Auto Next Game',
      autoNextGameDesc: 'Automatically start a new game after the current one ends',
      history: 'History',
      showTimestamps: 'Show Timestamps',
      showTimestampsDesc: 'Show move timestamps in the history panel',
    },
    clock: {
      timeControl: 'Time Control',
      initialTime: 'Initial time (min)',
      increment: 'Increment (sec)',
      preview: 'Preview',
      bullet1: 'Bullet 1+0',
      blitz3: 'Blitz 3+0',
      blitz32: 'Blitz 3+2',
      blitz5: 'Blitz 5+0',
      rapid10: 'Rapid 10+0',
      rapid105: 'Rapid 10+5',
      classical30: 'Classical 30+0',
    },
    advanced: {
      server: 'Server',
      alwaysAskUrl: 'Always ask for server URL',
      alwaysAskUrlDesc: 'Show the server URL field on every login instead of remembering it',
      session: 'Session',
      autoLogout: 'Auto logout',
      autoLogoutDesc: 'Automatically log out after inactivity',
      storedData: 'Stored Data',
      noData: 'No local data stored',
      clear: 'Clear',
      confirmClearAll: 'Confirm Clear All',
      clearAll: 'Clear All Local Data',
    },
    options: {
      defaultPurple: 'Default (Purple)',
      classicWood: 'Classic Wood',
      oceanBlue: 'Ocean Blue',
      forestGreen: 'Forest Green',
      slateGray: 'Slate Gray',
      amberGlow: 'Amber Glow',
      fast: 'Fast',
      normal: 'Normal',
      slow: 'Slow',
      emoji: 'Emoji',
      svgDecorative: 'SVG Decorative',
      none: 'None',
      slide: 'Slide',
      pop: 'Pop',
      default: 'Default',
      rounded: 'Rounded',
      framed: 'Framed',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      dots: 'Dots',
      grid: 'Grid',
      click: 'Click',
      wood: 'Wood',
      compact: 'Compact',
      spacious: 'Spacious',
      digital: 'Digital',
      minimal: 'Minimal',
      short: 'Short (e4)',
      long: 'Long (e2-e4)',
      standard: 'Standard',
      disabled: 'Disabled',
      min1: '1 minute',
      min5: '5 minutes',
      min10: '10 minutes',
      min15: '15 minutes',
      min30: '30 minutes',
      min60: '60 minutes',
    },
  },
};

export const de: TranslationKeys = {
  app: {
    loading: 'Lade...',
    connectFailed: 'Verbindung zum Server fehlgeschlagen. Überprüfe die Server-URL.',
    title: 'Schach',
  },
  common: {
    you: 'Du',
    unknown: 'Unbekannt',
    loading: 'Lade...',
    copy: 'Kopieren',
    cancel: 'Abbrechen',
    leave: 'Verlassen',
    backToLobby: 'Zurück zur Lobby',
    copyGameId: 'Spiel-ID kopieren',
    copied: 'Kopiert ✓',
    prev: '◀ Zurück',
    next: 'Weiter ▶',
    start: 'Start',
    end: 'Ende',
    white: 'Weiß',
    black: 'Schwarz',
    vs: 'gegen',
    queen: 'Dame',
    rook: 'Turm',
    bishop: 'Läufer',
    knight: 'Springer',
  },
  navbar: {
    chess: '♚ Schach',
    tagline: 'Wo jeder Zug zählt.',
    friends: 'Freunde',
    stats: 'Statistik',
    settings: 'Einstellungen',
    history: 'Verlauf',
    leaderboard: 'Rangliste',
    archive: 'Archiv',
    tournaments: 'Turniere',
    logout: 'Abmelden',
  },
  friends: {
    title: 'Freunde',
    friends: 'Freunde',
    requests: 'Anfragen',
    sent: 'Gesendet',
    add: 'Hinzufügen',
    addPlaceholder: 'Benutzername eingeben...',
    requestSent: 'Freundschaftsanfrage an {name} gesendet',
    accept: 'Annehmen',
    decline: 'Ablehnen',
    remove: 'Entfernen',
    challenge: 'Fordern',
    challengeSent: 'Herausforderung an {name} gesendet!',
    inGame: 'Im Spiel',
    pending: 'Ausstehend',
    noFriends: 'Noch keine Freunde. Füge welche hinzu!',
    noRequests: 'Keine ausstehenden Anfragen',
    noSent: 'Keine gesendeten Anfragen',
    friendRequest: 'Freundschaftsanfrage',
    friendRequestFrom: '{name} hat dir eine Freundschaftsanfrage gesendet',
    friendRequestAccepted: '{name} hat deine Freundschaftsanfrage angenommen!',
    friendRequestDeclined: '{name} hat deine Freundschaftsanfrage abgelehnt',
    removedBy: '{name} hat dich als Freund entfernt',
    cancel: 'Abbrechen',
    failedCancel: 'Anfrage konnte nicht abgebrochen werden',
    challengeAccepted: 'Herausforderung angenommen!',
    challengeDeclined: 'Herausforderung abgelehnt',
    friendOnline: '{name} ist jetzt online',
    friendOffline: '{name} ist offline gegangen',
    failedAccept: 'Anfrage konnte nicht angenommen werden',
    failedDecline: 'Anfrage konnte nicht abgelehnt werden',
    failedRemove: 'Freund konnte nicht entfernt werden',
    failedChallenge: 'Herausforderung konnte nicht gesendet werden',
    usernameTooShort: 'Benutzername muss mindestens 2 Zeichen lang sein',
    usernameTooLong: 'Benutzername darf höchstens 30 Zeichen lang sein',
  },
  login: {
    tagline: 'Jeder Zug zählt.',
    subtitle: '♚ Schach',
    quickPlay: 'Schnellspiel',
    signIn: 'Anmelden',
    register: 'Registrieren',
    serverUrl: 'Server-URL',
    displayName: 'Gib deinen Namen ein',
    username: 'Benutzername',
    password: 'Passwort',
    passwordMin: 'Passwort (mind. 4 Zeichen)',
    connecting: 'Verbinde...',
    enter: 'Los',
    createAccount: 'Konto erstellen',
    noAccount: 'Kein Konto?',
    registerHere: 'Hier registrieren',
    haveAccount: 'Bereits ein Konto?',
    signInLink: 'Anmelden',
    quickPlayInfo: 'Schnellspiel verwendet nur einen Namen — kein Passwort, keine Statistik.',
    registeredInfo: 'Registrierte Kontos speichern deine Statistik und funktionieren auf jedem Gerät.',
    failedConnect: 'Verbindung fehlgeschlagen',
    passwordTooShort: 'Passwort muss mindestens 4 Zeichen lang sein',
    registrationFailed: 'Registrierung fehlgeschlagen',
    credentialsRequired: 'Benutzername und Passwort erforderlich',
    loginFailed: 'Anmeldung fehlgeschlagen',
    offlineMode: 'Offline-Modus',
    offlineModeDesc: 'Lokal spielen ohne Server. Keine Statistik, kein Verlauf.',
  },
  lobby: {
    openGames: 'Offene Spiele',
    liveGames: 'Live-Spiele',
    local1v1: 'Lokal 1v1',
    createGame: 'Spiel erstellen',
    joinById: 'Beitreten per ID',
    spectateById: 'Zuschauen per ID',
    noOpenGames: 'Keine offenen Spiele',
    noActiveGames: 'Keine aktiven Spiele',
    cannotConnect: 'Keine Verbindung zum Server',
    private: 'Privat',
    waiting: 'Wartet',
    join: 'Beitreten',
    spectate: 'Zuschauen',
    inProgress: 'Läuft',
    localDescription: 'Spiele gegen einen Freund auf demselben Bildschirm. Kein Server nötig.',
    startLocal: 'Lokales Spiel starten',
    privateGame: 'Privates Spiel',
    playAI: 'Gegen KI spielen',
    aiDifficulty: 'Schwierigkeit',
    aiBeginner: 'Anfänger',
    aiIntermediate: 'Mittel',
    aiAdvanced: 'Fortgeschritten',
    aiExpert: 'Experte',
    aiMaster: 'Meister',
    startAI: 'KI-Spiel starten',
    newGame: 'Neues Spiel',
    newWindow: 'Neues Fenster',
    pasteGameId: 'Spiel-ID einfügen...',
    failedCreate: 'Spiel erstellen fehlgeschlagen',
    failedJoin: 'Beitreten fehlgeschlagen',
    failedLoad: 'Spiel laden fehlgeschlagen',
  },
  game: {
    youWhite: 'Du (Weiß)',
    youBlack: 'Du (Schwarz)',
    waiting: 'Warte auf Gegner...',
    gameId: 'Spiel-ID:',
    opponentDraw: 'Gegner bietet Remis an',
    accept: 'Annehmen',
    decline: 'Ablehnen',
    menu: '☰ Menü',
    resign: 'Aufgeben',
    areYouSure: 'Bist du sicher?',
    offerDraw: 'Remis anbieten',
    drawOffered: 'Remis angeboten...',
    abortGame: 'Spiel abbrechen',
    leave: 'Verlassen',
    failedLoad: 'Spiel laden fehlgeschlagen',
    moveFailed: 'Zug fehlgeschlagen',
    failedResign: 'Aufgeben fehlgeschlagen',
    challengedYou: 'fordert dich zu einem Spiel heraus!',
    challengeTitle: 'Herausforderung!',
    opponentRematch: 'Gegner möchte Revanche',
    spectators: 'Zuschauer',
    playAs: 'Spielen als',
  },
  localGame: {
    blackToMove: '◄ Schwarz ist am Zug',
    whiteToMove: 'Weiß ist am Zug ◄',
    wins: '{color} gewinnt!',
    stalemate: 'Patt — Remis',
    ranOutOfTime: '{color} hat keine Zeit mehr',
    gameOver: 'Spiel vorbei',
    checkmate: 'Schachmatt',
    noLegalMoves: 'Keine legalen Züge',
    timeout: 'Zeit abgelaufen',
    leave: 'Verlassen',
    newGame: 'Neues Spiel',
    moves: 'Züge',
    local1v1: 'Lokal 1v1',
    instruction: 'Gib das Gerät nach jedem Zug an deinen Gegner weiter.',
  },
  result: {
    draw: 'Remis',
    youWon: 'Gewonnen',
    youLost: 'Verloren',
    byCheckmate: 'durch Schachmatt',
    byResignation: 'durch Aufgabe',
    opponentResigned: 'Gegner gab auf',
    byStalemate: 'durch Patt',
    by50MoveRule: 'durch 50-Züge-Regel',
    review: 'Rückblick',
    rematch: 'Revanche',
    creating: 'Erstelle...',
    failedRematch: 'Revanche fehlgeschlagen',
    failedCopy: 'Kopieren fehlgeschlagen',
  },
  chat: {
    title: 'Chat',
    you: 'Du',
    placeholder: 'Schreibe eine Nachricht...',
    send: 'Senden',
  },
  moveHistory: {
    title: 'Züge',
    noMoves: 'Noch keine Züge',
    hash: '#',
    white: 'Weiß',
    black: 'Schwarz',
  },
  promotion: {
    title: 'Umwandlung wählen',
  },
  errorBoundary: {
    title: 'Etwas ist schiefgelaufen',
    message: 'Ein unerwarteter Fehler ist aufgetreten',
    tryAgain: 'Erneut versuchen',
    reload: 'App neuladen',
  },
  tournaments: {
    title: 'Turniere',
    create: 'Turnier erstellen',
    none: 'Noch keine Turniere',
  },
  stats: {
    title: 'Statistik',
    loading: 'Lade...',
    unregistered: 'Statistik ist nur für registrierte Kontos verfügbar.',
    signUpPrompt: 'Melde dich an oder erstelle ein Konto, um deine Statistik zu verfolgen.',
    wins: 'Siege',
    losses: 'Niederlagen',
    draws: 'Remis',
    total: 'Insgesamt: {count} Spiele',
  },
  matchHistory: {
    title: 'Spielverlauf',
    loading: 'Lade...',
    noGames: 'Noch keine abgeschlossenen Spiele',
    searchPlayer: 'Spieler suchen...',
    won: 'Gewonnen',
    lost: 'Verloren',
    draw: 'Remis',
    review: 'Rückblick',
  },
  settings: {
    title: 'Einstellungen',
    reset: 'Zurücksetzen',
    tabs: {
      general: 'Allgemein',
      board: 'Brett',
      display: 'Anzeige',
      gameplay: 'Spielablauf',
      clock: 'Uhr',
      advanced: 'Erweitert',
      account: 'Konto',
    },
    account: {
      section: 'Konto',
      username: 'Benutzername',
      usernameDesc: 'Dein Anmeldename (kann nicht geändert werden)',
      registered: 'Registriert',
      temporary: 'Temporär',
      joined: 'Beigetreten',
      avatar: 'Profilbild',
      avatarDesc: 'Wird auf deinem Profil angezeigt',
      avatarUpload: 'Foto hochladen',
      avatarRemove: 'Entfernen',
      avatarUpdated: 'Profilbild aktualisiert!',
      avatarRemoved: 'Profilbild entfernt.',
      avatarFailed: 'Fehler beim Aktualisieren des Profilbilds',
      displayName: 'Anzeigename',
      displayNameDesc: 'Wie dein Name für andere Spieler angezeigt wird',
      displayNamePlaceholder: 'Anzeigenamen eingeben...',
      save: 'Speichern',
      saved: 'Anzeigename aktualisiert!',
      saveFailed: 'Fehler beim Aktualisieren des Anzeigenamens',
      password: 'Passwort',
      currentPassword: 'Aktuelles Passwort',
      newPassword: 'Neues Passwort',
      changePassword: 'Passwort ändern',
      passwordChanged: 'Passwort geändert!',
      passwordChangeFailed: 'Passwortänderung fehlgeschlagen',
      passwordTooShort: 'Passwort muss mindestens 4 Zeichen lang sein',
      currentPasswordIncorrect: 'Aktuelles Passwort ist falsch',
      stats: 'Statistiken',
      statsLoading: 'Lade Statistiken...',
      wins: 'Siege',
      losses: 'Niederlagen',
      draws: 'Remis',
      notRegistered: 'Temporäres Konto',
      signUpPrompt:
        'Registriere dich mit einem Passwort, um deine Statistiken zu behalten und von jedem Gerät aus zu spielen.',
      danger: 'Gefahrenzone',
      deleteAccount: 'Konto löschen',
      deleteConfirm:
        'Bist du sicher? Dies löscht dein Konto und alle Statistiken dauerhaft. Diese Aktion kann nicht rückgängig gemacht werden.',
      deleteConfirmButton: 'Ja, Konto löschen',
      deleteFailed: 'Fehler beim Löschen des Kontos',
      deleted: 'Konto gelöscht',
    },
    general: {
      sound: 'Sound',
      soundEffects: 'Soundeffekte',
      soundEffectsDesc: 'Spiele Töne für Züge, Schläge und Schach',
      soundVolume: 'Lautstärke',
      soundVolumeDesc: 'Hauptlautstärke für Spielgeräusche',
      moveSound: 'Zugton',
      moveSoundDesc: 'Klangstil beim Bewegen einer Figur',
      captureSound: 'Schlagton',
      captureSoundDesc: 'Klangstil beim Schlagen einer Figur',
      notifications: 'Benachrichtigungen',
      notificationsDesc: 'Browser-Benachrichtigungen für Spielereignisse anzeigen',
      animations: 'Animationen',
      animationsToggle: 'Animationen',
      animationsDesc: 'Figurenbewegungen und Übergänge animieren',
      animationSpeed: 'Animationsgeschwindigkeit',
      animationSpeedDesc: 'Wie schnell Figuren gleiten',
      pieceAnimation: 'Figurenanimation',
      pieceAnimationDesc: 'Wie Figuren bei Bewegung animiert werden',
      animateBoardFlip: 'Brettdrehung animieren',
      animateBoardFlipDesc: 'Rotation beim Seitenwechsel animieren',
      reduceMotion: 'Bewegung reduzieren',
      reduceMotionDesc: 'Alle unwesentlichen Animationen deaktivieren',
      pieces: 'Figuren',
      pieceSet: 'Figurensatz',
      pieceSetDesc: 'Visueller Stil der Schachfiguren',
      pieceDropShadow: 'Schlagschatten',
      pieceDropShadowDesc: 'Weicher Schatten unter Figuren für Tiefe',
      language: 'Sprache',
      languageDesc: 'Sprache der Benutzeroberfläche',
    },
    board: {
      themeStyle: 'Thema & Stil',
      boardTheme: 'Brettthema',
      boardThemeDesc: 'Farbschema des Schachbretts',
      boardStyle: 'Brettstil',
      boardStyleDesc: 'Visueller Stil der Brettfelder',
      boardSize: 'Brettgröße',
      boardSizeDesc: 'Gesamtgröße des Bretts',
      boardBorder: 'Brettrand',
      boardBorderDesc: 'Rahmen um das Brett anzeigen',
      coordinateStyle: 'Koordinatenstil',
      coordinateStyleDesc: 'Format der Reihen-/Spaltenbeschriftung',
      preview: 'Vorschau',
      labelsInfo: 'Beschriftungen & Info',
      showCoordinates: 'Koordinaten anzeigen',
      showCoordinatesDesc: 'Reihen- und Spaltenbeschriftung auf dem Brett anzeigen',
      highlightLastMove: 'Letzten Zug hervorheben',
      highlightLastMoveDesc: 'Start- und Zielfeld des letzten Zuges markieren',
      highlightCheck: 'Schach hervorheben',
      highlightCheckDesc: 'König bei Schachstellung markieren',
      moveHistory: 'Zughistorie',
      moveHistoryDesc: 'Zughistorie-Panel anzeigen',
      capturedPieces: 'Geschlagene Figuren',
      capturedPiecesDesc: 'Geschlagene Figuren neben dem Brett anzeigen',
      materialDifference: 'Materialvorteil',
      materialDifferenceDesc: 'Materialvorteil anzeigen',
      moveArrows: 'Zugpfeile',
      moveArrowsDesc: 'Pfeile vom letzten Zug anzeigen',
    },
    display: {
      layout: 'Layout',
      alwaysWhiteBottom: 'Weiß immer unten',
      alwaysWhiteBottomDesc: 'Weiße Figuren immer unten behalten, unabhängig von deiner Farbe',
      autoFlipBoard: 'Automatisch drehen',
      autoFlipBoardDesc: 'Brett nach jedem Zug automatisch drehen',
      compactMode: 'Kompaktmodus',
      compactModeDesc: 'Engeres Layout für eine kompaktere Darstellung',
      uiDensity: 'UI-Dichte',
      uiDensityDesc: 'Gesamte Abstände und Größen der Oberfläche',
      showPlayerNames: 'Spielernamen anzeigen',
      showPlayerNamesDesc: 'Spielernamen auf dem Spielbildschirm anzeigen',
      showGameInfo: 'Spielinfo anzeigen',
      showGameInfoDesc: 'Spielstatus und Ergebnistext anzeigen',
      showResultPopup: 'Ergebnis-Popup',
      showResultPopupDesc: 'Popup beim Spielende anzeigen',
      visuals: 'Visuelles',
      backgroundPattern: 'Hintergrundmuster',
      backgroundPatternDesc: 'Dekoratives Muster hinter dem Brett',
      legalMoveHints: 'Zughilfen',
      legalMoveHintsDesc: 'Punkte auf gültigen Zielfeldern anzeigen',
      showThreats: 'Bedrohungen anzeigen',
      showThreatsDesc: 'Vom Gegner angegriffene Felder markieren',
      showOpponentClock: 'Gegneruhr anzeigen',
      showOpponentClockDesc: 'Verbleibende Zeit des Gegners immer anzeigen',
      clockDisplay: 'Uhranzeige',
      clockStyle: 'Uhrstil',
      clockStyleDesc: 'Visueller Stil der Zeitanzeige',
      decimalPlaces: 'Nachkommastellen',
      decimalPlacesDesc: 'Sekundenbruchteile auf der Uhr anzeigen',
    },
    gameplay: {
      moves: 'Züge',
      autoPromoteQueen: 'Automatisch zur Dame',
      autoPromoteQueenDesc: 'Umwandlungsdialog überspringen, immer zur Dame umwandeln',
      premove: 'Vorzug',
      premoveDesc: 'Einen Zug vormerken, der ausgeführt wird, sobald du dran bist',
      clickToMove: 'Klicken zum Ziehen',
      clickToMoveDesc: 'Quelle dann Ziel anklicken (ohne Ziehen)',
      showMovePreview: 'Zugvorschau',
      showMovePreviewDesc: 'Figur auf dem Zielfeld vor dem Bestätigen anzeigen',
      moveNotation: 'Zugnotation',
      moveNotationDesc: 'Format der Zughistorie',
      keyboardNavigation: 'Tastaturnavigation',
      keyboardNavigationDesc: 'Brett mit Pfeiltasten navigieren',
      openingBook: 'Eröffnungsbuch',
      openingBookDesc: 'Eröffnungsnamen während des Spiels anzeigen',
      confirmation: 'Bestätigung',
      confirmResign: 'Aufgeben bestätigen',
      confirmResignDesc: 'Doppelklick zum Aufgeben erforderlich',
      confirmDraw: 'Remis bestätigen',
      confirmDrawDesc: 'Bestätigung für Remis-Vereinbarung erforderlich',
      confirmAbort: 'Abbruch bestätigen',
      confirmAbortDesc: 'Bestätigung zum Abbrechen eines Spiels erforderlich',
      autoNextGame: 'Nächstes Spiel automatisch',
      autoNextGameDesc: 'Automatisch ein neues Spiel starten, wenn das aktuelle endet',
      history: 'Verlauf',
      showTimestamps: 'Zeitstempel anzeigen',
      showTimestampsDesc: 'Zugzeitstempel im Verlauf anzeigen',
    },
    clock: {
      timeControl: 'Zeitkontrolle',
      initialTime: 'Startzeit (Min.)',
      increment: 'Inkrement (Sek.)',
      preview: 'Vorschau',
      bullet1: 'Bullet 1+0',
      blitz3: 'Blitz 3+0',
      blitz32: 'Blitz 3+2',
      blitz5: 'Blitz 5+0',
      rapid10: 'Rapid 10+0',
      rapid105: 'Rapid 10+5',
      classical30: 'Klassisch 30+0',
    },
    advanced: {
      server: 'Server',
      alwaysAskUrl: 'Server-URL immer erfragen',
      alwaysAskUrlDesc: 'Server-URL-Feld bei jedem Login anzeigen, statt sie zu merken',
      session: 'Sitzung',
      autoLogout: 'Auto-Abmeldung',
      autoLogoutDesc: 'Nach Inaktivität automatisch abmelden',
      storedData: 'Gespeicherte Daten',
      noData: 'Keine lokalen Daten gespeichert',
      clear: 'Löschen',
      confirmClearAll: 'Alles löschen bestätigen',
      clearAll: 'Alle lokalen Daten löschen',
    },
    options: {
      defaultPurple: 'Standard (Lila)',
      classicWood: 'Klassisch Holz',
      oceanBlue: 'Ozeanblau',
      forestGreen: 'Waldgrün',
      slateGray: 'Schiefergrau',
      amberGlow: 'Bernstein',
      fast: 'Schnell',
      normal: 'Normal',
      slow: 'Langsam',
      emoji: 'Emoji',
      svgDecorative: 'SVG Dekorativ',
      none: 'Keine',
      slide: 'Gleiten',
      pop: 'Springen',
      default: 'Standard',
      rounded: 'Abgerundet',
      framed: 'Gerahmt',
      small: 'Klein',
      medium: 'Mittel',
      large: 'Groß',
      dots: 'Punkte',
      grid: 'Gitter',
      click: 'Klick',
      wood: 'Holz',
      compact: 'Kompakt',
      spacious: 'Großzügig',
      digital: 'Digital',
      minimal: 'Minimal',
      short: 'Kurz (e4)',
      long: 'Lang (e2-e4)',
      standard: 'Standard',
      disabled: 'Deaktiviert',
      min1: '1 Minute',
      min5: '5 Minuten',
      min10: '10 Minuten',
      min15: '15 Minuten',
      min30: '30 Minuten',
      min60: '60 Minuten',
    },
  },
};

export const locales = { en, de };

export function getTranslations(lang: string): Record<string, string> {
  const locale = locales[lang as keyof typeof locales] || en;
  const flat: Record<string, string> = {};
  flatten(locale, '', flat);
  return flat;
}

export function getLanguageNames(): Record<string, string> {
  return { en: 'English', de: 'Deutsch' };
}

function flatten(obj: Record<string, unknown>, prefix: string, out: Record<string, string>): void {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      flatten(value as Record<string, unknown>, path, out);
    } else if (typeof value === 'string') {
      out[path] = value;
    }
  }
}
