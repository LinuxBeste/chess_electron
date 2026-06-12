import { useState } from 'react';
import { Send, RotateCcw } from 'lucide-react';
import { api } from './api';
import { useToast } from './Toast';

export default function BroadcastTab() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ recipientCount: number } | null>(null);
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
      addToast('Broadcast sent to ' + res.recipientCount + ' players', 'success');
      setMessage('');
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      setSending(false);
    }
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
        </div>
      </div>
    </div>
  );
}
