import React, { useState, useContext, useRef, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const SUGGESTIONS = [
  '🚢 Where is container MSCU1234567?',
  '📅 Schedules from Ashdod to Hamburg?',
  '💰 Freight rate Shanghai to Rotterdam?',
  '📦 What is FCL vs LCL shipping?',
  '🌍 Sea distance Haifa to Rotterdam?',
];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatAgent() {
  const { token } = useContext(AuthContext);
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sessionId = useRef(`netafim_${Date.now()}`);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    const userMsg = { sender: 'user', text: msgText, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const history = messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    try {
      const res = await axios.post(
        '/api/chat',
        { message: msgText, history, sessionId: sessionId.current },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 35000 }
      );
      const reply = res.data.reply || res.data.answer || JSON.stringify(res.data);
      setMessages(prev => [...prev, { sender: 'agent', text: reply, time: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        sender: 'agent',
        text: t('chat_error') || 'An error occurred. Please try again.',
        time: new Date(),
        isError: true
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-phone">
      {/* Phone header / notch */}
      <div className="chat-phone-notch">
        <div className="agent-avatar">🤖</div>
        <div className="agent-info">
          <div className="agent-name">Netafim AI Assistant</div>
          <div className="agent-status">
            <span className="online-dot" />
            Powered by SeaRates AI
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="welcome-icon">🌊</div>
            <p>
              Ask me anything about your shipments, container tracking,
              vessel schedules, freight rates, and more.
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => sendMessage(s.replace(/^[^\s]+\s/, ''))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-bubble-wrap ${msg.sender}`}>
            <div className={`chat-bubble ${msg.isError ? 'error' : ''}`}>
              {msg.text}
            </div>
            <div className="chat-time">{formatTime(msg.time)}</div>
          </div>
        ))}

        {loading && (
          <div className="chat-bubble-wrap agent">
            <div className="chat-typing">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about shipments, rates, schedules..."
          rows={1}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
