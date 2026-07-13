import { describe, test, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFoundPage from '../src/renderer/pages/NotFoundPage';

jest.mock('lucide-react', () => ({
  ChessKing: () => '♚',
  ChessQueen: () => '♛',
  ChessRook: () => '♜',
  ChessBishop: () => '♝',
  ChessKnight: () => '♞',
  ChessPawn: () => '♟',
  ArrowLeft: () => '←',
}));

describe('NotFoundPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
  }

  test('renders 404 heading', () => {
    renderPage();
    expect(screen.getByText('404')).toBeTruthy();
  });

  test('renders out of bounds message', () => {
    renderPage();
    expect(screen.getByText('This page is out of bounds')).toBeTruthy();
  });

  test('renders Back to lobby button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Back to lobby/i })).toBeTruthy();
  });

  test('renders chess board with 64 squares', () => {
    const { container } = renderPage();
    const board = container.querySelector('[style*="grid-template-columns"]')!;
    expect(board).toBeTruthy();
    expect(board.children.length).toBe(64);
  });

  test('navigates to /lobby on button click', () => {
    renderPage();
    const button = screen.getByRole('button', { name: /Back to lobby/i });
    fireEvent.click(button);
  });
});
