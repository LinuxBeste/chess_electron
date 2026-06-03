import { store } from '../store';
import * as api from '../api';
import { socketManager } from '../socket';
import { navigate } from '../router';
import { el, getPieceSvg, deserializeBoard, squareToIndices, indicesToSquare, cloneBoard, createInitialBoard } from '../chess';
import type { Board, GameState, GameStatus, LegalMoveHint, PieceType, SerializedSquare } from '../../types';
import type { MoveMessage, GameOverMessage, GameStartedMessage } from '../socket';
import { playMoveSound, playCaptureSound, playCheckSound, playGameOverSound } from '../sound';
import { getSetting } from '../settings';

/* All state resets on each mount() → cleanup() cycle */
let game: GameState | null = null;
let playerColor: 'white' | 'black' = 'white';
let isSpectator = false;
let board: Board = [];
let selectedSquare: string | null = null;
let legalHints: LegalMoveHint[] = [];
let lastMove: { from: string; to: string } | null = null;
let dragState: {
  fromSquare: string;
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
} | null = null;
let clockInterval: number | null = null;
let resignConfirmed = false;

/* Review/Replay state */
let reviewIndex: number | null = null;
let reviewControlsEl: HTMLElement | null = null;

let unsubMove: (() => void) | null = null;
let unsubGameOver: (() => void) | null = null;
let unsubGameStarted: (() => void) | null = null;

let boardEl: HTMLElement | null = null;
let moveHistoryEl: HTMLElement | null = null;
let whiteClockEl: HTMLElement | null = null;
let blackClockEl: HTMLElement | null = null;
let whiteNameEl: HTMLElement | null = null;
let blackNameEl: HTMLElement | null = null;
let resignBtn: HTMLElement | null = null;
let wrapperEl: HTMLElement | null = null;
let waitingOverlay: HTMLElement | null = null;
let replayBtn: HTMLElement | null = null;

let whiteTime = 0;
let blackTime = 0;

export const gameView = {
  mount(container: HTMLElement): () => void {
    try {
      return mountGame(container);
    } catch (err: any) {
      store.toast(err?.message || 'Failed to load game view');
      navigate('lobby');
      return () => {};
    }
  },
};

function mountGame(container: HTMLElement): () => void {
    const hash = window.location.hash;
    const hashParts = hash.replace('#game/', '').split('?');
    const gameId = hashParts[0] || '';
    isSpectator = hashParts[1] === 'spectate=1';

    if (!gameId) {
      navigate('lobby');
      return () => {};
    }

    const stored = store.get('currentGame');
    game = stored && stored.id === gameId ? stored : null;
    resignConfirmed = false;

    /* Register WS listeners BEFORE any game init so we don't miss
     * early messages (e.g. game_started when P2 joins immediately). */
    unsubMove = socketManager.onMove((msg) => {
      if (msg.gameId === gameId) handleWsMove(msg);
    });
    unsubGameOver = socketManager.onGameOver((msg) => {
      if (msg.gameId === gameId) handleWsGameOver(msg);
    });
    unsubGameStarted = socketManager.onGameStarted((msg) => {
      if (msg.gameId === gameId) handleWsGameStarted(msg);
    });

    /* Build layout */
    wrapperEl = buildLayout(container, gameId);

    /* Fetch game state if not already loaded */
    if (!game) {
      fetchGame(gameId);
    } else {
      initBoard(game);
    }

    /* If spectating, subscribe to WS updates for this game */
    if (isSpectator) {
      sendSpectateWhenConnected(gameId);
    }

    return () => {
      cleanup();
    };
};

let unsubChat: (() => void) | null = null;

function cleanup(): void {
  if (clockInterval !== null) clearInterval(clockInterval);
  document.removeEventListener('mousemove', handleDocumentMouseMove);
  document.removeEventListener('mouseup', handleDocumentMouseUp);
  if (unsubMove) { unsubMove(); unsubMove = null; }
  if (unsubGameOver) { unsubGameOver(); unsubGameOver = null; }
  if (unsubGameStarted) { unsubGameStarted(); unsubGameStarted = null; }
  if (unsubChat) { unsubChat(); unsubChat = null; }
  if (isSpectator) {
    socketManager.send({ type: 'unspectate' });
  }
  if (wrapperEl) wrapperEl.remove();
  game = null;
  selectedSquare = null;
  legalHints = [];
  dragState = null;
  resignConfirmed = false;
  removeWaitingOverlay();
  boardEl = null;
  moveHistoryEl = null;
  whiteClockEl = null;
  blackClockEl = null;
  whiteNameEl = null;
  blackNameEl = null;
  resignBtn = null;
  wrapperEl = null;
  reviewIndex = null;
  reviewControlsEl = null;
}

