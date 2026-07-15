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
    undo: string;
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
    editor: string;
    play: string;
    logout: string;
  };
  friends: {
    title: string;
    friends: string;
    online: string;
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
    searchPlaceholder: string;
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
    forgotPassword: string;
  };
  forgotPassword: {
    title: string;
    desc: string;
    emailPlaceholder: string;
    send: string;
    sent: string;
    sentDesc: string;
    checkEmail: string;
    enterEmail: string;
    failed: string;
    backToLogin: string;
  };
  resetPassword: {
    title: string;
    desc: string;
    newPassword: string;
    confirmPassword: string;
    reset: string;
    done: string;
    doneDesc: string;
    success: string;
    failed: string;
    invalidToken: string;
    invalidLink: string;
    passwordsDontMatch: string;
    goToLogin: string;
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
    playBot: string;
    botDifficulty: string;
    botBeginner: string;
    botIntermediate: string;
    botAdvanced: string;
    botExpert: string;
    botMaster: string;
    startBot: string;
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
    opponentDisconnected: string;
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
    byAgreement: string;
    byEngineError: string;
    byAdminAction: string;
    review: string;
    rematch: string;
    creating: string;
    failedRematch: string;
    failedCopy: string;
  };
  sidebar: {
    chat: string;
    friends: string;
    lobby: string;
    privateChat: string;
    conversations: string;
    startConversation: string;
    messagePlaceholder: string;
    newMessage: string;
    noConversations: string;
    minimize: string;
    expand: string;
  };
  chat: {
    title: string;
    you: string;
    placeholder: string;
    send: string;
    justNow: string;
    challenge: string;
    acceptChallenge: string;
    declineChallenge: string;
    challengeSent: string;
    gameReview: string;
    createGroup: string;
    creatingGroup: string;
    groupNameTooShort: string;
    groupNamePlaceholder: string;
    manageGroup: string;
    members: string;
    addMember: string;
    remove: string;
    promote: string;
    demote: string;
    transferOwnership: string;
    transferConfirm: string;
    leaveGroup: string;
    leaveConfirm: string;
    disbandGroup: string;
    disbandConfirm: string;
    notConnected: string;
  };
  gameReview: {
    title: string;
    moves: string;
    flipBoard: string;
    sharePgn: string;
    pgnCopied: string;
    review: string;
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
    private: string;
    public: string;
    joinByCode: string;
    shareCode: string;
    codeCopied: string;
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
    empty: string;
  };
  profile: {
    title: string;
    rating: string;
    gamesPlayed: string;
    winRate: string;
    addFriend: string;
    removeFriend: string;
    pendingRequest: string;
    acceptRequest: string;
    acceptRequestShort: string;
    declineRequest: string;
    friend: string;
    editProfile: string;
    matchHistory: string;
    noGames: string;
    back: string;
    viewFullProfile: string;
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
    games: string;
  };
  moveQuality: {
    excellent: string;
    good: string;
    inaccuracy: string;
    bestMove: string;
  };
  boardEditor: {
    title: string;
    placePiece: string;
    clear: string;
    startPos: string;
    flipBoard: string;
    exportFen: string;
    fenCopied: string;
    importFen: string;
    fenPlaceholder: string;
    invalidFen: string;
    needBothKings: string;
    play: string;
    piece: string;
    color: string;
  };
  settings: {
    title: string;
    reset: string;
    searchPlaceholder: string;
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
      sidebarPosition: string;
      sidebarPositionDesc: string;
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
    shortcuts: string;
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
      left: string;
      right: string;
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
  shortcuts: {
    intro: string;
    categoryGeneral: string;
    categoryGame: string;
    categoryNavigation: string;
    togglePalette: string;
    togglePaletteDesc: string;
    toggleSidebar: string;
    toggleSidebarDesc: string;
    toggleSound: string;
    toggleSoundDesc: string;
    openSettings: string;
    openSettingsDesc: string;
    reloadApp: string;
    reloadAppDesc: string;
    flipBoard: string;
    flipBoardDesc: string;
    prevMove: string;
    prevMoveDesc: string;
    nextMove: string;
    nextMoveDesc: string;
    startReview: string;
    startReviewDesc: string;
    endReview: string;
    endReviewDesc: string;
    offerDraw: string;
    offerDrawDesc: string;
    resignGame: string;
    resignGameDesc: string;
    newGame: string;
    newGameDesc: string;
    toggleChat: string;
    toggleChatDesc: string;
    goHome: string;
    goHomeDesc: string;
    goPlay: string;
    goPlayDesc: string;
    goFriends: string;
    goFriendsDesc: string;
    goSettings: string;
    goSettingsDesc: string;
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
    prev: 'Prev',
    next: 'Next',
    start: 'Start',
    end: 'End',
    undo: 'Undo',
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
    editor: 'Editor',
    play: 'Play',
    logout: 'Logout',
  },
  friends: {
    title: 'Friends',
    friends: 'Friends',
    online: 'Online',
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
    searchPlaceholder: 'Search friends...',
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
    forgotPassword: 'Forgot password?',
  },
  forgotPassword: {
    title: 'Forgot Password',
    desc: "Enter your email address and we'll send you a recovery link.",
    emailPlaceholder: 'your@email.com',
    send: 'Send Recovery Email',
    sent: 'Recovery email sent',
    sentDesc: 'Check your inbox for the recovery link.',
    checkEmail: 'Check Your Email',
    enterEmail: 'Please enter your email address',
    failed: 'Failed to send recovery email',
    backToLogin: 'Back to login',
  },
  resetPassword: {
    title: 'Reset Password',
    desc: 'Enter your new password.',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    reset: 'Reset Password',
    done: 'Password Reset',
    doneDesc: 'Your password has been reset. You can now log in with your new password.',
    success: 'Password reset successfully',
    failed: 'Failed to reset password',
    invalidToken: 'Invalid or missing reset token',
    invalidLink: 'Invalid Reset Link',
    passwordsDontMatch: 'Passwords do not match',
    goToLogin: 'Go to login',
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
    playBot: 'Play vs Bot',
    botDifficulty: 'Difficulty',
    botBeginner: 'Beginner',
    botIntermediate: 'Intermediate',
    botAdvanced: 'Advanced',
    botExpert: 'Expert',
    botMaster: 'Master',
    startBot: 'Start Bot Game',
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
    opponentDisconnected: 'Opponent disconnected',
    spectators: 'Spectators',
    playAs: 'Play as',
  },
  localGame: {
    blackToMove: 'Black to move',
    whiteToMove: 'White to move',
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
    byAgreement: 'by agreement',
    byEngineError: 'engine error — game cancelled',
    byAdminAction: 'ended by admin',
    review: 'Review Game',
    rematch: 'Rematch',
    creating: 'Creating...',
    failedRematch: 'Failed to create rematch',
    failedCopy: 'Failed to copy',
  },
  sidebar: {
    chat: 'Chat',
    friends: 'Friends',
    lobby: 'Lobby',
    privateChat: 'Private Chat',
    conversations: 'Conversations',
    startConversation: 'Start conversation',
    messagePlaceholder: 'Type a message...',
    newMessage: 'New message',
    noConversations: 'No conversations yet',
    minimize: 'Minimize',
    expand: 'Expand',
  },
  chat: {
    title: 'Chat',
    you: 'You',
    placeholder: 'Type a message...',
    send: 'Send',
    justNow: 'now',
    challenge: 'Challenge',
    acceptChallenge: 'Accept',
    declineChallenge: 'Decline',
    challengeSent: 'Challenge sent!',
    gameReview: 'Review Game',
    createGroup: 'New Group',
    creatingGroup: 'Creating group...',
    groupNameTooShort: 'Group name must be at least 2 characters',
    groupNamePlaceholder: 'Group name...',
    manageGroup: 'Manage Group',
    members: 'Members',
    addMember: 'Add Member',
    remove: 'Remove',
    promote: 'Promote',
    demote: 'Demote',
    transferOwnership: 'Transfer',
    transferConfirm: 'Transfer group ownership?',
    leaveGroup: 'Leave Group',
    leaveConfirm: 'Leave this group?',
    disbandGroup: 'Disband Group',
    disbandConfirm: 'Disband this group? This cannot be undone.',
    notConnected: 'Not connected to server',
  },
  gameReview: {
    title: 'Game Review',
    moves: 'Moves',
    flipBoard: 'Flip Board',
    sharePgn: 'Share PGN',
    pgnCopied: 'PGN copied!',
    review: 'Review',
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
    private: 'Private',
    public: 'Public',
    joinByCode: 'Join by Code',
    shareCode: 'Share Code: {code}',
    codeCopied: 'Code copied!',
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
    empty: 'Leaderboard is empty',
  },
  profile: {
    title: 'Profile',
    rating: 'Rating',
    gamesPlayed: 'Games Played',
    winRate: 'Win Rate',
    addFriend: 'Add Friend',
    removeFriend: 'Remove Friend',
    pendingRequest: 'Request Pending',
    acceptRequest: 'Accept Friend Request',
    acceptRequestShort: 'Accept',
    declineRequest: 'Decline',
    friend: 'Friends',
    editProfile: 'Edit Profile',
    matchHistory: 'Match History',
    noGames: 'No games played yet',
    back: 'Back',
    viewFullProfile: 'View full profile',
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
    games: 'games',
  },
  moveQuality: {
    excellent: 'Excellent',
    good: 'Good',
    inaccuracy: 'Inaccuracy',
    bestMove: 'Best: {move}',
  },
  boardEditor: {
    title: 'Board Editor',
    placePiece: 'Place Piece',
    clear: 'Clear Board',
    startPos: 'Start Position',
    flipBoard: 'Flip Board',
    exportFen: 'Export FEN',
    fenCopied: 'FEN copied!',
    importFen: 'Import FEN',
    fenPlaceholder: 'Paste FEN string...',
    invalidFen: 'Invalid FEN',
    needBothKings: 'Both kings must be placed on the board',
    play: 'Play from Position',
    piece: 'Piece',
    color: 'Color',
  },
  settings: {
    title: 'Settings',
    reset: 'Reset to Defaults',
    searchPlaceholder: 'Search settings...',
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
      sidebarPosition: 'Sidebar Position',
      sidebarPositionDesc: 'Which side of the screen the sidebar appears on',
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
    shortcuts: 'Keyboard Shortcuts',
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
      left: 'Left',
      right: 'Right',
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
  shortcuts: {
    intro:
      'Press the key combination to trigger an action. G+letter sequences: press G, release, then press the letter.',
    categoryGeneral: 'General',
    categoryGame: 'Game',
    categoryNavigation: 'Navigation',
    togglePalette: 'Command Palette',
    togglePaletteDesc: 'Open the command palette',
    toggleSidebar: 'Toggle Sidebar',
    toggleSidebarDesc: 'Show or hide the sidebar',
    toggleSound: 'Toggle Sound',
    toggleSoundDesc: 'Enable or disable sound effects',
    openSettings: 'Open Settings',
    openSettingsDesc: 'Open the settings dialog',
    reloadApp: 'Reload App',
    reloadAppDesc: 'Reload the entire application',
    flipBoard: 'Flip Board',
    flipBoardDesc: 'Rotate the board 180 degrees',
    prevMove: 'Previous Move',
    prevMoveDesc: 'Go to the previous move in review',
    nextMove: 'Next Move',
    nextMoveDesc: 'Go to the next move in review',
    startReview: 'Start of Game',
    startReviewDesc: 'Jump to the initial position',
    endReview: 'End of Game',
    endReviewDesc: 'Jump to the last move',
    offerDraw: 'Offer Draw',
    offerDrawDesc: 'Offer a draw to your opponent',
    resignGame: 'Resign',
    resignGameDesc: 'Resign the current game',
    newGame: 'New Game',
    newGameDesc: 'Start a new game',
    toggleChat: 'Toggle Chat',
    toggleChatDesc: 'Show or hide the chat panel',
    goHome: 'Go to Lobby',
    goHomeDesc: 'Navigate to the lobby page',
    goPlay: 'Go to Play',
    goPlayDesc: 'Navigate to the play page',
    goFriends: 'Go to Friends',
    goFriendsDesc: 'Open the friends panel',
    goSettings: 'Go to Settings',
    goSettingsDesc: 'Open the settings dialog',
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
    prev: 'Zurück',
    next: 'Weiter',
    start: 'Start',
    end: 'Ende',
    undo: 'Rückgängig',
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
    editor: 'Editor',
    play: 'Spielen',
    logout: 'Abmelden',
  },
  friends: {
    title: 'Freunde',
    friends: 'Freunde',
    online: 'Online',
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
    searchPlaceholder: 'Freunde durchsuchen...',
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
    forgotPassword: 'Passwort vergessen?',
  },
  forgotPassword: {
    title: 'Passwort vergessen',
    desc: 'Gib deine E-Mail-Adresse ein und wir senden dir einen Wiederherstellungslink.',
    emailPlaceholder: 'deine@email.com',
    send: 'Wiederherstellungs-E-Mail senden',
    sent: 'Wiederherstellungs-E-Mail gesendet',
    sentDesc: 'Überprüfe dein Postfach für den Wiederherstellungslink.',
    checkEmail: 'Überprüfe deine E-Mails',
    enterEmail: 'Bitte gib deine E-Mail-Adresse ein',
    failed: 'Wiederherstellungs-E-Mail konnte nicht gesendet werden',
    backToLogin: 'Zurück zum Login',
  },
  resetPassword: {
    title: 'Passwort zurücksetzen',
    desc: 'Gib dein neues Passwort ein.',
    newPassword: 'Neues Passwort',
    confirmPassword: 'Neues Passwort bestätigen',
    reset: 'Passwort zurücksetzen',
    done: 'Passwort zurückgesetzt',
    doneDesc: 'Dein Passwort wurde zurückgesetzt. Du kannst dich jetzt mit deinem neuen Passwort anmelden.',
    success: 'Passwort erfolgreich zurückgesetzt',
    failed: 'Passwort zurücksetzen fehlgeschlagen',
    invalidToken: 'Ungültiger oder fehlender Reset-Token',
    invalidLink: 'Ungültiger Reset-Link',
    passwordsDontMatch: 'Passwörter stimmen nicht überein',
    goToLogin: 'Zum Login',
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
    playBot: 'Gegen Bot spielen',
    botDifficulty: 'Schwierigkeit',
    botBeginner: 'Anfänger',
    botIntermediate: 'Mittel',
    botAdvanced: 'Fortgeschritten',
    botExpert: 'Experte',
    botMaster: 'Meister',
    startBot: 'Bot-Spiel starten',
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
    opponentDraw: 'Gegner bietet Unentschieden an',
    accept: 'Annehmen',
    decline: 'Ablehnen',
    menu: '☰ Menü',
    resign: 'Aufgeben',
    areYouSure: 'Bist du sicher?',
    offerDraw: 'Unentschieden anbieten',
    drawOffered: 'Unentschieden angeboten...',
    abortGame: 'Spiel abbrechen',
    leave: 'Verlassen',
    failedLoad: 'Spiel laden fehlgeschlagen',
    moveFailed: 'Zug fehlgeschlagen',
    failedResign: 'Aufgeben fehlgeschlagen',
    challengedYou: 'fordert dich zu einem Spiel heraus!',
    challengeTitle: 'Herausforderung!',
    opponentRematch: 'Gegner möchte Revanche',
    opponentDisconnected: 'Gegner getrennt',
    spectators: 'Zuschauer',
    playAs: 'Spielen als',
  },
  localGame: {
    blackToMove: 'Schwarz ist am Zug',
    whiteToMove: 'Weiß ist am Zug',
    wins: '{color} gewinnt!',
    stalemate: 'Patt — Unentschieden',
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
    draw: 'Unentschieden',
    youWon: 'Gewonnen',
    youLost: 'Verloren',
    byCheckmate: 'durch Schachmatt',
    byResignation: 'durch Aufgabe',
    opponentResigned: 'Gegner gab auf',
    byStalemate: 'durch Patt',
    by50MoveRule: 'durch 50-Züge-Regel',
    byAgreement: 'durch Vereinbarung',
    byEngineError: 'Fehler — Spiel abgebrochen',
    byAdminAction: 'durch Admin beendet',
    review: 'Rückblick',
    rematch: 'Revanche',
    creating: 'Erstelle...',
    failedRematch: 'Revanche fehlgeschlagen',
    failedCopy: 'Kopieren fehlgeschlagen',
  },
  sidebar: {
    chat: 'Chat',
    friends: 'Freunde',
    lobby: 'Lobby',
    privateChat: 'Privater Chat',
    conversations: 'Unterhaltungen',
    startConversation: 'Unterhaltung starten',
    messagePlaceholder: 'Schreibe eine Nachricht...',
    newMessage: 'Neue Nachricht',
    noConversations: 'Keine Unterhaltungen',
    minimize: 'Minimieren',
    expand: 'Erweitern',
  },
  chat: {
    title: 'Chat',
    you: 'Du',
    placeholder: 'Schreibe eine Nachricht...',
    send: 'Senden',
    justNow: 'jetzt',
    challenge: 'Fordern',
    acceptChallenge: 'Annehmen',
    declineChallenge: 'Ablehnen',
    challengeSent: 'Herausforderung gesendet!',
    gameReview: 'Spiel analysieren',
    createGroup: 'Neue Gruppe',
    creatingGroup: 'Erstelle Gruppe...',
    groupNameTooShort: 'Gruppenname muss mindestens 2 Zeichen lang sein',
    groupNamePlaceholder: 'Gruppenname...',
    manageGroup: 'Gruppe verwalten',
    members: 'Mitglieder',
    addMember: 'Mitglied hinzufügen',
    remove: 'Entfernen',
    promote: 'Befördern',
    demote: 'Degradieren',
    transferOwnership: 'Übertragen',
    transferConfirm: 'Gruppenbesitz übertragen?',
    leaveGroup: 'Gruppe verlassen',
    leaveConfirm: 'Diese Gruppe verlassen?',
    disbandGroup: 'Gruppe auflösen',
    disbandConfirm: 'Gruppe auflösen? Dies kann nicht rückgängig gemacht werden.',
    notConnected: 'Nicht mit Server verbunden',
  },
  gameReview: {
    title: 'Spielanalyse',
    moves: 'Züge',
    flipBoard: 'Brett drehen',
    sharePgn: 'PGN teilen',
    pgnCopied: 'PGN kopiert!',
    review: 'Analysieren',
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
    private: 'Privat',
    public: 'Öffentlich',
    joinByCode: 'Per Code beitreten',
    shareCode: 'Code teilen: {code}',
    codeCopied: 'Code kopiert!',
  },
  stats: {
    title: 'Statistik',
    loading: 'Lade...',
    unregistered: 'Statistik ist nur für registrierte Kontos verfügbar.',
    signUpPrompt: 'Melde dich an oder erstelle ein Konto, um deine Statistik zu verfolgen.',
    wins: 'Siege',
    losses: 'Niederlagen',
    draws: 'Unentschieden',
    total: 'Insgesamt: {count} Spiele',
    empty: 'Rangliste ist leer',
  },
  profile: {
    title: 'Profil',
    rating: 'Wertung',
    gamesPlayed: 'Spiele gespielt',
    winRate: 'Gewinnrate',
    addFriend: 'Freund hinzufügen',
    removeFriend: 'Freund entfernen',
    pendingRequest: 'Anfrage ausstehend',
    acceptRequest: 'Freundschaftsanfrage annehmen',
    acceptRequestShort: 'Annehmen',
    declineRequest: 'Ablehnen',
    friend: 'Freunde',
    editProfile: 'Profil bearbeiten',
    matchHistory: 'Spielverlauf',
    noGames: 'Noch keine Spiele gespielt',
    back: 'Zurück',
    viewFullProfile: 'Vollständiges Profil',
  },
  matchHistory: {
    title: 'Spielverlauf',
    loading: 'Lade...',
    noGames: 'Noch keine abgeschlossenen Spiele',
    searchPlayer: 'Spieler suchen...',
    won: 'Gewonnen',
    lost: 'Verloren',
    draw: 'Unentschieden',
    review: 'Rückblick',
    games: 'Spiele',
  },
  moveQuality: {
    excellent: 'Hervorragend',
    good: 'Gut',
    inaccuracy: 'Ungenau',
    bestMove: 'Bester: {move}',
  },
  boardEditor: {
    title: 'Bretteditor',
    placePiece: 'Figur setzen',
    clear: 'Brett leeren',
    startPos: 'Startposition',
    flipBoard: 'Brett drehen',
    exportFen: 'FEN exportieren',
    fenCopied: 'FEN kopiert!',
    importFen: 'FEN importieren',
    fenPlaceholder: 'FEN-String einfügen...',
    invalidFen: 'Ungültiges FEN',
    needBothKings: 'Beide Könige müssen auf dem Brett platziert sein',
    play: 'Von Position spielen',
    piece: 'Figur',
    color: 'Farbe',
  },
  settings: {
    title: 'Einstellungen',
    reset: 'Zurücksetzen',
    searchPlaceholder: 'Einstellungen durchsuchen...',
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
      draws: 'Unentschieden',
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
      sidebarPosition: 'Seitenleistenposition',
      sidebarPositionDesc: 'Auf welcher Seite des Bildschirms die Seitenleiste erscheint',
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
      confirmDraw: 'Unentschieden bestätigen',
      confirmDrawDesc: 'Bestätigung für Unentschieden-Vereinbarung erforderlich',
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
    shortcuts: 'Tastaturkürzel',
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
      spacious: 'Geräumig',
      left: 'Links',
      right: 'Rechts',
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
  shortcuts: {
    intro:
      'Drücke die Tastenkombination, um eine Aktion auszuführen. G+Buchstabe-Sequenzen: G drücken, loslassen, dann den Buchstaben drücken.',
    categoryGeneral: 'Allgemein',
    categoryGame: 'Spiel',
    categoryNavigation: 'Navigation',
    togglePalette: 'Befehlspalette',
    togglePaletteDesc: 'Befehlspalette öffnen',
    toggleSidebar: 'Seitenleiste umschalten',
    toggleSidebarDesc: 'Seitenleiste ein- oder ausblenden',
    toggleSound: 'Ton umschalten',
    toggleSoundDesc: 'Soundeffekte aktivieren oder deaktivieren',
    openSettings: 'Einstellungen öffnen',
    openSettingsDesc: 'Einstellungsdialog öffnen',
    reloadApp: 'App neuladen',
    reloadAppDesc: 'Die gesamte Anwendung neu laden',
    flipBoard: 'Brett drehen',
    flipBoardDesc: 'Das Brett um 180 Grad drehen',
    prevMove: 'Vorheriger Zug',
    prevMoveDesc: 'Zum vorherigen Zug in der Analyse gehen',
    nextMove: 'Nächster Zug',
    nextMoveDesc: 'Zum nächsten Zug in der Analyse gehen',
    startReview: 'Spielanfang',
    startReviewDesc: 'Zur Anfangsposition springen',
    endReview: 'Spielende',
    endReviewDesc: 'Zum letzten Zug springen',
    offerDraw: 'Remis anbieten',
    offerDrawDesc: 'Ein Remis anbieten',
    resignGame: 'Aufgeben',
    resignGameDesc: 'Das aktuelle Spiel aufgeben',
    newGame: 'Neues Spiel',
    newGameDesc: 'Ein neues Spiel beginnen',
    toggleChat: 'Chat umschalten',
    toggleChatDesc: 'Chat ein- oder ausblenden',
    goHome: 'Zur Lobby',
    goHomeDesc: 'Zur Lobby-Seite navigieren',
    goPlay: 'Zum Spielen',
    goPlayDesc: 'Zur Spiel-Seite navigieren',
    goFriends: 'Zu Freunden',
    goFriendsDesc: 'Freunde-Panel öffnen',
    goSettings: 'Zu Einstellungen',
    goSettingsDesc: 'Einstellungsdialog öffnen',
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
