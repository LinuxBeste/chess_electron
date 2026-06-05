/**
 * Chat — in-game text chat via WebSocket.
 *
 * Messages arrive through the socketManager.onChat subscription and
 * are rendered with a "You"/opponent distinction using the local playerId.
 * Sending uses the socketManager.send() method with a chat_message type.
 */

import { useState, useRef, useEffect } from 'react';
import { socketManager } from '../socket';
import { store } from '../store';

interface ChatMessage {
  playerId: string;
  username: string;
  text: string;
}

interface ChatProps {
  gameId: string;
}

export default function Chat({ gameId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  /* Subscribe to incoming chat messages.  The unsubscribe function is
     returned from useEffect's cleanup to prevent duplicates on re-render. */
  useEffect(() => {
    const unsub = socketManager.onChat((msg) => {
      setMessages((prev) => [...prev, msg as ChatMessage]);
    });
    return () => unsub();
  }, []);

  /* Auto-scroll to bottom when a new message arrives */
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    socketManager.send({ type: 'chat_message', gameId, text });
    setInput('');
  };

  return (
    <>
      <h3 className="sidebar-title" style={{ marginTop: 8 }}>
        Chat
      </h3>
      <div ref={listRef} className="sidebar-panel" style={{ minHeight: 80, maxHeight: 150, fontSize: 12, padding: 8 }}>
        {messages.map((msg, i) => {
          const isMe = msg.playerId === store.get('playerId');
          return (
            <div key={i} className={`chat-msg ${isMe ? 'chat-msg-self' : ''}`}>
              <span className="chat-name" style={{ color: isMe ? '#4f8ef7' : '#888' }}>
                {isMe ? 'You' : msg.username}
              </span>
              <span className="chat-text">{msg.text}</span>
            </div>
          );
        })}
      </div>
      <div className="chat-input-row">
        <input
          className="input"
          type="text"
          placeholder="Type a message..."
          style={{ flex: 1, fontSize: 12 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={send}>
          Send
        </button>
      </div>
    </>
  );
}
