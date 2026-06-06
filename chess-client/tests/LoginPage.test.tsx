import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../src/renderer/pages/LoginPage';
import { store } from '../src/renderer/store';

jest.mock('../src/renderer/api', () => ({
  register: jest.fn(),
  login: jest.fn(),
  setBaseUrl: jest.fn(),
}));

describe('LoginPage — offline mode', () => {
  beforeEach(() => {
    store.set('token', null);
    store.set('playerId', null);
    store.set('username', null);
    store.set('offline', false);

    (window as any).electronAPI = undefined;
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
  }

  test('renders mode tabs', () => {
    renderPage();
    expect(screen.getByText('Quick Play')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
    expect(screen.getByText('Register')).toBeTruthy();
  });

  test('shows offline toggle in Quick Play mode', () => {
    renderPage();
    expect(screen.getByText('Offline mode')).toBeTruthy();
    expect(screen.getByText(/Play locally without a server/)).toBeTruthy();
  });

  test('offline toggle is not active by default', () => {
    const { container } = renderPage();
    const toggle = container.querySelector('.toggle')!;
    expect(toggle.className).not.toContain('active');
  });

  test('clicking offline toggle activates it', () => {
    const { container } = renderPage();
    const toggle = container.querySelector('.toggle')!;
    fireEvent.click(toggle);
    expect(toggle.className).toContain('active');
  });

  test('clicking offline toggle twice deactivates it', () => {
    const { container } = renderPage();
    const toggle = container.querySelector('.toggle')!;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle.className).not.toContain('active');
  });

  test('offline toggle hidden when switched to Sign In', () => {
    renderPage();
    fireEvent.click(screen.getByText('Sign In'));
    expect(screen.queryByText('Offline mode')).toBeNull();
  });

  test('offline toggle hidden when switched to Register', () => {
    renderPage();
    fireEvent.click(screen.getByText('Register'));
    expect(screen.queryByText('Offline mode')).toBeNull();
  });

  test('reappears when switching back to Quick Play from Sign In', () => {
    renderPage();
    fireEvent.click(screen.getByText('Sign In'));
    fireEvent.click(screen.getByText('Quick Play'));
    expect(screen.getByText('Offline mode')).toBeTruthy();
  });

  test('does not enter offline mode with empty name when Enter pressed', () => {
    const { container } = renderPage();
    const toggle = container.querySelector('.toggle')!;
    fireEvent.click(toggle);
    const nameInput = screen.getByPlaceholderText('Enter your display name');
    act(() => {
      fireEvent.keyDown(nameInput, { key: 'Enter' });
    });
    expect(store.get('username')).toBeNull();
    expect(store.get('offline')).toBe(false);
  });

  test('enters offline mode with valid name when toggle is active', () => {
    const { container } = renderPage();
    const toggle = container.querySelector('.toggle')!;
    fireEvent.click(toggle);
    const nameInput = screen.getByPlaceholderText('Enter your display name');
    fireEvent.change(nameInput, { target: { value: 'TestPlayer' } });
    act(() => {
      fireEvent.keyDown(nameInput, { key: 'Enter' });
    });
    expect(store.get('username')).toBe('TestPlayer');
    expect(store.get('offline')).toBe(true);
  });

  test('submit button text is Enter for Quick Play', () => {
    renderPage();
    expect(screen.getByText('Enter')).toBeTruthy();
  });
});