function sendSpectateWhenConnected(gameId: string): void {
  const status = store.get('wsStatus');
  if (status === 'connected') {
    socketManager.send({ type: 'spectate', gameId });
    return;
  }
  const unsub = store.subscribe('wsStatus', (newStatus) => {
    if (newStatus === 'connected') {
      socketManager.send({ type: 'spectate', gameId });
      unsub();
    }
  });
}

async function fetchGame(gameId: string): Promise<void> {
  try {
    game = await api.getGame(gameId);
    store.set('currentGame', game);
    initBoard(game);
  } catch (err: any) {
    store.toast(err.message || 'Failed to load game');
    navigate('lobby');
  }
}

function removeWaitingOverlay(): void {
  if (waitingOverlay) {
    waitingOverlay.remove();
    waitingOverlay = null;
  }
}

function initBoard(g: GameState): void {
  game = g;
  playerColor = g.players.white === store.get('playerId') ? 'white' : 'black';
  if (isSpectator) {
    playerColor = 'white';
  }
  const isFinished = g.status === 'resigned' || g.status === 'checkmate' || g.status === 'stalemate' || g.status === 'draw';
  if (isFinished && !window.location.hash.startsWith('#result/')) {
    enterReviewMode();
    return;
  }
  if (isFinished) {
    navigate('result', g.id);
    return;
  }

  board = cloneBoard(g.board);
  lastMove = g.lastMove;
  renderBoard();
  updateBoardDisplay();
  updateMoveHistory(g.moveHistory);
  updatePlayerInfo(g);

  /* Show waiting overlay if game hasn't started yet */
  if (g.status === 'waiting' && boardEl) {
    waitingOverlay = el('div', ['waiting-overlay']);
    const waitingText = el('div', ['waiting-text'], {}, 'Waiting for opponent...');
    waitingOverlay.appendChild(waitingText);

    const idRow = el('div', ['waiting-id-row']);
    const idLabel = el('span', ['waiting-id-label'], {}, 'Game ID:');
    idRow.appendChild(idLabel);
    const idValue = el('span', ['waiting-id-value'], {}, g.id);
    idRow.appendChild(idValue);
    const copyIdBtn = el('button', ['btn', 'btn-secondary', 'btn-xs'], {}, 'Copy');
    copyIdBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(g.id).then(() => {
        copyIdBtn.textContent = 'Copied';
        setTimeout(() => { copyIdBtn.textContent = 'Copy'; }, 2000);
      });
    });
    idRow.appendChild(copyIdBtn);
    waitingOverlay.appendChild(idRow);

    boardEl.appendChild(waitingOverlay);
  }

  startClock();


}

