import { describe, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import MoveHistory from '../src/renderer/components/MoveHistory';

jest.mock('../src/renderer/components/MoveQualityIndicator', () => ({
  __esModule: true,
  default: ({ quality }: { quality: string }) => <span data-testid="quality">{quality}</span>,
}));

describe('MoveHistory', () => {
  test('renders empty state when no moves', () => {
    const { container } = render(<MoveHistory moves={[]} />);
    expect(container.textContent).toContain('No moves yet');
  });

  test('renders title', () => {
    render(<MoveHistory moves={[]} />);
    expect(screen.getByText('Moves')).toBeTruthy();
  });

  test('renders single move pair', () => {
    const { container } = render(<MoveHistory moves={['e2-e4', 'e7-e5']} />);
    expect(container.textContent).toContain('1.');
    expect(container.textContent).toContain('e2-e4');
    expect(container.textContent).toContain('e7-e5');
  });

  test('renders move number for each pair', () => {
    const { container } = render(<MoveHistory moves={['e2-e4', 'e7-e5', 'Nf3', 'Nc6', 'Bb5']} />);
    expect(container.textContent).toContain('1.');
    expect(container.textContent).toContain('2.');
    expect(container.textContent).toContain('3.');
  });

  test('highlights latest white move', () => {
    const { container } = render(<MoveHistory moves={['e2-e4']} />);
    const moves = container.querySelectorAll('.history-move');
    expect(moves.length).toBeGreaterThanOrEqual(1);
    expect(moves[0].className).toContain('history-latest');
  });

  test('highlights latest black move', () => {
    const { container } = render(<MoveHistory moves={['e2-e4', 'e7-e5']} />);
    const moves = container.querySelectorAll('.history-move');
    const last = moves[moves.length - 1];
    expect(last.className).toContain('history-latest');
  });

  test('renders move quality indicators when provided', () => {
    const { container } = render(
      <MoveHistory moves={['e2-e4', 'e7-e5']} moveQualities={{ 'e2-e4': 'excellent', 'e7-e5': 'good' }} />,
    );
    const indicators = container.querySelectorAll('[data-testid="quality"]');
    expect(indicators.length).toBe(2);
    expect(indicators[0].textContent).toBe('excellent');
    expect(indicators[1].textContent).toBe('good');
  });

  test('renders three column headers', () => {
    const { container } = render(<MoveHistory moves={['e2-e4']} />);
    const headers = container.querySelectorAll('.history-header');
    expect(headers.length).toBe(3);
    expect(headers[0].textContent).toBe('#');
    expect(headers[1].textContent).toBe('White');
    expect(headers[2].textContent).toBe('Black');
  });

  test('has history-grid container', () => {
    const { container } = render(<MoveHistory moves={['e2-e4']} />);
    expect(container.querySelector('.history-grid')).toBeTruthy();
  });
});
