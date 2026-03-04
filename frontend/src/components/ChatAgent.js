import React, { useState, useContext, useRef, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function ChatAgent() {
  const { token } = useContext(AuthContext);
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    const userMessage = { sender: 'user', text: userText };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Build history in OpenAI format for context
    const history = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    try {
      const res = await axios.post(
        '/api/chat',
        { message: userText, history },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const reply = res.data.reply || res.data.answer || JSON.stringify(res.data);
      setMessages((prev) => [...prev, { sender: 'agent', text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'agent', text: t('chat_error') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
      <div
        style={{
          maxHeight: '300px',
          overflowY: 'auto',
          marginBottom: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#888', fontStyle: 'italic', fontSize: '0.9rem' }}>
            {t('ask_something')}...
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              textAlign: msg.sender === 'user' ? 'right' : 'left',
              padding: '0.3rem 0'
            }}
          >
            <strong>{msg.sender === 'user' ? t('you') : t('agent')}:</strong>{' '}
            <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'left', color: '#888', fontStyle: 'italic' }}>
            <strong>{t('agent')}:</strong> ...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('ask_something')}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          style={{ flex: 1, padding: '0.4rem' }}
          disabled={loading}
        />
        <button onClick={send} disabled={loading} style={{ padding: '0.4rem 0.8rem' }}>
          {loading ? '...' : t('send')}
        </button>
      </div>
    </div>
  );
}