function buildLayout(container: HTMLElement, gameId: string): HTMLElement {
  const wrapper = el('div', ['game-layout']);

  /* Center column: board + player info */
  const centerCol = el('div', ['game-center']);

  /* Black player bar */
  const blackBar = el('div', ['player-bar']);
  blackNameEl = el('span', ['player-name'], {}, 'Black');
  blackClockEl = el('span', ['player-clock'], {}, '0:00');
  blackBar.appendChild(blackNameEl);
  blackBar.appendChild(blackClockEl);
  centerCol.appendChild(blackBar);

  /* Chess board container */
  boardEl = el('div', ['board-container']);
  renderBoard();
  boardEl.addEventListener('click', handleBoardClick);
  boardEl.addEventListener('mousedown', handleBoardMouseDown);
  /* Global mouseup/mousemove for drag */
  document.addEventListener('mousemove', handleDocumentMouseMove);
  document.addEventListener('mouseup', handleDocumentMouseUp);
  centerCol.appendChild(boardEl);

  /* White player bar */
  const whiteBar = el('div', ['player-bar']);
  whiteNameEl = el('span', ['player-name'], {}, 'White');
  whiteClockEl = el('span', ['player-clock'], {}, '0:00');
  whiteBar.appendChild(whiteNameEl);
  whiteBar.appendChild(whiteClockEl);
  centerCol.appendChild(whiteBar);

  /* Resign button */
  const btnRow = el('div', ['game-btn-row']);

  resignBtn = el('button', ['btn', 'btn-danger', 'btn-sm'], {}, 'Resign');
  resignBtn.addEventListener('click', () => handleResign());
  btnRow.appendChild(resignBtn);

  /* Spectator badge and leave button */
  if (isSpectator) {
    const specBadge = el('div', ['badge', 'badge-spectate', 'spectating-badge'], {}, 'Spectating');
    centerCol.insertBefore(specBadge, boardEl);
    resignBtn.textContent = 'Leave';
    resignBtn.className = 'btn btn-secondary btn-sm';
  }

  /* Review controls (hidden by default, shown when game ends) */
  reviewControlsEl = el('div', ['review-controls']);
  const prevBtn = el('button', ['btn', 'btn-ghost', 'btn-sm'], {}, '\u25C0 Prev');
  const nextBtn = el('button', ['btn', 'btn-ghost', 'btn-sm'], {}, 'Next \u25B6');
  const reviewLabel = el('span', ['review-label'], {}, 'Review');

  prevBtn.addEventListener('click', () => reviewStep(-1));
  nextBtn.addEventListener('click', () => reviewStep(1));

  reviewControlsEl.appendChild(prevBtn);
  reviewControlsEl.appendChild(reviewLabel);
  reviewControlsEl.appendChild(nextBtn);
  btnRow.appendChild(reviewControlsEl);

  centerCol.appendChild(btnRow);

  wrapper.appendChild(centerCol);

  /* Right column: move history + chat */
  const rightCol = el('div', ['sidebar']);

  /* Move history */
  const histTitle = el('h3', ['sidebar-title'], {}, 'Moves');
  rightCol.appendChild(histTitle);

  moveHistoryEl = el('div', ['sidebar-panel'], {
    style: 'min-height:150px;max-height:calc(50vh - 100px)',
  });
  rightCol.appendChild(moveHistoryEl);

  /* Chat panel */
  const chatTitle = el('h3', ['sidebar-title'], {
    style: 'margin-top:8px',
  }, 'Chat');
  rightCol.appendChild(chatTitle);

  const chatMsgs = el('div', ['sidebar-panel'], {
    style: 'min-height:80px;max-height:150px;font-size:12px;padding:8px',
  });

  const chatInputRow = el('div', ['chat-input-row']);
  const chatInput = el('input', ['input'], {
    type: 'text',
    placeholder: 'Type a message...',
    style: 'flex:1;font-size:12px',
  }) as HTMLInputElement;

  const chatSendBtn = el('button', ['btn', 'btn-primary'], {
    style: 'padding:8px 12px;font-size:12px',
  }, 'Send');

  chatInputRow.appendChild(chatInput);
  chatInputRow.appendChild(chatSendBtn);
  rightCol.appendChild(chatMsgs);
  rightCol.appendChild(chatInputRow);

  /* Chat send handler */
  function sendChat(): void {
    const text = chatInput.value.trim();
    if (!text) return;
    socketManager.send({ type: 'chat_message', gameId, text });
    chatInput.value = '';
  }
  chatSendBtn.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') sendChat();
  });

  /* Listen for chat messages on WS */
  unsubChat = socketManager.onChat((msg) => {
    if (msg.gameId !== gameId) return;
    const isMe = msg.playerId === store.get('playerId');
    const msgEl = el('div', ['chat-msg', isMe ? 'chat-msg-self' : '']);
    const nameEl = el('span', ['chat-name'], {
      style: `color:${isMe ? '#4f8ef7' : '#888'}`,
    }, isMe ? 'You' : msg.username);
    const textEl = el('span', ['chat-text'], {}, msg.text);
    msgEl.appendChild(nameEl);
    msgEl.appendChild(textEl);
    chatMsgs.appendChild(msgEl);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  });

  wrapper.appendChild(rightCol);

  container.appendChild(wrapper);
  return wrapper;
}

/** Build the 8x8 DOM grid. 64 absolutely-positioned divs with inline SVGs and labels. */
function renderBoard(): void {
  if (!boardEl) return;
  boardEl.innerHTML = '';

  const size = boardEl.clientWidth || 480;
  const sqSize = size / 8;

  /* Flip board so player's home rank is at the bottom */
  const alwaysBottom = getSetting('alwaysWhiteBottom');
  const isWhiteBottom = alwaysBottom ? true : (playerColor === 'white');

  for (let displayRank = 0; displayRank < 8; displayRank++) {
    const boardRank = isWhiteBottom ? displayRank : 7 - displayRank;

    for (let displayFile = 0; displayFile < 8; displayFile++) {
      const boardFile = isWhiteBottom ? displayFile : 7 - displayFile;

      const isLight = (displayRank + displayFile) % 2 === 0;
      const sq = el('div', ['square', isLight ? 'sq-light' : 'sq-dark'], {
        'data-rank': boardRank.toString(),
        'data-file': boardFile.toString(),
        'data-square': indicesToSquare(boardRank, boardFile),
        style: `position:absolute;top:${displayRank * sqSize}px;left:${displayFile * sqSize}px;width:${sqSize}px;height:${sqSize}px`,
      });

      /* File labels a-h along bottom edge, rank labels 8-1 along left edge */
      if (displayRank === 7) {
        const label = el('span', ['sq-label', 'sq-label-file'], {}, String.fromCharCode(97 + displayFile));
        sq.appendChild(label);
      }
      if (displayFile === 0) {
        const label = el('span', ['sq-label', 'sq-label-rank'], {}, (8 - displayRank).toString());
        sq.appendChild(label);
      }

      /* Render piece if present */
      const piece = board[boardRank]?.[boardFile];
      if (piece) {
        sq.innerHTML += getPieceSvg(piece.type, piece.color);
      }

      boardEl.appendChild(sq);
    }
  }

  /* Apply highlights */
  applyHighlights();
}

