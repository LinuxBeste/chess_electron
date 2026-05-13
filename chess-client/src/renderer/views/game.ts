import { store } from '../store';
import * as api from '../api';
import { socketManager } from '../socket';
import { navigate } from '../router';
import { el, getPieceSvg, deserializeBoard, squareToIndices, indicesToSquare, cloneBoard } from '../chess';
import type { Board, GameState, LegalMoveHint, PieceType } from '../../types';
import type { MoveMessage, GameOverMessage, GameStartedMessage } from '../socket';

/* All state resets on each mount() → cleanup() cycle */
let game: GameState | null = null;
let playerColor: 'white' | 'black' = 'white';
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
    const gameId = hash.startsWith('#game/') ? hash.slice(6) : '';

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

    return () => {
      cleanup();
    };
};

function cleanup(): void {
  if (clockInterval !== null) clearInterval(clockInterval);
  document.removeEventListener('mousemove', handleDocumentMouseMove);
  document.removeEventListener('mouseup', handleDocumentMouseUp);
  if (unsubMove) unsubMove();
  if (unsubGameOver) unsubGameOver();
  if (unsubGameStarted) unsubGameStarted();
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
  if (g.status === 'resigned' || g.status === 'checkmate' || g.status === 'stalemate') {
    navigate('result', g.id);
    return;
  }

  board = cloneBoard(g.board);
  lastMove = g.lastMove;
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

  /* If it's the player's turn, fetch legal moves (for hints) */
  if (g.turn === playerColor && g.status === 'active') {
    fetchLegalMoves(g.id);
  }
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
  resignBtn = el('button', [], {
    style: 'background:transparent;border:none;color:rgba(220,80,80,0.7);font-size:13px;font-weight:500;cursor:pointer;padding:4px 8px;transition:color 150ms ease;letter-spacing:0.3px',
  }, 'Resign');
  resignBtn.addEventListener('mouseenter', () => { if (resignBtn) resignBtn.style.color = 'rgba(220,80,80,1)'; });
  resignBtn.addEventListener('mouseleave', () => { if (resignBtn) resignBtn.style.color = 'rgba(220,80,80,0.7)'; });
  resignBtn.addEventListener('click', () => handleResign());
  centerCol.appendChild(resignBtn);

  wrapper.appendChild(centerCol);

  /* Right column: move history */
  const rightCol = el('div', [], {
    style: 'width:220px;flex-shrink:0;display:flex;flex-direction:column',
  });
  const histTitle = el('h3', [], {
    style: 'font-size:14px;font-weight:700;color:#888;margin-bottom:12px;letter-spacing:0.5px;text-transform:uppercase',
  }, 'Moves');
  rightCol.appendChild(histTitle);

  moveHistoryEl = el('div', [], {
    style: 'flex:1;overflow-y:auto;background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);padding:12px;min-height:200px;max-height:calc(100vh - 200px)',
  });
  rightCol.appendChild(moveHistoryEl);
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
  const isWhiteBottom = playerColor === 'white';

  for (let displayRank = 0; displayRank < 8; displayRank++) {
    const boardRank = isWhiteBottom ? displayRank : 7 - displayRank;

    for (let displayFile = 0; displayFile < 8; displayFile++) {
      const boardFile = isWhiteBottom ? displayFile : 7 - displayFile;

      const isLight = (displayRank + displayFile) % 2 === 0;
      const sq = el('div', ['square'], {
        'data-rank': boardRank.toString(),
        'data-file': boardFile.toString(),
        'data-square': indicesToSquare(boardRank, boardFile),
        style: `position:absolute;top:${displayRank * sqSize}px;left:${displayFile * sqSize}px;width:${sqSize}px;height:${sqSize}px;background:${isLight ? '#3d3d52' : '#2c2c38'};display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 150ms ease`,
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
    const displayRank = isWhiteBottom ? rank : 7 - rank;
    const displayFile = isWhiteBottom ? file : 7 - file;
    const origLight = (displayRank + displayFile) % 2 === 0;
    sq.style.background = origLight ? '#3d3d52' : '#2c2c38';
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
  /* Fetch legal moves for this piece if not already cached */
  if (game) {
    api.getLegalMoves(game.id).then(({ moves }) => {
      legalHints = moves.filter(m => m.from === square);
      applyHighlights();
    }).catch(() => {});
  }
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

    /* Check for game over */
    if (updated.status === 'checkmate' || updated.status === 'stalemate' || updated.status === 'resigned') {
      navigate('result', updated.id);
    } else if (updated.turn === playerColor) {
      fetchLegalMoves(game.id);
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
  board = deserializeBoard(msg.board);
  lastMove = msg.lastMove;
  if (game) game.turn = msg.turn;
  updateBoardDisplay();

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
  if (msg.game.turn === playerColor) {
    fetchLegalMoves(msg.game.id);
  }
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

/* ─── Resign ─── */

function handleResign(): void {
  if (!resignConfirmed) {
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

/* ─── Legal Moves ─── */

async function fetchLegalMoves(gameId: string): Promise<void> {
  try {
    const { moves } = await api.getLegalMoves(gameId);
    /* Store but don't show until a piece is selected */
    legalHints = [];
  } catch {}
}

/* Inject check glow keyframes */
const gameStyle = document.createElement('style');
gameStyle.textContent = `@keyframes checkGlow { 0%,100% { box-shadow:inset 0 0 20px rgba(220,50,50,0.6) } 50% { box-shadow:inset 0 0 30px rgba(220,50,50,0.9) } }`;
document.head.appendChild(gameStyle);
