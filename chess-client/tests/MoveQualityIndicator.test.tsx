import { describe, test, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import MoveQualityIndicator from '../src/renderer/components/MoveQualityIndicator';

describe('MoveQualityIndicator', () => {
  test('renders !! for excellent quality', () => {
    const { container } = render(<MoveQualityIndicator quality="excellent" />);
    expect(container.textContent).toBe('!!');
  });

  test('renders ! for good quality', () => {
    const { container } = render(<MoveQualityIndicator quality="good" />);
    expect(container.textContent).toBe('!');
  });

  test('renders ?! for inaccuracy', () => {
    const { container } = render(<MoveQualityIndicator quality="inaccuracy" />);
    expect(container.textContent).toBe('?!');
  });

  test('has title with quality label', () => {
    render(<MoveQualityIndicator quality="excellent" />);
    const span = document.querySelector('span[title]')!;
    expect(span.getAttribute('title')).toBe('Excellent');
  });

  test('includes best move in title when provided', () => {
    render(<MoveQualityIndicator quality="excellent" bestMove="Qh7#" />);
    const span = document.querySelector('span[title]')!;
    expect(span.getAttribute('title')).toContain('Qh7#');
  });

  test('uses green color for excellent', () => {
    const { container } = render(<MoveQualityIndicator quality="excellent" />);
    const span = container.querySelector('span')!;
    expect(span.style.color).toBe('rgb(34, 197, 94)');
  });

  test('uses blue color for good', () => {
    const { container } = render(<MoveQualityIndicator quality="good" />);
    const span = container.querySelector('span')!;
    expect(span.style.color).toBe('rgb(79, 142, 247)');
  });

  test('uses amber color for inaccuracy', () => {
    const { container } = render(<MoveQualityIndicator quality="inaccuracy" />);
    const span = container.querySelector('span')!;
    expect(span.style.color).toBe('rgb(245, 158, 11)');
  });
});
