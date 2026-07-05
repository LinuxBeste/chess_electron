import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../src/LoginPage';

vi.mock('../src/api', () => ({
  api: vi.fn(),
  setToken: vi.fn(),
}));

import { api, setToken } from '../src/api';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders login form with username, password and login button', () => {
    render(<LoginPage onLogin={() => {}} />);
    expect(screen.getByPlaceholderText('Username')).toBeTruthy();
    expect(screen.getByPlaceholderText('Password')).toBeTruthy();
    expect(screen.getByText('Login')).toBeTruthy();
  });

  test('renders heading', () => {
    render(<LoginPage onLogin={() => {}} />);
    expect(screen.getByText('Chess API Admin')).toBeTruthy();
  });

  test('password input has type password', () => {
    render(<LoginPage onLogin={() => {}} />);
    const pw = screen.getByPlaceholderText('Password') as HTMLInputElement;
    expect(pw.type).toBe('password');
  });

  test('shows error message on failed login', async () => {
    vi.mocked(api).mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginPage onLogin={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });
  });

  test('calls onLogin on successful login', async () => {
    vi.mocked(api).mockResolvedValue({ token: 'abc123' });
    const onLogin = vi.fn();
    render(<LoginPage onLogin={onLogin} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(setToken).toHaveBeenCalledWith('abc123');
    });
    expect(onLogin).toHaveBeenCalled();
  });

  test('shows loading state during login', async () => {
    vi.mocked(api).mockImplementation(() => new Promise(() => {}));
    render(<LoginPage onLogin={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('Logging in...')).toBeTruthy();
  });

  test('disables submit button while loading', async () => {
    vi.mocked(api).mockImplementation(() => new Promise(() => {}));
    render(<LoginPage onLogin={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } });
    const button = screen.getByText('Login');
    fireEvent.click(button);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  test('calls api with correct payload', async () => {
    vi.mocked(api).mockResolvedValue({ token: 'xyz' });
    render(<LoginPage onLogin={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'myadmin' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'mypass' } });
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'myadmin', password: 'mypass' }),
      });
    });
  });

  test('username and password inputs are required', () => {
    render(<LoginPage onLogin={() => {}} />);
    expect(screen.getByPlaceholderText('Username')).toHaveAttribute('required');
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('required');
  });
});
