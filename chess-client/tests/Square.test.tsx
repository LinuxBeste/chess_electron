import { describe, test, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import Square from '../src/renderer/components/Square';

function getClasses(container: ReturnType<typeof render>['container']): string {
  return (container.firstChild as HTMLElement)?.className || '';
}

describe('Square', () => {
  const baseProps = {
    rank: 0,
    file: 0,
    displayRank: 7,
    displayFile: 0,
    piece: null,
    isLight: true,
    sqSize: 64,
    isSelected: false,
    isLastMoveFrom: false,
    isLastMoveTo: false,
    isLegalHint: false,
    isLegalCapture: false,
    isHovered: false,
    isPremoveFrom: false,
    isPremoveTo: false,
    showCoordinates: false,
    onClick: () => {},
    onPointerDown: () => {},
  };

  test('renders with light square class', () => {
    const { container } = render(<Square {...baseProps} />);
    expect(getClasses(container)).toContain('sq-light');
  });

  test('renders with dark square class', () => {
    const { container } = render(<Square {...baseProps} isLight={false} />);
    expect(getClasses(container)).toContain('sq-dark');
  });

  test('renders piece character when piece is provided', () => {
    const piece = { type: 'king' as const, color: 'white' as const };
    const { container } = render(<Square {...baseProps} piece={piece} />);
    expect(container.querySelector('.piece-char')).toBeTruthy();
    expect(container.textContent).toContain('♔');
  });

  test('renders black piece with correct character', () => {
    const piece = { type: 'knight' as const, color: 'black' as const };
    const { container } = render(<Square {...baseProps} piece={piece} />);
    expect(container.querySelector('.piece-char')).toBeTruthy();
    expect(container.textContent).toContain('♞');
  });

  test('renders no piece when piece is null', () => {
    const { container } = render(<Square {...baseProps} piece={null} />);
    expect(container.querySelector('.piece-char')).toBeNull();
  });

  test('shows rank coordinate when displayFile === 0', () => {
    render(<Square {...baseProps} showCoordinates={true} displayRank={3} displayFile={0} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  test('shows file coordinate when displayRank === 7', () => {
    render(<Square {...baseProps} showCoordinates={true} displayRank={7} displayFile={3} />);
    expect(screen.getByText('d')).toBeTruthy();
  });

  test('shows legal hint dot', () => {
    const { container } = render(<Square {...baseProps} isLegalHint={true} />);
    expect(container.querySelector('.legal-dot')).toBeTruthy();
  });

  test('shows legal capture ring', () => {
    const { container } = render(<Square {...baseProps} isLegalCapture={true} />);
    expect(container.querySelector('.legal-capture')).toBeTruthy();
  });

  test('calls onClick callback when clicked', () => {
    const onClick = jest.fn();
    const { container } = render(<Square {...baseProps} onClick={onClick} rank={3} file={4} />);
    if (container.firstChild) fireEvent.click(container.firstChild);
    expect(onClick).toHaveBeenCalledWith('e5');
  });

  test('calls onPointerDown callback', () => {
    const onPointerDown = jest.fn();
    const { container } = render(<Square {...baseProps} onPointerDown={onPointerDown} rank={1} file={2} />);
    if (container.firstChild) fireEvent.pointerDown(container.firstChild);
    expect(onPointerDown).toHaveBeenCalledWith('c7', expect.any(Object));
  });

  test('applies selected highlight class', () => {
    const { container } = render(<Square {...baseProps} isSelected={true} />);
    expect(getClasses(container)).toContain('hl-selected');
  });

  test('applies last move highlight classes', () => {
    const { container } = render(<Square {...baseProps} isLastMoveFrom={true} isLastMoveTo={true} />);
    expect(getClasses(container)).toContain('hl-last-from');
    expect(getClasses(container)).toContain('hl-last-to');
  });

  test('applies hover class', () => {
    const { container } = render(<Square {...baseProps} isHovered={true} />);
    expect(getClasses(container)).toContain('hl-hover');
  });

  test('sets data attributes', () => {
    const { container } = render(<Square {...baseProps} rank={4} file={5} />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('data-rank')).toBe('4');
    expect(el.getAttribute('data-file')).toBe('5');
    expect(el.getAttribute('data-square')).toBe('f4');
  });
});
