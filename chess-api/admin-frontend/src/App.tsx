import { useState } from 'react';
import { getToken } from './api';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());

  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />;
  return <Dashboard onLogout={() => setLoggedIn(false)} />;
}
