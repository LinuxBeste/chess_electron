import { describe, test, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import Board from '../src/renderer/components/Board';
import { createInitialBoard } from '../src/renderer/chess';
import type { LegalMoveHint } from '../src/types';

const emptyBoard = createInitialBoard();

const defaultProps = {
  board: emptyBoard,
  playerColor: 'white' as const,
  selectedSquare: null,
  legalHints: [] as LegalMoveHint[],
  lastMove: null,
  isActive: false,
  onSquareClick: () => {},
  onDragStart: () => {},
  onDragEnd: () => {},
  children: null,
};

describe('Board best move hint', () => {
  test('renders arrow SVG when bestMoveHint is set', () => {
    const { container } = render(<Board {...defaultProps} bestMoveHint={{ from: 'e2', to: 'e4' }} />);
    const svg = container.querySelector('.best-move-arrow');
    expect(svg).toBeTruthy();
    expect(svg?.querySelector('line')).toBeTruthy();
    expect(svg?.querySelector('polygon')).toBeTruthy();
  });

  test('does not render arrow when bestMoveHint is null', () => {
    const { container } = render(<Board {...defaultProps} bestMoveHint={null} />);
    const svg = container.querySelector('.best-move-arrow');
    expect(svg).toBeNull();
  });

  test('highlights from and to squares', () => {
    const { container } = render(<Board {...defaultProps} bestMoveHint={{ from: 'e2', to: 'e4' }} />);
    const fromSq = container.querySelector('[data-square="e2"]') as HTMLElement;
    const toSq = container.querySelector('[data-square="e4"]') as HTMLElement;
    expect(fromSq?.className).toContain('hl-best-from');
    expect(toSq?.className).toContain('hl-best-to');
  });

  test('renders arrow with correct endpoints for black perspective', () => {
    const { container } = render(
      <Board {...defaultProps} playerColor="black" bestMoveHint={{ from: 'e7', to: 'e5' }} />,
    );
    const svg = container.querySelector('.best-move-arrow');
    expect(svg).toBeTruthy();
    expect(svg?.querySelector('line')).toBeTruthy();
  });
});
