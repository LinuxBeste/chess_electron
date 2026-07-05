import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from '../src/SearchBar';

const sortOptions = [
  { key: 'username', label: 'Username' },
  { key: 'rating', label: 'Rating' },
];

describe('SearchBar', () => {
  test('renders search input with placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Find..." />);
    expect(screen.getByPlaceholderText('Find...')).toBeTruthy();
  });

  test('shows default placeholder when none provided', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  test('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  test('renders sort options when provided', () => {
    render(
      <SearchBar
        value=""
        onChange={() => {}}
        sortOptions={sortOptions}
        sortKey="username"
        sortAsc
        onSortChange={() => {}}
      />,
    );
    expect(screen.getByText('Username')).toBeTruthy();
    expect(screen.getByText('Rating')).toBeTruthy();
  });

  test('does not render sort controls when sortOptions missing', () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} />);
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBe(0);
  });

  test('calls onSortChange when sort column changed', () => {
    const onSortChange = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={() => {}}
        sortOptions={sortOptions}
        sortKey="username"
        sortAsc
        onSortChange={onSortChange}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rating' } });
    expect(onSortChange).toHaveBeenCalledWith('rating', true);
  });

  test('toggles sort direction on button click', () => {
    const onSortChange = vi.fn();
    render(
      <SearchBar
        value=""
        onChange={() => {}}
        sortOptions={sortOptions}
        sortKey="username"
        sortAsc
        onSortChange={onSortChange}
      />,
    );
    const buttons = document.querySelectorAll('button');
    fireEvent.click(buttons[0]);
    expect(onSortChange).toHaveBeenCalledWith('username', false);
  });

  test('shows ascending icon when sortAsc is true', () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={() => {}}
        sortOptions={sortOptions}
        sortKey="username"
        sortAsc
        onSortChange={() => {}}
      />,
    );
    expect(container.innerHTML).toContain('chevron-up');
  });

  test('shows descending icon when sortAsc is false', () => {
    const { container } = render(
      <SearchBar
        value=""
        onChange={() => {}}
        sortOptions={sortOptions}
        sortKey="username"
        sortAsc={false}
        onSortChange={() => {}}
      />,
    );
    expect(container.innerHTML).toContain('chevron-down');
  });

  test('displays current search value', () => {
    render(<SearchBar value="user1" onChange={() => {}} />);
    const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
    expect(input.value).toBe('user1');
  });
});
