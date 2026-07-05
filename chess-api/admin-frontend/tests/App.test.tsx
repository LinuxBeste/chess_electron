import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';

vi.mock('../src/api', () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock('../src/LoginPage', () => ({
  default: ({ onLogin }: { onLogin: () => void }) => (
    <div>
      Login Page
      <button onClick={onLogin}>Login</button>
    </div>
  ),
}));

vi.mock('../src/Dashboard', () => ({
  default: ({ onLogout }: { onLogout: () => void }) => (
    <div>
      Dashboard
      <button onClick={onLogout}>Logout</button>
    </div>
  ),
}));

import { getToken } from '../src/api';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders LoginPage when no token', () => {
    vi.mocked(getToken).mockReturnValue(null);
    render(<App />);
    expect(screen.getByText('Login Page')).toBeTruthy();
  });

  test('renders Dashboard when token exists', () => {
    vi.mocked(getToken).mockReturnValue('abc123');
    render(<App />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  test('switches from Login to Dashboard on login', () => {
    vi.mocked(getToken).mockReturnValue(null);
    render(<App />);
    expect(screen.getByText('Login Page')).toBeTruthy();
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  test('switches from Dashboard to Login on logout', () => {
    vi.mocked(getToken).mockReturnValue('abc123');
    render(<App />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    fireEvent.click(screen.getByText('Logout'));
    expect(screen.getByText('Login Page')).toBeTruthy();
  });
});
