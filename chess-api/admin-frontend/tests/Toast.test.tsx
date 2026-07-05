import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../src/Toast';

function TestHarness() {
  const { addToast } = useToast();
  return (
    <div>
      <button onClick={() => addToast('Hello world', 'info')}>Add Info</button>
      <button onClick={() => addToast('Success!', 'success')}>Add Success</button>
      <button onClick={() => addToast('Error!', 'error')}>Add Error</button>
    </div>
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('renders children', () => {
    render(
      <ToastProvider>
        <div>child</div>
      </ToastProvider>,
    );
    expect(screen.getByText('child')).toBeTruthy();
  });

  test('shows toast when addToast is called with info type', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Info'));
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  test('shows toast when addToast is called with success type', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Success'));
    expect(screen.getByText('Success!')).toBeTruthy();
  });

  test('shows toast when addToast is called with error type', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Error'));
    expect(screen.getByText('Error!')).toBeTruthy();
  });

  test('auto-dismisses toast after 4 seconds', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Info'));
    expect(screen.getByText('Hello world')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Hello world')).toBeNull();
  });

  test('does not dismiss toast before 4 seconds', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Info'));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  test('dismisses toast on close button click', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Info'));
    const closeBtns = document.querySelectorAll('button');
    const closeBtn = closeBtns[closeBtns.length - 1];
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Hello world')).toBeNull();
  });

  test('renders multiple toasts', () => {
    render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Info'));
    fireEvent.click(screen.getByText('Add Success'));
    expect(screen.getByText('Hello world')).toBeTruthy();
    expect(screen.getByText('Success!')).toBeTruthy();
  });

  test('renders correct icon per type', () => {
    const { container } = render(
      <ToastProvider>
        <TestHarness />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Success'));
    expect(container.innerHTML).toContain('circle-check');
    fireEvent.click(screen.getByText('Add Error'));
    expect(container.innerHTML).toContain('circle-alert');
    fireEvent.click(screen.getByText('Add Info'));
    expect(container.innerHTML).toContain('lucide-info');
  });
});
