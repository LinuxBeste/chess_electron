import { useState } from 'react';
import { getToken } from './api';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

export default function App() {
  // lazy init from localStorage to avoid login flash on reload
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());

  // simple toggle between auth gate and main dashboard
  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />;
  return <Dashboard onLogout={() => setLoggedIn(false)} />;
}