/**
 * Apply visual highlights to the board without rebuilding all squares.
 * Called after every state change (selection, move, WS update).
 */
function applyHighlights(): void {
  if (!boardEl) return;
  const squares = boardEl.querySelectorAll<HTMLElement>('.square');

  /* Reset all squares */
  squares.forEach(sq => {
    sq.classList.remove('hl-last-from', 'hl-last-to', 'hl-selected');
    sq.style.boxShadow = 'none';
    const file = parseInt(sq.getAttribute('data-file') || '0', 10);
    const rank = parseInt(sq.getAttribute('data-rank') || '0', 10);
    const alwaysBottom = getSetting('alwaysWhiteBottom');
    const isWhiteBottom = alwaysBottom ? true : (playerColor === 'white');
    const displayRank = isWhiteBottom ? rank : 7 - rank;
    const displayFile = isWhiteBottom ? file : 7 - file;
    const isLight = (displayRank + displayFile) % 2 === 0;
    sq.classList.toggle('sq-light', isLight);
    sq.classList.toggle('sq-dark', !isLight);
  });

  /* Last move highlight — subtle warm tint */
  if (lastMove) {
    const fromSq = boardEl.querySelector(`[data-square="${lastMove.from}"]`) as HTMLElement;
    const toSq = boardEl.querySelector(`[data-square="${lastMove.to}"]`) as HTMLElement;
    if (fromSq) fromSq.classList.add('hl-last-from');
    if (toSq) toSq.classList.add('hl-last-to');
  }

  /* Selected square — soft blue overlay */
  if (selectedSquare) {
    const selSq = boardEl.querySelector(`[data-square="${selectedSquare}"]`) as HTMLElement;
    if (selSq) selSq.classList.add('hl-selected');
  }

  /* Remove stale hints first */
  boardEl.querySelectorAll('.legal-dot, .legal-capture').forEach(d => d.remove());

  /* Legal move hints */
  const playerId = store.get('playerId');
  for (const hint of legalHints) {
    const hintSq = boardEl.querySelector(`[data-square="${hint.to}"]`) as HTMLElement;
    if (!hintSq) continue;
    const [r, f] = squareToIndices(hint.to);
    const hasPiece = board[r] && board[r][f] !== null;
    const dot = el('div', hasPiece ? ['legal-capture'] : ['legal-dot']);
    hintSq.appendChild(dot);
  }

  /* Note: check glow removed because the server doesn't expose an "in check" flag.
     The GameState only has status fields (checkmate/stalemate), not a live check status. */
}

/* Click dispatch: select piece → show hints → click target → (promotion?) → move */
function handleBoardClick(e: MouseEvent): void {
  if (dragState) return;

  const target = e.target as HTMLElement;
  const sq = target.closest('.square') as HTMLElement;
  if (!sq || !game || game.turn !== playerColor || game.status !== 'active') return;

  const clickedSquare = sq.getAttribute('data-square') || '';
  const [r, f] = squareToIndices(clickedSquare);
  const clickedPiece = board[r]?.[f];

  if (clickedSquare === selectedSquare) {
    clearSelection();
    return;
  }

  if (selectedSquare && legalHints.some(h => h.from === selectedSquare && h.to === clickedSquare)) {
    const promo = checkPromotion(selectedSquare, clickedSquare);
    if (promo) {
      showPromotionDialog(selectedSquare, clickedSquare);
    } else {
      executeMove(selectedSquare, clickedSquare);
    }
    return;
  }

  /* Clicking on one of our own pieces → select it */
  if (clickedPiece && clickedPiece.color === playerColor) {
    selectSquare(clickedSquare);
    return;
  }

  /* Clicking elsewhere → deselect */
  clearSelection();
}

