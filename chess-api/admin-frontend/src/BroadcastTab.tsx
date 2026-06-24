import { useState } from 'react';
import { Send, RotateCcw, MessageSquare, Wrench, Bell, Info, AlertTriangle } from 'lucide-react';
import { api } from './api';
import { useToast } from './Toast';

const TEMPLATES = [
  { label: 'Maintenance', icon: Wrench, message: 'Server will undergo maintenance in 15 minutes. Please finish your games.' },
  { label: 'Tournament Starting', icon: Bell, message: 'A tournament is about to start! Check the tournament page for details.' },
  { label: 'Update', icon: Info, message: 'New features have been deployed! Refresh to get the latest version.' },
  { label: 'Warning', icon: AlertTriangle, message: 'Please refrain from using exploits. Violators will be banned.' },
];

export default function BroadcastTab() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ recipientCount: number } | null>(null);
  const [history, setHistory] = useState<{ text: string; count: number; time: number }[]>([]);
  const { addToast } = useToast();

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await api<{ recipientCount: number }>('/broadcast', {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      });
      setResult(res);
      setHistory((prev) => [{ text: message.trim(), count: res.recipientCount, time: Date.now() }, ...prev].slice(0, 10));
      addToast('Broadcast sent to ' + res.recipientCount + ' players', 'success');
      setMessage('');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSending(false);
    }
  }

  function applyTemplate(template: string) {
    setMessage(template);
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold text-[#e0e0e0] flex items-center gap-2">
            <Send size={16} className="text-blue-400" />
            Send Broadcast Message
          </h2>
        </div>

        <div className="p-6">
          <p className="text-xs text-[#666] mb-4">
            This message will be sent to all currently connected players in real time.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.label}
                  onClick={() => applyTemplate(t.message)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#222] border border-[#333] rounded text-[#aaa] hover:border-[#555] hover:text-[#ccc]"
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your broadcast message here..."
            rows={4}
            className="w-full px-3 py-2 text-sm bg-[#222] border border-[#333] rounded-lg text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#4a9eff] resize-none"
          />

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#4a9eff] text-white rounded-lg hover:bg-[#3a8eef] disabled:opacity-40"
            >
              {sending ? <RotateCcw size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending...' : 'Send Broadcast'}
            </button>

            {result && (
              <span className="text-xs text-green-400">
                Delivered to {result.recipientCount} player{result.recipientCount !== 1 ? 's' : ''}.
              </span>
            )}
          </div>

          {history.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-[#888] uppercase mb-2 flex items-center gap-1">
                <MessageSquare size={12} /> Recent Broadcasts
              </h3>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#222] rounded text-xs">
                    <span className="text-[#ccc] truncate max-w-[300px]">{h.text}</span>
                    <span className="text-[#555] shrink-0 ml-2">
                      {h.count} players · {new Date(h.time).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
