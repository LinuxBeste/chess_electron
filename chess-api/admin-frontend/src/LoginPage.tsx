import { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { api, setToken } from './api';

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api<{ token: string }>('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(data.token);
      onLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 w-[340px] flex flex-col gap-3"
      >
        <h1 className="text-xl font-semibold text-center mb-2">Chess API Admin</h1>
        <input
          className="px-3 py-2.5 border border-[#333] rounded-lg bg-[#222] text-[#e0e0e0] text-sm outline-none focus:border-[#4a9eff]"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
        />
        <input
          className="px-3 py-2.5 border border-[#333] rounded-lg bg-[#222] text-[#e0e0e0] text-sm outline-none focus:border-[#4a9eff]"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="mt-1 px-3 py-2.5 bg-[#4a9eff] text-white rounded-lg text-sm font-semibold hover:bg-[#3a8eef] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <LogIn size={16} />
          {loading ? 'Logging in...' : 'Login'}
        </button>
        {error && <p className="text-red-500 text-xs text-center">{error}</p>}
      </form>
    </div>
  );
}