function selectSquare(square: string): void {
  selectedSquare = square;
  if (!getSetting('showLegalHints') || !game) {
    legalHints = [];
    applyHighlights();
    return;
  }
  api.getLegalMoves(game.id).then(({ moves }) => {
    legalHints = moves.filter(m => m.from === square);
    applyHighlights();
  }).catch(() => {});
}

function clearSelection(): void {
  selectedSquare = null;
  legalHints = [];
  applyHighlights();
}

/* ─── Drag and Drop ─── */
/* Coordinate math: mouse position mapped to board grid, flipped for black orientation */

function handleBoardMouseDown(e: MouseEvent): void {
  if (!game || game.turn !== playerColor || game.status !== 'active') return;

  const target = e.target as HTMLElement;
  const sq = target.closest('.square') as HTMLElement;
  if (!sq) return;

  const fromSquare = sq.getAttribute('data-square') || '';
  const [r, f] = squareToIndices(fromSquare);
  const piece = board[r]?.[f];

  if (!piece || piece.color !== playerColor) return;

  /* Create floating ghost */
  const ghost = el('div', [], {
    style: 'position:fixed;pointer-events:none;z-index:9999;width:60px;height:60px;transform:scale(1.08);filter:drop-shadow(0 4px 8px rgba(0,0,0,0.5));transition:none',
  });
  ghost.innerHTML = getPieceSvg(piece.type, piece.color);
  document.body.appendChild(ghost);

  const rect = sq.getBoundingClientRect();
  dragState = {
    fromSquare,
    ghost,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
  };

  /* Dim the original square */
  sq.style.opacity = '0.3';

  /* Select the source square visually */
  selectedSquare = fromSquare;
  if (game) {
    api.getLegalMoves(game.id).then(({ moves }) => {
      legalHints = moves.filter(m => m.from === fromSquare);
      applyHighlights();
    }).catch(() => {});
  }

  positionGhost(e.clientX, e.clientY);
}

function positionGhost(cx: number, cy: number): void {
  if (!dragState) return;
  dragState.ghost.style.left = `${cx - dragState.offsetX}px`;
  dragState.ghost.style.top = `${cy - dragState.offsetY}px`;
}

function handleDocumentMouseMove(e: MouseEvent): void {
  if (!dragState) return;
  e.preventDefault();
  positionGhost(e.clientX, e.clientY);

  /* Highlight the hovered square */
  if (!boardEl) return;
  const rect = boardEl.getBoundingClientRect();
  const sqSize = rect.width / 8;
  const relX = e.clientX - rect.left;
  const relY = e.clientY - rect.top;
  const hoverFile = Math.floor(relX / sqSize);
  const hoverRank = Math.floor(relY / sqSize);

  if (hoverFile >= 0 && hoverFile < 8 && hoverRank >= 0 && hoverRank < 8) {
    const isWhiteBottom = playerColor === 'white';
    const boardFile = isWhiteBottom ? hoverFile : 7 - hoverFile;
    const boardRank = isWhiteBottom ? hoverRank : 7 - hoverRank;
    const hoverSq = boardEl.querySelector(`[data-rank="${boardRank}"][data-file="${boardFile}"]`) as HTMLElement;
    if (hoverSq) {
      const isLegal = legalHints.some(h => h.to === indicesToSquare(boardRank, boardFile));
      boardEl.querySelectorAll('.square').forEach(s => s.classList.remove('hl-hover'));
      if (isLegal) {
        hoverSq.classList.add('hl-hover');
      }
    }
  }
}

function handleDocumentMouseUp(e: MouseEvent): void {
  if (!dragState) return;

  /* Clean up drag state */
  const fromSquare = dragState.fromSquare;
  dragState.ghost.remove();

  /* Restore original square opacity */
    if (boardEl) {
      const origSq = boardEl.querySelector(`[data-square="${fromSquare}"]`) as HTMLElement;
      if (origSq) origSq.style.opacity = '1';
      boardEl.querySelectorAll('.square').forEach(s => s.classList.remove('hl-hover'));
  }

  dragState = null;

  /* Determine target square */
  if (!boardEl || !game) {
    clearSelection();
    return;
  }
  const rect = boardEl.getBoundingClientRect();
  const sqSize = rect.width / 8;
  const relX = e.clientX - rect.left;
  const relY = e.clientY - rect.top;
  const toFile = Math.floor(relX / sqSize);
  const toRank = Math.floor(relY / sqSize);

  if (toFile < 0 || toFile >= 8 || toRank < 0 || toRank >= 8) {
    clearSelection();
    return;
  }

  const isWhiteBottom = playerColor === 'white';
  const boardFile = isWhiteBottom ? toFile : 7 - toFile;
  const boardRank = isWhiteBottom ? toRank : 7 - toRank;
  const toSquare = indicesToSquare(boardRank, boardFile);

  const isLegal = legalHints.some(h => h.from === fromSquare && h.to === toSquare);
  if (isLegal) {
    const promo = checkPromotion(fromSquare, toSquare);
    if (promo) {
      showPromotionDialog(fromSquare, toSquare);
    } else {
      executeMove(fromSquare, toSquare);
    }
  } else {
    clearSelection();
  }
}

