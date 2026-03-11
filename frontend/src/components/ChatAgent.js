import React, { useState, useContext, useRef, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const SUGGESTIONS = [
  '🚢 Where is container MSCU1234567?',
  '✈️ Air cargo rates Tel Aviv to Paris?',
  '📅 Schedules from Ashdod to Hamburg?',
  '✈️ Flight schedules TLV to CDG?',
  '💰 Freight rate Shanghai to Rotterdam?',
  '📦 What is the difference between air and sea freight?',
  '🌍 Sea distance Haifa to Rotterdam?',
  '✈️ Air transit time TLV to JFK?',
];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatAgent({ airTrackingData, airSchedulesData }) {
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

  // Build context summary from air data to inject into chat
  const buildAirContext = () => {
    const parts = [];
    if (airTrackingData) {
      const info = airTrackingData.data || airTrackingData;
      const meta = airTrackingData.metadata || {};
      const awb = meta.request_parameters?.number || '';
      const status = info.status || '';
      const from = info.from?.iata_code || '';
      const to = info.to?.iata_code || '';
      const airline = meta.airline?.name || '';
      if (awb) parts.push(`Active air tracking: AWB ${awb}, ${airline}, ${from}→${to}, status: ${status}.`);
    }
    if (airSchedulesData) {
      const trips = Array.isArray(airSchedulesData) ? airSchedulesData
        : airSchedulesData.data?.trips || airSchedulesData.trips || airSchedulesData.data || [];
      if (Array.isArray(trips) && trips.length > 0) {
        parts.push(`Air schedules loaded: ${trips.length} flight options available.`);
      }
    }
    return parts.join(' ');
  };

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

    // Inject air context if relevant
    const airContext = buildAirContext();
    const enrichedMessage = airContext
      ? `[Context: ${airContext}]\n\n${msgText}`
      : msgText;

    try {
      const res = await axios.post(
        '/api/chat',
        { message: enrichedMessage, history, sessionId: sessionId.current },
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

  // Show air context badge if air data is loaded
  const hasAirContext = !!(airTrackingData || airSchedulesData);

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
            {hasAirContext && (
              <span className="air-context-badge">✈️ Air data loaded</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="welcome-icon">🌊</div>
            <p>
              Ask me anything about your shipments — sea or air — including container tracking,
              AWB tracking, vessel &amp; flight schedules, freight rates, and more.
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
          placeholder="Ask about sea or air shipments, rates, schedules..."
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
