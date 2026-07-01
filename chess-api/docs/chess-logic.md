# Chess Logic

All chess rules are implemented in `src/chess.ts`. No external chess libraries are used — the engine is hand-rolled (~715 lines).

## Board Model

```
board[rank][file] where:
  rank 0 = rank 8  (black's home)
  rank 7 = rank 1  (white's home)
  file 0 = a-file
  file 7 = h-file
```

A cell is either `null` (empty) or a `Piece` object `{ type: PieceType, color: Color }`.

This orientation matches standard top-to-bottom rendering: rank 0 appears at the top of the screen. `squareToIndices('e2')` → `[6, 4]` (rank 6 = row 6 = rank 2, file 4 = e-file).

## Piece Type Representation

```typescript
type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
type Color = 'white' | 'black';
```

Pieces are tracked only by their type and color — no special flags for moved/unmoved status. Castling eligibility is tracked separately in `CastlingRights`.

## Move Generation

Each piece type has its own generator function. These produce **pseudo-legal** moves — they obey piece movement rules but do not filter out moves that leave the king in check. That filtering is done in `getLegalMoves`.

### Pawn (`generatePawnMoves`)

Pawns are the most complex piece due to special rules:

- **Single advance**: 1 square forward (direction depends on color). Blocked if occupied.
- **Double advance**: 2 squares forward from the starting rank (rank 7 for white, rank 2 for black). Blocked if either square is occupied. Sets the intermediate square as the `enPassantTarget`.
- **Diagonal captures**: 1 square forward-diagonal left/right. Requires an enemy piece on the destination.
- **En passant**: If a diagonal capture destination matches the stored `enPassantTarget`, the move is marked as en passant. The captured pawn is on the square behind the target.
- **Promotion**: When a pawn reaches the 8th rank (white) or 1st rank (black), 4 candidate moves are generated for each promotion type: queen, rook, bishop, knight. If a promotion move is also a capture, both effects are combined.
- **Edge files**: Pawns on the a-file can only capture to the b-file; pawns on the h-file can only capture to the g-file.

### Knight (`generateKnightMoves`)

8 L-shaped offsets from `KNIGHT_OFFSETS`:

```typescript
const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
```

Each offset is added to the current position. Results outside the board or occupied by a friendly piece are filtered out.

### Bishop (`generateBishopMoves`), Rook (`generateRookMoves`), Queen (`generateQueenMoves`)

Sliding pieces use a shared `generateSlidingMoves` helper:

```typescript
function generateSlidingMoves(
  board: Board,
  rank: number,
  file: number,
  piece: Piece,
  directions: [number, number][],
): Move[];
```

Each direction vector is followed outward until:

- Edge of board → stop
- Friendly piece → stop (cannot move here)
- Enemy piece → capture + stop

Bishop directions: `[1,1], [1,-1], [-1,1], [-1,-1]`
Rook directions: `[0,1], [0,-1], [1,0], [-1,0]`
Queen combines both sets.

### King (`generateKingMoves`)

8 adjacent squares using `KING_OFFSETS`. Filters out-of-bounds and friendly-occupied squares.

Castling is generated here but only validated at the legal-move stage:

- **Kingside**: King on e1/e8, rook on h1/h8, squares f1/f8 + g1/g8 are empty, and no check-related validation (done in `getLegalMoves`).
- **Queenside**: King on e1/e8, rook on a1/a8, squares b1/b8 + c1/c8 + d1/d8 are empty.
- The rook's final destination (f1 for kingside, d1 for queenside) must also be empty.

## Legal Move Filtering

`getLegalMoves` is the central validation function:

```typescript
function getLegalMoves(
  board: Board,
  color: Color,
  enPassantTarget: string | null,
  castlingRights: CastlingRights,
): Move[];
```

**Phase 1**: Generate pseudo-legal moves for every piece of `color`.

**Phase 2** (brute-force validation): For each pseudo-legal move:

1. Clone the board via `applyMove`.
2. Check if `color`'s king is in check on the cloned board with `isInCheck`.
3. If not in check, the move is legal.

**Castling-specific checks**: Before including a castling move, additional checks ensure:

- The king does not **pass through** an attacked square (e.g., square f1 for kingside).
- The king does not **land on** an attacked square (g1 for kingside, c1 for queenside).
- The king is not currently **in check** (cannot castle out of check).

These are checked on the **original** board using `isSquareAttackedBy`. The clone-and-check phase then verifies the resulting position is also safe.

**Computational cost**: For a typical middlegame position with ~35 legal moves, this does 35 board clones + `isInCheck` calls. Each `isInCheck` call scans up to 27 directions from the king (4 orthogonal + 4 diagonal + 8 knight + 8 king-adjacent + up to 2 pawn attacks). This is fast enough for real-time play on modern hardware.

## Attack Detection

`isSquareAttackedBy` checks whether any piece of a given color can attack a specific square. It scans **outward** from the target square (not inward from pieces):

1. **Knight attacks**: Check all 8 knight offsets for an enemy knight.
2. **King attacks**: Check all 8 adjacent squares for an enemy king.
3. **Pawn attacks**: Check 1-2 squares in the pawn's attack direction (depends on color).
4. **Orthogonal sliding** (rook/queen): Scan 4 directions (up, down, left, right). Stop at the first piece in each direction — if it's a rook or queen of the attacking color, the square is attacked.
5. **Diagonal sliding** (bishop/queen): Scan 4 diagonal directions. Stop at the first piece — if it's a bishop or queen, the square is attacked.

Each direction scan stops at the first blocker. This is a key optimization over iterating all opponent pieces.

## Check / Checkmate / Stalemate / Draw

