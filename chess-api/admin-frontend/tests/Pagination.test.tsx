import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '../src/Pagination';

describe('Pagination', () => {
  test('renders page buttons', () => {
    render(<Pagination page={1} totalPages={5} onChange={() => {}} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  test('returns null when totalPages <= 1', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  test('highlights current page', () => {
    render(<Pagination page={3} totalPages={5} onChange={() => {}} />);
    const btn = screen.getByText('3');
    expect(btn.className).toContain('bg-[#4a9eff]');
  });

  test('calls onChange with next page on next click', () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onChange={onChange} />);
    const buttons = document.querySelectorAll('button');
    const nextBtn = buttons[buttons.length - 1];
    fireEvent.click(nextBtn);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  test('calls onChange with previous page on prev click', () => {
    const onChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onChange={onChange} />);
    const buttons = document.querySelectorAll('button');
    const prevBtn = buttons[0];
    fireEvent.click(prevBtn);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  test('disables prev button on first page', () => {
    render(<Pagination page={1} totalPages={5} onChange={() => {}} />);
    const buttons = document.querySelectorAll('button');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  test('disables next button on last page', () => {
    render(<Pagination page={5} totalPages={5} onChange={() => {}} />);
    const buttons = document.querySelectorAll('button');
    const nextBtn = buttons[buttons.length - 1];
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  test('calls onChange with specific page when page number clicked', () => {
    const onChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onChange={onChange} />);
    fireEvent.click(screen.getByText('4'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  test('renders ellipsis for large page counts', () => {
    render(<Pagination page={10} totalPages={50} onChange={() => {}} />);
    const ellipsis = document.querySelectorAll('span');
    const dots = Array.from(ellipsis).filter((s) => s.textContent === '…');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  test('shows sliding window around current page', () => {
    render(<Pagination page={10} totalPages={50} onChange={() => {}} />);
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  test('renders ChevronLeft and ChevronRight icons', () => {
    render(<Pagination page={2} totalPages={5} onChange={() => {}} />);
    const buttons = document.querySelectorAll('button');
    expect(buttons[0].innerHTML).toContain('chevron-left');
    expect(buttons[buttons.length - 1].innerHTML).toContain('chevron-right');
  });
});
