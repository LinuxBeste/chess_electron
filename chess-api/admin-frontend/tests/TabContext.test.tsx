import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabProvider, useNavigateTab } from '../src/TabContext';

function TestChild() {
  const navigate = useNavigateTab();
  return <button onClick={() => navigate('games', { player: 'p1' })}>Navigate</button>;
}

describe('TabContext', () => {
  test('calls onNavigate when navigateTab is used', () => {
    const onNavigate = vi.fn();
    render(
      <TabProvider onNavigate={onNavigate}>
        <TestChild />
      </TabProvider>,
    );
    fireEvent.click(screen.getByText('Navigate'));
    expect(onNavigate).toHaveBeenCalledWith('games', { player: 'p1' });
  });

  test('provides stable navigateTab reference', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(
      <TabProvider onNavigate={onNavigate}>
        <TestChild />
      </TabProvider>,
    );
    rerender(
      <TabProvider onNavigate={onNavigate}>
        <TestChild />
      </TabProvider>,
    );
    fireEvent.click(screen.getByText('Navigate'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  test('useNavigateTab returns no-op when used outside provider', () => {
    expect(() => render(<TestChild />)).not.toThrow();
  });

  test('renders children', () => {
    render(
      <TabProvider onNavigate={() => {}}>
        <div>child</div>
      </TabProvider>,
    );
    expect(screen.getByText('child')).toBeTruthy();
  });
});
