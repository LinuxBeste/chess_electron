import { describe, test, expect } from '@jest/globals';
import { render } from '@testing-library/react';
import {
  Skeleton,
  SkeletonLine,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonBoard,
  SkeletonLobby,
} from '../src/renderer/components/Skeleton';

describe('Skeleton', () => {
  test('renders default width and height', () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toBe('shimmer');
    expect(div.style.width).toBe('100%');
    expect(div.style.height).toBe('16px');
  });

  test('renders with custom width, height and border radius', () => {
    const { container } = render(<Skeleton width={200} height={40} borderRadius={8} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe('200px');
    expect(div.style.height).toBe('40px');
    expect(div.style.borderRadius).toBe('8px');
  });
});

describe('SkeletonLine', () => {
  test('renders shimmer-line class', () => {
    const { container } = render(<SkeletonLine />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('shimmer-line');
  });
});

describe('SkeletonAvatar', () => {
  test('renders circular shimmer with default size', () => {
    const { container } = render(<SkeletonAvatar />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.borderRadius).toBe('50%');
    expect(div.style.width).toBe('80px');
    expect(div.style.height).toBe('80px');
  });

  test('renders with custom size', () => {
    const { container } = render(<SkeletonAvatar size={120} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe('120px');
    expect(div.style.height).toBe('120px');
  });
});

describe('SkeletonCard', () => {
  test('renders with default dimensions', () => {
    const { container } = render(<SkeletonCard />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe('280px');
    expect(div.style.height).toBe('120px');
  });

  test('renders with custom dimensions', () => {
    const { container } = render(<SkeletonCard width="100%" height={200} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.width).toBe('100%');
    expect(div.style.height).toBe('200px');
  });
});

describe('SkeletonBoard', () => {
  test('renders board skeleton with correct class', () => {
    const { container } = render(<SkeletonBoard />);
    expect(container.querySelector('.shimmer.skeleton-board')).toBeTruthy();
    expect(container.querySelector('.skeleton-page')).toBeTruthy();
  });
});

describe('SkeletonLobby', () => {
  test('renders multiple skeleton cards', () => {
    const { container } = render(<SkeletonLobby />);
    const cards = container.querySelectorAll('.shimmer');
    expect(cards.length).toBeGreaterThan(0);
    expect(container.querySelector('.page-container')).toBeTruthy();
  });
});
