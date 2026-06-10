import { describe, test, expect, jest } from '@jest/globals';
import { render, screen, act } from '@testing-library/react';
import ToastContainer from '../src/renderer/components/ToastContainer';
import { store } from '../src/renderer/store';

describe('ToastContainer', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.querySelector('.toast-bar')?.children.length || 0).toBe(0);
  });

  test('renders toast after store.toast is called', () => {
    jest.useFakeTimers();
    render(<ToastContainer />);
    act(() => {
      store.toast('Test error', 'error');
    });
    expect(screen.getByText('Test error')).toBeTruthy();
  });

  test('renders info toast with correct class', () => {
    jest.useFakeTimers();
    render(<ToastContainer />);
    act(() => {
      store.toast('Info message', 'info');
    });
    const el = screen.getByText('Info message');
    expect(el.className).toContain('toast-info');
  });

  test('auto-removes toast after timeout', () => {
    jest.useFakeTimers();
    render(<ToastContainer />);
    act(() => {
      store.toast('Auto remove', 'error');
    });
    expect(screen.getByText('Auto remove')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Auto remove')).toBeNull();
  });
});