/**
 * Check if a move from `from` to `to` is a pawn promotion.
 * A pawn promotes when it reaches the last rank: rank 0 (8th rank) for white,
 * rank 7 (1st rank) for black.
 */
function checkPromotion(from: string, to: string): boolean {
  const [fr, ff] = squareToIndices(from);
  const [tr] = squareToIndices(to);
  const piece = board[fr]?.[ff];
  return !!piece && piece.type === 'pawn' && (tr === 0 || tr === 7);
}

let pendingPromotion: { from: string; to: string } | null = null;

function showPromotionDialog(from: string, to: string): void {
  pendingPromotion = { from, to };
  const overlay = el('div', ['modal-overlay']);
  const card = el('div', ['modal-card'], { style: 'padding:24px' });
  const title = el('div', ['promo-title'], {}, 'Choose promotion piece');
  card.appendChild(title);
  const pieceRow = el('div', ['promo-row']);
  for (const pt of ['queen', 'rook', 'bishop', 'knight'] as PieceType[]) {
    const btn = el('div', ['promo-piece']);
    btn.innerHTML = getPieceSvg(pt, playerColor);
    btn.addEventListener('click', () => {
      overlay.remove();
      if (pendingPromotion) {
        executeMove(pendingPromotion.from, pendingPromotion.to, pt);
        pendingPromotion = null;
      }
    });
    pieceRow.appendChild(btn);
  }
  card.appendChild(pieceRow);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

/* Move locally first for feel, reconcile via WS broadcast.
   On API rejection, revert to last known good state. */
async function executeMove(from: string, to: string, promotion?: PieceType): Promise<void> {
  if (!game) return;
  clearSelection();

  const oldBoard = cloneBoard(board);
  const [fromR, fromF] = squareToIndices(from);
  const [toR, toF] = squareToIndices(to);
  const piece = board[fromR][fromF];
  if (piece) {
    board[toR][toF] = piece;
    board[fromR][fromF] = null;
    lastMove = { from, to };
  }

  updateBoardDisplay();

  try {
    const updated = await api.makeMove(game.id, from, to, promotion);
    game = updated;
    store.set('currentGame', updated);
    board = cloneBoard(updated.board);
    lastMove = updated.lastMove;
    updateBoardDisplay();
    updateMoveHistory(updated.moveHistory);
    updatePlayerInfo(updated);

    if (getSetting('soundEnabled')) {
      if (oldBoard[toR]?.[toF]) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
    }

    /* Check for game over */
    if (updated.status === 'checkmate' || updated.status === 'stalemate' || updated.status === 'resigned' || updated.status === 'draw') {
      if (getSetting('soundEnabled')) playGameOverSound();
      navigate('result', updated.id);
    }
  } catch (err: any) {
    /* Revert optimistic update */
    board = oldBoard;
    lastMove = game?.lastMove || null;
    updateBoardDisplay();
    store.toast(err.message || 'Move failed');
  }
}

function updateBoardDisplay(): void {
  if (!boardEl) return;
  const squares = boardEl.querySelectorAll<HTMLElement>('.square');

  squares.forEach(sq => {
    const rank = parseInt(sq.getAttribute('data-rank') || '0', 10);
    const file = parseInt(sq.getAttribute('data-file') || '0', 10);
    const piece = board[rank]?.[file];

    /* Clear existing piece content (keep labels) */
    const existingPiece = sq.querySelector('.piece-char');
    if (existingPiece) existingPiece.remove();
    const dots = sq.querySelectorAll(':scope > div');
    dots.forEach(d => d.remove());

    if (piece) {
      sq.innerHTML += getPieceSvg(piece.type, piece.color);
    }
  });

  applyHighlights();
}

/* ─── WebSocket Handlers ─── */

function handleWsMove(msg: MoveMessage): void {
  if (!game) return;
  const [toR, toF] = squareToIndices(msg.lastMove.to);
  const wasCapture = board[toR]?.[toF] !== null;
  board = deserializeBoard(msg.board);
  lastMove = msg.lastMove;
  if (game) game.turn = msg.turn;
  updateBoardDisplay();

  if (getSetting('soundEnabled') && playerColor !== msg.turn) {
    if (wasCapture) {
      playCaptureSound();
    } else {
      playMoveSound();
    }
    if (msg.status === 'check') {
      setTimeout(() => playCheckSound(), 100);
    }
  }

  /* Animate opponent's move if we have one — slide the piece */
  if (msg.lastMove && playerColor !== msg.turn) {
    animateOpponentMove(msg.lastMove.from, msg.lastMove.to);
  }
}

/**
 * Animate opponent's move: briefly slide the piece from origin to destination.
 * The piece is already rendered at the destination after deserializeBoard,
 * so we overlay a temporary piece at the origin and animate it to the destination.
 */
function animateOpponentMove(from: string, to: string): void {
  if (!boardEl) return;
  const fromSq = boardEl.querySelector(`[data-square="${from}"]`) as HTMLElement;
  const toSq = boardEl.querySelector(`[data-square="${to}"]`) as HTMLElement;
  if (!fromSq || !toSq) return;

  const rect = boardEl.getBoundingClientRect();
  const sqSize = rect.width / 8;

  const fromRect = fromSq.getBoundingClientRect();
  const toRect = toSq.getBoundingClientRect();

  const animPiece = el('div', [], {
    style: `position:absolute;z-index:10;width:${sqSize}px;height:${sqSize}px;top:${fromRect.top - rect.top}px;left:${fromRect.left - rect.left}px;transition:all 220ms cubic-bezier(0.25,0.46,0.45,0.94);pointer-events:none`,
  });
  /* Copy the piece from the destination square */
  const destPiece = toSq.querySelector('.piece-char');
  if (destPiece) animPiece.innerHTML = (destPiece as HTMLElement).outerHTML;
  boardEl.appendChild(animPiece);

  /* Trigger animation on next frame */
  requestAnimationFrame(() => {
    animPiece.style.top = `${toRect.top - rect.top}px`;
    animPiece.style.left = `${toRect.left - rect.left}px`;
  });

  /* Remove after animation completes */
  setTimeout(() => animPiece.remove(), 300);
}

function handleWsGameOver(msg: GameOverMessage): void {
  if (!game) return;
  board = deserializeBoard(msg.board);
  lastMove = msg.lastMove;
  updateBoardDisplay();
  game.status = msg.status as GameStatus;
  if (msg.winner) game.winner = msg.winner;
  store.set('currentGame', game);
  if (getSetting('soundEnabled')) playGameOverSound();
  setTimeout(() => navigate('result', msg.gameId), 500);
}

/* When P2 joins, P1 gets this WS message so they know the game is active */
function handleWsGameStarted(msg: GameStartedMessage): void {
  game = msg.game;
  store.set('currentGame', msg.game);
  board = cloneBoard(msg.game.board);
  lastMove = msg.game.lastMove;
  removeWaitingOverlay();
  updateBoardDisplay();
  updateMoveHistory(msg.game.moveHistory);
  updatePlayerInfo(msg.game);
  startClock();

}

/* ─── Move History ─── */

function updateMoveHistory(moves: string[]): void {
  if (!moveHistoryEl) return;
  moveHistoryEl.innerHTML = '';

  if (moves.length === 0) {
    moveHistoryEl.appendChild(el('div', ['empty-state'], {}, 'No moves yet'));
    return;
  }

  const table = el('div', ['history-grid']);

  const headerNum = el('div', ['history-header'], {}, '#');
  const headerW = el('div', ['history-header'], {}, 'White');
  const headerB = el('div', ['history-header'], {}, 'Black');
  table.appendChild(headerNum);
  table.appendChild(headerW);
  table.appendChild(headerB);

  for (let i = 0; i < moves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const isLastWhite = i >= moves.length - 1;
    const isLastBlack = i + 1 >= moves.length - 1;

    const numEl = el('div', ['history-num'], {}, `${moveNum}.`);

    const wMove = moves[i];
    const wEl = el('div', ['history-move', isLastWhite ? 'history-latest' : ''], {}, wMove);
    table.appendChild(numEl);
    table.appendChild(wEl);

    const bMove = moves[i + 1];
    if (bMove) {
      const bEl = el('div', ['history-move', isLastBlack ? 'history-latest' : ''], {}, bMove);
      table.appendChild(bEl);
    }
  }

  moveHistoryEl.appendChild(table);

  /* Auto-scroll to latest move */
  moveHistoryEl.scrollTop = moveHistoryEl.scrollHeight;
}

/* ─── Player Info ─── */

function updatePlayerInfo(g: GameState): void {
  if (!whiteNameEl || !blackNameEl) return;
  const myId = store.get('playerId');
  const isWhite = g.players.white === myId;
  const opponentId = isWhite ? g.players.black : g.players.white;

  whiteNameEl.textContent = g.players.white === myId ? 'You (White)' : (opponentId === g.players.white ? 'Opponent' : 'White');
  blackNameEl.textContent = g.players.black === myId ? 'You (Black)' : (opponentId === g.players.black ? 'Opponent' : 'Black');
}

/* ─── Clocks ─── */

function startClock(): void {
  if (clockInterval !== null) clearInterval(clockInterval);
  clockInterval = window.setInterval(() => {
    if (!game) return;
    if (game.turn === 'white') whiteTime++;
    else blackTime++;
    updateClocks();
  }, 1000);
}

function updateClocks(): void {
  if (!whiteClockEl || !blackClockEl) return;
  whiteClockEl.textContent = formatTime(whiteTime);
  blackClockEl.textContent = formatTime(blackTime);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ─── Review / Replay ─── */

function enterReviewMode(): void {
  reviewIndex = game && game.boardHistory.length > 0 ? game.boardHistory.length - 1 : null;
  if (reviewControlsEl) reviewControlsEl.classList.add('active');
  if (resignBtn) resignBtn.style.display = 'none';
  updateReviewLabel();
  applyReviewBoard();
}

function reviewStep(direction: number): void {
  if (reviewIndex === null || !game) return;
  const newIndex = reviewIndex + direction;
  if (newIndex < -1 || newIndex >= game.boardHistory.length) return;
  reviewIndex = newIndex;
  updateReviewLabel();
  applyReviewBoard();
}

function updateReviewLabel(): void {
  const label = reviewControlsEl?.querySelector('span');
  if (!label || !game) return;
  if (reviewIndex === -1) {
    label.textContent = 'Start';
  } else if (reviewIndex !== null && game.boardHistory[reviewIndex]) {
    label.textContent = `${reviewIndex + 1}/${game.boardHistory.length}`;
  } else {
    label.textContent = 'End';
  }
}

function applyReviewBoard(): void {
  if (!game || reviewIndex === null) return;
  if (reviewIndex === -1) {
    board = createInitialBoard();
    lastMove = null;
  } else {
    const snapshot = game.boardHistory[reviewIndex];
    board = deserializeBoard(snapshot.board);
    const prevBoard = reviewIndex > 0 ? game.boardHistory[reviewIndex - 1].board : null;
    lastMove = prevBoard ? extractLastMove(prevBoard, snapshot.board) : null;
  }
  updateBoardDisplay();
}

function extractLastMove(prevBoard: SerializedSquare[], curBoard: SerializedSquare[]): { from: string; to: string } | null {
  const prevMap = new Map(prevBoard.map(sq => [sq.square, sq]));
  const curMap = new Map(curBoard.map(sq => [sq.square, sq]));
  let from: string | null = null;
  let to: string | null = null;
  for (const sq of prevBoard) {
    if (!curMap.has(sq.square)) from = sq.square;
  }
  for (const sq of curBoard) {
    if (!prevMap.has(sq.square)) to = sq.square;
  }
  if (from && to) return { from, to };
  return null;
}

/* ─── Resign ─── */

function handleResign(): void {
  if (isSpectator) {
    socketManager.send({ type: 'unspectate' });
    store.set('currentGame', null);
    navigate('lobby');
    return;
  }

  if (getSetting('confirmResign') && !resignConfirmed) {
    resignConfirmed = true;
    if (resignBtn) resignBtn.textContent = 'Are you sure?';
    setTimeout(() => {
      resignConfirmed = false;
      if (resignBtn) resignBtn.textContent = 'Resign';
    }, 4000);
    return;
  }

  if (!game) return;
  api.resignGame(game.id).then((updated) => {
    store.set('currentGame', updated);
    navigate('result', updated.id);
  }).catch((err: any) => {
    store.toast(err.message || 'Failed to resign');
  });
  resignConfirmed = false;
}

/* Inject check glow keyframes */
const gameStyle = document.createElement('style');
gameStyle.textContent = `@keyframes checkGlow { 0%,100% { box-shadow:inset 0 0 20px rgba(220,50,50,0.6) } 50% { box-shadow:inset 0 0 30px rgba(220,50,50,0.9) } }`;
document.head.appendChild(gameStyle);
