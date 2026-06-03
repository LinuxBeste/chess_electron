import { store } from '../store';
import * as api from '../api';
import { socketManager } from '../socket';
import { navigate } from '../router';
import { el, getPieceSvg, deserializeBoard, squareToIndices, indicesToSquare, cloneBoard, createInitialBoard } from '../chess';
import type { Board, GameState, LegalMoveHint, PieceType, SerializedSquare } from '../../types';
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

    /* Build layout */
    wrapperEl = buildLayout(container, gameId);

    /* Fetch game state if not already loaded */
    if (!game) {
      fetchGame(gameId);
    } else {
      initBoard(game);
    }

    /* WS listeners */
    unsubMove = socketManager.onMove((msg) => {
      if (msg.gameId === gameId) handleWsMove(msg);
    });
    unsubGameOver = socketManager.onGameOver((msg) => {
      if (msg.gameId === gameId) handleWsGameOver(msg);
    });
    unsubGameStarted = socketManager.onGameStarted((msg) => {
      if (msg.gameId === gameId) handleWsGameStarted(msg);
    });

    /* If spectating, subscribe to WS updates for this game */
    if (isSpectator) {
      socketManager.send({ type: 'spectate', gameId });
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
  if (unsubMove) unsubMove();
  if (unsubGameOver) unsubGameOver();
  if (unsubGameStarted) unsubGameStarted();
  if (unsubChat) unsubChat();
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
    waitingOverlay = el('div', [], {
      style: 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border-radius:8px;z-index:5',
    });
    const waitingText = el('div', [], {
      style: 'font-size:18px;font-weight:500;color:#e0e0e0;letter-spacing:0.3px',
    }, 'Waiting for opponent...');
    waitingOverlay.appendChild(waitingText);

    const idRow = el('div', [], {
      style: 'display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.3);padding:8px 14px;border-radius:8px',
    });
    const idLabel = el('span', [], {
      style: 'font-size:12px;font-weight:400;color:#888;letter-spacing:0.2px',
    }, 'Game ID:');
    idRow.appendChild(idLabel);
    const idValue = el('span', [], {
      style: 'font-size:13px;font-weight:500;color:#e0e0e0;letter-spacing:0.3px;font-family:monospace',
    }, g.id);
    idRow.appendChild(idValue);
    const copyIdBtn = el('button', [], {
      style: 'padding:4px 10px;font-size:11px;font-weight:500;color:#4f8ef7;background:transparent;border:1px solid #4f8ef7;border-radius:4px;cursor:pointer;letter-spacing:0.2px;transition:background 150ms ease,color 150ms ease',
    }, 'Copy');
    copyIdBtn.addEventListener('mouseenter', () => { copyIdBtn.style.background = '#4f8ef7'; copyIdBtn.style.color = '#fff'; });
    copyIdBtn.addEventListener('mouseleave', () => { copyIdBtn.style.background = 'transparent'; copyIdBtn.style.color = '#4f8ef7'; });
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
  const wrapper = el('div', [], {
    style: 'display:flex;align-items:center;justify-content:center;height:100%;padding:24px;gap:24px',
  });

  /* Center column: board + player info */
  const centerCol = el('div', [], {
    style: 'display:flex;flex-direction:column;align-items:center;gap:12px',
  });

  /* Black player bar */
  const blackBar = el('div', [], {
    style: 'display:flex;align-items:center;justify-content:space-between;width:100%;max-width:480px;padding:10px 16px;background:#1a1a1f;border-radius:8px;border:1px solid rgba(255,255,255,0.06)',
  });
  blackNameEl = el('span', [], { style: 'font-size:14px;font-weight:500;color:#e0e0e0;letter-spacing:0.2px' }, 'Black');
  blackClockEl = el('span', [], { style: 'font-size:14px;font-weight:300;color:#888;font-variant-numeric:tabular-nums' }, '0:00');
  blackBar.appendChild(blackNameEl);
  blackBar.appendChild(blackClockEl);
  centerCol.appendChild(blackBar);

  /* Spectator badge */
  if (isSpectator) {
    const specBadge = el('div', [], {
      style: 'font-size:12px;font-weight:600;color:#22c55e;background:rgba(34,197,94,0.1);padding:4px 12px;border-radius:6px;letter-spacing:0.5px;text-transform:uppercase',
    }, 'Spectating');
    centerCol.appendChild(specBadge);
    /* Hide resign button for spectators */
    if (resignBtn) resignBtn.style.display = 'none';
  }

  /* Chess board container */
  boardEl = el('div', ['chess-board'], {
    style: 'position:relative;width:min(60vh,480px);height:min(60vh,480px);border-radius:8px;box-shadow:inset 0 2px 8px rgba(0,0,0,0.3),0 4px 24px rgba(0,0,0,0.4);overflow:hidden;user-select:none',
  });
  renderBoard();
  boardEl.addEventListener('click', handleBoardClick);
  boardEl.addEventListener('mousedown', handleBoardMouseDown);
  /* Global mouseup/mousemove for drag */
  document.addEventListener('mousemove', handleDocumentMouseMove);
  document.addEventListener('mouseup', handleDocumentMouseUp);
  centerCol.appendChild(boardEl);

  /* White player bar */
  const whiteBar = el('div', [], {
    style: 'display:flex;align-items:center;justify-content:space-between;width:100%;max-width:480px;padding:10px 16px;background:#1a1a1f;border-radius:8px;border:1px solid rgba(255,255,255,0.06)',
  });
  whiteNameEl = el('span', [], { style: 'font-size:14px;font-weight:500;color:#e0e0e0;letter-spacing:0.2px' }, 'White');
  whiteClockEl = el('span', [], { style: 'font-size:14px;font-weight:300;color:#888;font-variant-numeric:tabular-nums' }, '0:00');
  whiteBar.appendChild(whiteNameEl);
  whiteBar.appendChild(whiteClockEl);
  centerCol.appendChild(whiteBar);

  /* Resign button */
  const btnRow = el('div', [], {
    style: 'display:flex;gap:8px;align-items:center',
  });

  resignBtn = el('button', [], {
    style: 'background:transparent;border:none;color:rgba(220,80,80,0.7);font-size:13px;font-weight:500;cursor:pointer;padding:4px 8px;transition:color 150ms ease;letter-spacing:0.3px',
  }, 'Resign');
  resignBtn.addEventListener('mouseenter', () => { if (resignBtn) resignBtn.style.color = 'rgba(220,80,80,1)'; });
  resignBtn.addEventListener('mouseleave', () => { if (resignBtn) resignBtn.style.color = 'rgba(220,80,80,0.7)'; });
  resignBtn.addEventListener('click', () => handleResign());
  btnRow.appendChild(resignBtn);

  /* Review controls (hidden by default, shown when game ends) */
  reviewControlsEl = el('div', [], {
    style: 'display:none;gap:8px;align-items:center;margin-left:auto',
  });
  const prevBtn = el('button', [], {
    style: 'padding:6px 12px;background:#222228;color:#e0e0e0;border:1px solid rgba(255,255,255,0.1);border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:background 150ms ease',
  }, '\u25C0 Prev');
  const nextBtn = el('button', [], {
    style: 'padding:6px 12px;background:#222228;color:#e0e0e0;border:1px solid rgba(255,255,255,0.1);border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:background 150ms ease',
  }, 'Next \u25B6');
  const reviewLabel = el('span', [], {
    style: 'font-size:12px;font-weight:500;color:#888;letter-spacing:0.3px;min-width:60px;text-align:center',
  }, 'Review');

  prevBtn.addEventListener('mouseenter', () => { prevBtn.style.background = '#2c2c38'; });
  prevBtn.addEventListener('mouseleave', () => { prevBtn.style.background = '#222228'; });
  nextBtn.addEventListener('mouseenter', () => { nextBtn.style.background = '#2c2c38'; });
  nextBtn.addEventListener('mouseleave', () => { nextBtn.style.background = '#222228'; });

  prevBtn.addEventListener('click', () => reviewStep(-1));
  nextBtn.addEventListener('click', () => reviewStep(1));

  reviewControlsEl.appendChild(prevBtn);
  reviewControlsEl.appendChild(reviewLabel);
  reviewControlsEl.appendChild(nextBtn);
  btnRow.appendChild(reviewControlsEl);

  centerCol.appendChild(btnRow);

  wrapper.appendChild(centerCol);

  /* Right column: move history + chat */
  const rightCol = el('div', [], {
    style: 'width:220px;flex-shrink:0;display:flex;flex-direction:column;gap:12px',
  });

  /* Move history */
  const histTitle = el('h3', [], {
    style: 'font-size:14px;font-weight:700;color:#888;margin-bottom:12px;letter-spacing:0.5px;text-transform:uppercase',
  }, 'Moves');
  rightCol.appendChild(histTitle);

  moveHistoryEl = el('div', [], {
    style: 'flex:1;overflow-y:auto;background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);padding:12px;min-height:150px;max-height:calc(50vh - 100px)',
  });
  rightCol.appendChild(moveHistoryEl);

  /* Chat panel */
  const chatTitle = el('h3', [], {
    style: 'font-size:14px;font-weight:700;color:#888;margin-top:8px;margin-bottom:8px;letter-spacing:0.5px;text-transform:uppercase',
  }, 'Chat');
  rightCol.appendChild(chatTitle);

  const chatMsgs = el('div', [], {
    style: 'flex:1;overflow-y:auto;background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);padding:8px;min-height:80px;max-height:150px;font-size:12px',
  });

  const chatInputRow = el('div', [], {
    style: 'display:flex;gap:6px;margin-top:6px',
  });
  const chatInput = el('input', [], {
    type: 'text',
    placeholder: 'Type a message...',
    style: 'flex:1;padding:8px 10px;background:#222228;border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e0e0e0;font-size:12px;outline:none;box-sizing:border-box;transition:border-color 150ms ease',
  }) as HTMLInputElement;
  chatInput.addEventListener('focus', () => { chatInput.style.borderColor = '#4f8ef7'; });
  chatInput.addEventListener('blur', () => { chatInput.style.borderColor = 'rgba(255,255,255,0.1)'; });

  const chatSendBtn = el('button', [], {
    style: 'padding:8px 12px;background:#4f8ef7;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:background 150ms ease',
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
    const msgEl = el('div', [], {
      style: `padding:4px 6px;margin-bottom:4px;border-radius:4px;background:${isMe ? 'rgba(79,142,247,0.08)' : 'transparent'}`,
    });
    const nameEl = el('span', [], {
      style: `font-weight:600;color:${isMe ? '#4f8ef7' : '#888'};margin-right:6px`,
    }, isMe ? 'You' : msg.username);
    const textEl = el('span', [], {
      style: 'color:#e0e0e0',
    }, msg.text);
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
      const sq = el('div', ['square'], {
        'data-rank': boardRank.toString(),
        'data-file': boardFile.toString(),
        'data-square': indicesToSquare(boardRank, boardFile),
        style: `position:absolute;top:${displayRank * sqSize}px;left:${displayFile * sqSize}px;width:${sqSize}px;height:${sqSize}px;background:${isLight ? 'var(--sq-light, #3d3d52)' : 'var(--sq-dark, #2c2c38)'};display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 150ms ease`,
      });

      /* File labels a-h along bottom edge, rank labels 8-1 along left edge */
      if (displayRank === 7) {
        const label = el('span', [], {
          style: 'position:absolute;bottom:2px;right:3px;font-size:10px;color:rgba(255,255,255,0.2);font-weight:300;pointer-events:none;letter-spacing:0',
        }, String.fromCharCode(97 + displayFile));
        sq.appendChild(label);
      }
      if (displayFile === 0) {
        const label = el('span', [], {
          style: 'position:absolute;top:2px;left:3px;font-size:10px;color:rgba(255,255,255,0.2);font-weight:300;pointer-events:none;letter-spacing:0',
        }, (8 - displayRank).toString());
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
  const isWhiteBottom = playerColor === 'white';

  /* Reset all square backgrounds to default */
  squares.forEach(sq => {
    const file = parseInt(sq.getAttribute('data-file') || '0', 10);
    const rank = parseInt(sq.getAttribute('data-rank') || '0', 10);
    const isLight = (rank + file) % 2 === 0;
    /* Map display position for light/dark calculation */
    const alwaysBottom = getSetting('alwaysWhiteBottom');
    const isWhiteBottom = alwaysBottom ? true : (playerColor === 'white');
    const displayRank = isWhiteBottom ? rank : 7 - rank;
    const displayFile = isWhiteBottom ? file : 7 - file;
    const origLight = (displayRank + displayFile) % 2 === 0;
    sq.style.background = origLight ? 'var(--sq-light, #3d3d52)' : 'var(--sq-dark, #2c2c38)';
    sq.style.boxShadow = 'none';
  });

  /* Last move highlight — subtle warm tint */
  if (lastMove) {
    const fromSq = boardEl.querySelector(`[data-square="${lastMove.from}"]`) as HTMLElement;
    const toSq = boardEl.querySelector(`[data-square="${lastMove.to}"]`) as HTMLElement;
    if (fromSq) fromSq.style.background = 'rgba(255,200,100,0.15)';
    if (toSq) toSq.style.background = 'rgba(255,200,100,0.2)';
  }

  /* Selected square — soft blue overlay */
  if (selectedSquare) {
    const selSq = boardEl.querySelector(`[data-square="${selectedSquare}"]`) as HTMLElement;
    if (selSq) selSq.style.background = 'rgba(79,142,247,0.25)';
  }

  /* Remove stale hints first */
  boardEl.querySelectorAll('.legal-hint').forEach(d => d.remove());

  /* Legal move hints */
  const playerId = store.get('playerId');
  /* Differentiate capture targets (full circle) from empty squares (small dot) */
  for (const hint of legalHints) {
    const hintSq = boardEl.querySelector(`[data-square="${hint.to}"]`) as HTMLElement;
    if (!hintSq) continue;
    const [r, f] = squareToIndices(hint.to);
    const hasPiece = board[r] && board[r][f] !== null;
    if (hasPiece) {
      const dot = el('div', ['legal-hint'], {
        style: 'position:absolute;width:100%;height:100%;border-radius:50%;background:rgba(79,142,247,0.4);pointer-events:none;z-index:2',
      });
      hintSq.appendChild(dot);
    } else {
      const dot = el('div', ['legal-hint'], {
        style: 'position:absolute;width:12px;height:12px;border-radius:50%;background:rgba(79,142,247,0.3);pointer-events:none;z-index:2',
      });
      hintSq.appendChild(dot);
    }
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
      boardEl.querySelectorAll('.square').forEach(s => (s as HTMLElement).style.outline = '');
      if (isLegal) {
        hoverSq.style.outline = '2px solid rgba(79,142,247,0.6)';
        hoverSq.style.outlineOffset = '-2px';
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
      boardEl.querySelectorAll('.square').forEach(s => (s as HTMLElement).style.outline = '');
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
  const overlay = el('div', [], {
    style: 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:2000;animation:fadeIn 150ms ease',
  });
  const card = el('div', [], {
    style: 'background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);padding:24px;text-align:center',
  });
  const title = el('div', [], {
    style: 'font-size:14px;font-weight:500;color:#888;margin-bottom:16px;letter-spacing:0.3px',
  }, 'Choose promotion piece');
  card.appendChild(title);
  const pieceRow = el('div', [], { style: 'display:flex;gap:12px;justify-content:center' });
  for (const pt of ['queen', 'rook', 'bishop', 'knight'] as PieceType[]) {
    const btn = el('div', [], {
      style: 'width:56px;height:56px;cursor:pointer;border-radius:8px;padding:8px;background:#222228;transition:background 150ms ease',
    });
    btn.innerHTML = getPieceSvg(pt, playerColor);
    btn.addEventListener('mouseenter', () => { btn.style.background = '#2c2c38'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#222228'; });
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
    moveHistoryEl.appendChild(el('div', [], {
      style: 'font-size:13px;font-weight:300;color:#555;text-align:center;padding:20px',
    }, 'No moves yet'));
    return;
  }

  const table = el('div', [], {
    style: 'display:grid;grid-template-columns:auto 1fr 1fr;gap:4px 12px;font-size:13px;width:100%',
  });

  const headerNum = el('div', [], { style: 'color:#555;font-weight:300;font-size:11px' }, '#');
  const headerW = el('div', [], { style: 'color:#555;font-weight:300;font-size:11px' }, 'White');
  const headerB = el('div', [], { style: 'color:#555;font-weight:300;font-size:11px' }, 'Black');
  table.appendChild(headerNum);
  table.appendChild(headerW);
  table.appendChild(headerB);

  for (let i = 0; i < moves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const isLast = i === moves.length - 1 || i === moves.length - 2;

    const numEl = el('div', [], {
      style: `color:#555;font-weight:300;font-size:11px;${isLast ? 'font-weight:500;color:#888' : ''}`,
    }, `${moveNum}.`);

    const wMove = moves[i];
    const wEl = el('div', [], {
      style: `color:#e0e0e0;font-weight:500;letter-spacing:0.2px;${isLast && i >= moves.length - 2 ? 'background:rgba(79,142,247,0.12);border-radius:4px;padding:2px 6px' : ''}`,
    }, wMove);
    table.appendChild(numEl);
    table.appendChild(wEl);

    const bMove = moves[i + 1];
    if (bMove) {
      const bEl = el('div', [], {
        style: `color:#e0e0e0;font-weight:500;letter-spacing:0.2px;${isLast && i + 1 >= moves.length - 1 ? 'background:rgba(79,142,247,0.12);border-radius:4px;padding:2px 6px' : ''}`,
      }, bMove);
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
  if (reviewControlsEl) reviewControlsEl.style.display = 'flex';
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
