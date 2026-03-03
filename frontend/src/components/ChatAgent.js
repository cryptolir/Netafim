import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function ChatAgent() {
  const { token } = useContext(AuthContext);
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const send = async () => {
    if (!input.trim()) return;
    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    try {
      const res = await axios.post(
        '/api/chat',
        { message: input },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const reply = res.data.reply || res.data.answer || res.data;
      setMessages((prev) => [...prev, { sender: 'agent', text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'agent', text: t('chat_error') }]);
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
      <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.5rem' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
            <strong>{msg.sender === 'user' ? t('you') : t('agent')}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('ask_something')}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        style={{ width: '80%' }}
      />
      <button onClick={send} style={{ marginLeft: '0.5rem' }}>
        {t('send')}
      </button>
    </div>
  );
}