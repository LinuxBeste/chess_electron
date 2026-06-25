/**
 * Chat — in-game text chat via WebSocket.
 *
 * Messages arrive through the socketManager.onChat subscription and
 * are rendered with a "You"/opponent distinction using the local playerId.
 * Sending uses the socketManager.send() method with a chat_message type.
 */

import { useState, useRef, useEffect, memo } from 'react';
import { socketManager } from '../socket';
import { store } from '../store';
import { t } from '../translate';
import logger from '../logger';

interface ChatMessage {
  playerId: string;
  username: string;
  text: string;
}

interface ChatProps {
  gameId: string;
}

const Chat = memo(function Chat({ gameId }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  /* Subscribe to chat messages; request history on mount to backfill */
  useEffect(() => {
    socketManager.requestChatHistory(gameId);

    const unsubHistory = socketManager.onChatHistory((msg) => {
      if (msg.gameId === gameId) {
        setMessages(msg.messages.slice(-200));
      }
    });

    const unsub = socketManager.onChat((msg) => {
      const chatMsg = msg as ChatMessage;
      const isMe = chatMsg.playerId === store.get('playerId');
      logger.debug('Chat message received', {
        from: isMe ? 'self' : chatMsg.username,
        length: chatMsg.text.length,
        gameId,
      });
      setMessages((prev) => {
        const next = [...prev, chatMsg];
        if (next.length > 200) next.splice(0, next.length - 200);
        return next;
      });
    });

    return () => {
      unsubHistory();
      unsub();
    };
  }, [gameId]);

  /* Auto-scroll to latest message — only triggers on count change, not individual content */
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    if (messages.length > 0) {
      logger.debug('Chat messages rendered', { count: messages.length, gameId });
    }
  }, [messages.length]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    logger.info('Chat message sent', { length: text.length, gameId });
    socketManager.send({ type: 'chat_message', gameId, text });
    setInput('');
  };

  return (
    <div className="chat-panel">
      <h3 className="sidebar-title" style={{ marginTop: 8 }}>
        {t('chat.title')}
      </h3>
      <div ref={listRef} className="sidebar-panel" style={{ minHeight: 60, maxHeight: 150, fontSize: 12, padding: 8 }}>
        {messages.map((msg, i) => {
          const isMe = msg.playerId === store.get('playerId');
          return (
            <div key={msg.playerId + '-' + i} className={`chat-msg ${isMe ? 'chat-msg-self' : ''}`}>
              <span className="chat-name" style={{ color: isMe ? '#4f8ef7' : '#888' }}>
                {isMe ? t('chat.you') : msg.username}
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
          placeholder={t('chat.placeholder')}
          maxLength={500}
          style={{ flex: 1, fontSize: 12 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={send}>
          {t('chat.send')}
        </button>
      </div>
    </div>
  );
});

export default Chat;
