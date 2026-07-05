import { describe, test, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import PromotionDialog from '../src/renderer/components/PromotionDialog';

jest.mock('../src/renderer/chess', () => ({
  getPieceSvg: (_t: string, _c: string) => '<svg></svg>',
}));

describe('PromotionDialog', () => {
  const pieces = ['queen', 'rook', 'bishop', 'knight'];

  test('renders all four promotion piece options for white', () => {
    const onSelect = jest.fn();
    render(<PromotionDialog color="white" onSelect={onSelect} />);
    expect(screen.getByText('Choose promotion piece')).toBeTruthy();
    const pieceDivs = document.querySelectorAll('.promo-piece');
    expect(pieceDivs.length).toBe(4);
  });

  test('renders all four promotion piece options for black', () => {
    const onSelect = jest.fn();
    render(<PromotionDialog color="black" onSelect={onSelect} />);
    const pieceDivs = document.querySelectorAll('.promo-piece');
    expect(pieceDivs.length).toBe(4);
  });

  test('calls onSelect with queen when first piece clicked', () => {
    const onSelect = jest.fn();
    render(<PromotionDialog color="white" onSelect={onSelect} />);
    const pieceDivs = document.querySelectorAll('.promo-piece');
    fireEvent.click(pieceDivs[0]);
    expect(onSelect).toHaveBeenCalledWith('queen');
  });

  test('calls onSelect with rook when second piece clicked', () => {
    const onSelect = jest.fn();
    render(<PromotionDialog color="white" onSelect={onSelect} />);
    const pieceDivs = document.querySelectorAll('.promo-piece');
    fireEvent.click(pieceDivs[1]);
    expect(onSelect).toHaveBeenCalledWith('rook');
  });

  test('calls onSelect with bishop when third piece clicked', () => {
    const onSelect = jest.fn();
    render(<PromotionDialog color="black" onSelect={onSelect} />);
    const pieceDivs = document.querySelectorAll('.promo-piece');
    fireEvent.click(pieceDivs[2]);
    expect(onSelect).toHaveBeenCalledWith('bishop');
  });

  test('calls onSelect with knight when fourth piece clicked', () => {
    const onSelect = jest.fn();
    render(<PromotionDialog color="black" onSelect={onSelect} />);
    const pieceDivs = document.querySelectorAll('.promo-piece');
    fireEvent.click(pieceDivs[3]);
    expect(onSelect).toHaveBeenCalledWith('knight');
  });

  test('stops propagation on overlay click', () => {
    const onSelect = jest.fn();
    render(<PromotionDialog color="white" onSelect={onSelect} />);
    const overlay = document.querySelector('.modal-overlay')!;
    const parentHandler = jest.fn();
    overlay.addEventListener('click', parentHandler);
    fireEvent.click(overlay);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test.each(pieces)('renders SVG inside %s piece option', (piece) => {
    const onSelect = jest.fn();
    const { container } = render(<PromotionDialog color="white" onSelect={onSelect} />);
    const spans = container.querySelectorAll('.piece-char');
    expect(spans[pieces.indexOf(piece)].innerHTML).toBe('<svg></svg>');
  });
});
