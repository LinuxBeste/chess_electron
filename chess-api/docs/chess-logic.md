# Chess Logic

All chess rules are implemented in `src/chess.ts`. No external chess libraries are used.

## Board Model

```
board[rank][file] where:
  rank 0 = rank 8  (black's home)
  rank 7 = rank 1  (white's home)
  file 0 = a-file
  file 7 = h-file
```

A cell is either `null` (empty) or a `Piece` object `{ type, color }`.

## Move Generation

Each piece type has its own generator function. These produce **pseudo-legal** moves — they obey piece movement rules but do not filter out moves that leave the king in check.

### Pawn (`generatePawnMoves`)

- Single advance (1 square forward)
- Double advance from starting rank (2 squares forward, sets en-passant target)
- Diagonal captures (including en passant)
- Promotion on the 8th/1st rank (generates 4 moves: queen, rook, bishop, knight)
- En passant detection: checks if the destination matches the stored `enPassantTarget`

### Knight (`generateKnightMoves`)

- 8 L-shaped offsets from `KNIGHT_OFFSETS`
- Filters out-of-bounds and friendly-occupied squares

### Bishop (`generateBishopMoves`)

- Diagonal sliding using `generateSlidingMoves` with `[[1,1], [1,-1], [-1,1], [-1,-1]]`
- Walks outward in each direction until edge, capture, or block

### Rook (`generateRookMoves`)

- Rank/file sliding using `generateSlidingMoves` with `[[0,1], [0,-1], [1,0], [-1,0]]`

### Queen (`generateQueenMoves`)

- Combines rook + bishop sliding moves

### King (`generateKingMoves`)

- 8 adjacent squares (filters out-of-bounds and friendly-occupied)
- Castling: kingside (O-O) and queenside (O-O-O) — checks that intermediate squares and the rook's destination are empty. Attack validation is done later in `getLegalMoves`.

## Legal Move Filtering

`getLegalMoves` converts pseudo-legal moves to legal moves:

1. For each pseudo-legal move, apply it on a **cloned** board via `applyMove`.
2. Check if the moving player's king is in check on the resulting board using `isInCheck`.
3. If not in check, the move is legal.

For **castling**, an additional pre-check verifies that the king does not pass through or land on an attacked square (checked via `isSquareAttackedBy` on the original board before cloning).

## Attack Detection

`isSquareAttackedBy(board, rank, file, byColor)` checks whether any piece of `byColor` can attack the given square. It scans outward from the square using:

1. Knight offsets (direct lookup)
2. King offsets (direct lookup)
3. Pawn offsets (direction depends on color)
4. Orthogonal sliding (rook/queen) — scans 4 directions
5. Diagonal sliding (bishop/queen) — scans 4 directions

Each scan stops at the first piece encountered (blocking).

## Check / Checkmate / Stalemate

`getGameStatus(board, color, enPassantTarget, castlingRights)`:

1. Check if `color`'s king is in check via `isInCheck`.
2. Compute all legal moves via `getLegalMoves`.
3. If no legal moves:
   - In check → `checkmate`
   - Not in check → `stalemate`
4. If legal moves exist:
   - In check → `check` (informational, game continues as `active`)
   - Not in check → `active`

## Applying Moves

`applyMove(board, move, castlingBefore)` returns `{ newBoard, enPassantTarget, castlingRights }`:

1. Clone the board (never mutate the original).
2. Update castling rights: king moves forfeit both sides, rook moves forfeit the corresponding side, capturing a rook forfeits the opponent's corresponding side.
3. Handle castling: move the rook alongside the king.
4. Handle en passant: remove the captured pawn.
5. Move the piece to the destination.
6. Handle promotion: replace the piece type.
7. Set en-passant target if a pawn double-pushed.

## Algebraic Notation

`moveToAlgebraic(move, capturedPiece, legalMoves)` produces standard algebraic notation:

- Castling → `O-O` or `O-O-O`
- Pawn moves → `e4`, `exd5`, `e8=Q`
- Piece moves → `Nf3`, `Bxe5`, `Rad1` (with disambiguation when two identical pieces can reach the same square)