`getGameStatus` determines the game state:

```typescript
function getGameStatus(
  board: Board,
  color: Color,
  enPassantTarget: string | null,
  castlingRights: CastlingRights,
  halfMoveClock?: number,
): { status: GameStatus; isInCheck: boolean };
```

Algorithm:

1. Check if `color`'s king is in check via `isInCheck`.
2. Compute all legal moves via `getLegalMoves`.
3. If no legal moves:
   - In check → `checkmate`
   - Not in check → `stalemate`
4. If legal moves exist and `halfMoveClock >= 100` → `draw` (50-move rule)
5. If legal moves exist and `hasInsufficientMaterial(board)` → `draw`
6. Otherwise → `active` (with informational `isInCheck` flag)

`hasInsufficientMaterial` detects draws by insufficient mating material:

- King vs king
- King + bishop vs king (single bishop)
- King + knight vs king (single knight)
- King + bishop vs king + bishop (both bishops on same color)

## Applying Moves

`applyMove` produces a new board state from a move:

```typescript
function applyMove(
  board: Board,
  move: Move,
  castlingBefore: CastlingRights,
): { newBoard: Board; enPassantTarget: string | null; castlingRights: CastlingRights };
```

Steps:

1. **Clone** the board (shallow copy of 8×8 array, but piece objects are reused).
2. **Update castling rights**: If the king moves, forfeit both sides for that color. If a rook moves from its starting square, forfeit that side. If a rook is captured on its starting square, forfeit the opponent's corresponding side.
3. **Handle castling**: Move the rook alongside the king (f1→g1 for white kingside, d1→c1 for queenside, and similarly for black).
4. **Handle en passant**: Remove the captured pawn (which is on a different square than the destination).
5. **Move the piece** to the destination square, clearing the source.
6. **Handle promotion**: Replace the moved pawn with the promotion piece type.
7. **Set en passant target**: If a pawn double-pushed, set the intermediate square. Otherwise clear it.

The `castlingBefore` parameter is only used for castling rights tracking (reading the previous rights, producing updated rights). The board itself is not yet mutated for castling when passed in.

## FEN Parsing and Export

`boardToFen` serializes a board state to FEN string:

```
rank1/rank2/.../rank8 color castling enPassant halfMove fullMove
```

- Ranks separated by `/`, empty squares counted as digits 1-8.
- White pieces uppercase, black pieces lowercase.
- Castling: `KQkq` for all rights, `-` for none.
- En passant: target square or `-`.

`fenToBoard` is the inverse — parses a FEN string back into `{ board, color, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber }`. Returns `null` on malformed input (wrong rank count, invalid characters, etc.).

Both functions support the full FEN specification including the 6-field format.

## Algebraic Notation

`moveToAlgebraic` produces standard algebraic notation (SAN) without check/mate markers:

| Pattern  | Example  | Condition              |
| -------- | -------- | ---------------------- |
| `O-O`    | `O-O`    | Kingside castling      |
| `O-O-O`  | `O-O-O`  | Queenside castling     |
| `e4`     | `e4`     | Pawn push (no capture) |
| `exd5`   | `exd5`   | Pawn capture           |
| `e8=Q`   | `e8=Q`   | Pawn promotion         |
| `fxg8=Q` | `fxg8=Q` | Capture with promotion |
| `Nf3`    | `Nf3`    | Piece move             |
| `Bxe5`   | `Bxe5`   | Piece capture          |
| `Rad1`   | `Rad1`   | Disambiguation (file)  |
| `R8a3`   | `R8a3`   | Disambiguation (rank)  |
| `Qh4e1`  | `Qh4e1`  | Disambiguation (both)  |

**Disambiguation logic**: When two identical pieces can move to the same square, the notation disambiguates by:

1. File first: if one piece has a unique file, use the file letter.
2. Rank second: if files are the same but ranks differ, use the rank number.
3. Both: if both file and rank are ambiguous, use the full square.

## Board Serialization

`serializeBoard` converts the board to a flat array of `{ type, color, square }` objects:

```typescript
type SerializedBoard = Array<{ type: PieceType; color: Color; square: string }>;
```

Only occupied squares are included. The order is left-to-right, top-to-bottom (a8, b8, ..., h1). The 50-move rule clock and full-move number are not included in serialization.

## 50-Move Rule

`updateHalfMoveClock(move, previousValue)` returns the new half-move clock:

- Resets to `0` if the move is a pawn move or a capture.
- Increments by `1` otherwise.

`getGameStatus` checks `halfMoveClock >= 100` to declare a draw.

## Test Coverage

The engine has 191 unit tests covering:

- Every piece type's move generation (center, edge, corner, blocked, pinned)
- En passant (white/black, discovered check via en passant, only legal move)
- Castling (both sides, through check, out of check, into check, forfeited by rook move/capture)
- Promotion (all 4 types, capture with promotion, corner-square promotion)
- Check/checkmate/stalemate (scholar's mate, back-rank mate, 7 specific checkmate patterns, 2 stalemate patterns)
- Legal move constraints (cannot move into check, must resolve check, pin reduces count)
- applyMove (captured piece, en passant removal, castling rook move, promotion)
- Algebraic notation (all patterns including disambiguation, three knights, promotion capture)
- isSquareAttackedBy (all piece types, edge cases, blocked detection)
- FEN round-trip (boardToFen → fenToBoard → identity, malformed rejection, field parsing)
- Insufficient material (8 patterns including K+B vs K+B same color)
- Board utilities (squareToIndices round-trip, isInBounds, cloneBoard)
- 50-move rule (reset on pawn/capture, increment, draw at >=100, active at <100)
- Triple check (only king moves legal under triple check)
