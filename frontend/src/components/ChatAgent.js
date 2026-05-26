import React, { useState, useContext, useRef, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

// ── Preset questions based on real shipment data ──────────────────────────
// Sea shipments: MINDTESTforNir11.3.2026SCAC.xlsx
// Air shipments: MINDairshipments23.3.26.xlsx
const PRESET_GROUPS = [
  {
    label: '🚢 Sea Tracking',
    chips: [
      { display: 'Track container MSNU8656572',          text: 'Track container MSNU8656572 — give me the live status and location.' },
      { display: 'Where is MBL ZIMUMER25802993?',        text: 'Track MBL ZIMUMER25802993 and show me its current status.' },
      { display: 'Track container TXGU5057347',          text: 'Track container TXGU5057347 and show me the latest events.' },
      { display: 'Status of shipment 4011676?',          text: 'What is the live tracking status of shipment 4011676 containers?' },
      { display: 'Containers in shipment 3007337?',      text: 'What containers are in shipment 3007337 and what is their status?' },
      { display: 'MBL for shipment 4011660?',            text: 'What is the MBL number for shipment 4011660 handled by DHL?' },
    ]
  },
  {
    label: '✈️ Air Tracking',
    chips: [
      { display: 'Track AWB 70051280213',                text: 'Track air shipment AWB 70051280213 — show me the live flight status and route.' },
      { display: 'Status of AWB 716-0188634?',           text: 'Track air shipment AWB 716-0188634 to Cape Town and show live status.' },
      { display: 'Track AWB 114-64228592 to Lima',       text: 'Track air shipment AWB 114-64228592 to Lima, Peru — show live tracking.' },
      { display: 'Which air shipments go to Jakarta?',   text: 'Which air shipments are destined for Jakarta?' },
      { display: 'Air shipments handled by FC?',         text: 'Which air shipments are handled by forwarder FC?' },
    ]
  },
  {
    label: '🗓️ Schedules & Routes',
    chips: [
      { display: 'Sailings from Ashdod to Hamburg',      text: 'Show me upcoming vessel sailings from Ashdod (ILASH) to Hamburg (DEHAM) in the next 4 weeks.' },
      { display: 'Sailings from Ashdod to Rotterdam',    text: 'What are the upcoming sailings from Ashdod (ILASH) to Rotterdam (NLRTM)?' },
      { display: 'Sailings from Shanghai to Ashdod',     text: 'Show me vessel schedules from Shanghai (CNSHA) to Ashdod (ILASH).' },
      { display: 'ZIM sailings from Ashdod?',            text: 'Are there any ZIM sailings from Ashdod to Hamburg in the next 4 weeks?' },
    ]
  },
  {
    label: '📊 Summary & Analysis',
    chips: [
      { display: 'List all active sea shipments',        text: 'List all active sea shipments with their shipment numbers, containers, and forwarders.' },
      { display: 'List all air shipments',               text: 'List all air shipments with AWB numbers, destinations, and forwarders.' },
      { display: 'Which forwarder handles most cargo?',  text: 'Which freight forwarder handles the most shipments across sea and air?' },
      { display: 'Shipments on ZIM carrier?',            text: 'Which shipments are using ZIM (ZIMU) as the carrier?' },
      { display: 'How many containers in transit?',      text: 'How many sea containers are currently in transit and what are their numbers?' },
    ]
  },
];

// Flat list for the welcome screen (show a sample from each group)
const WELCOME_CHIPS = [
  PRESET_GROUPS[0].chips[0],
  PRESET_GROUPS[1].chips[0],
  PRESET_GROUPS[2].chips[0],
  PRESET_GROUPS[0].chips[1],
  PRESET_GROUPS[1].chips[1],
  PRESET_GROUPS[2].chips[1],
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
  const [showAllPresets, setShowAllPresets] = useState(false);
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
    setShowAllPresets(false);

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

            {/* Quick question chips — welcome screen */}
            <div className="chat-suggestions">
              {WELCOME_CHIPS.map((chip, i) => (
                <button
                  key={i}
                  className="suggestion-chip"
                  onClick={() => sendMessage(chip.text)}
                >
                  {chip.display}
                </button>
              ))}
            </div>

            {/* "More questions" expandable panel */}
            <button
              className="preset-toggle-btn"
              onClick={() => setShowAllPresets(v => !v)}
            >
              {showAllPresets ? '▲ Hide preset questions' : '▼ More preset questions'}
            </button>

            {showAllPresets && (
              <div className="preset-groups">
                {PRESET_GROUPS.map((group, gi) => (
                  <div key={gi} className="preset-group">
                    <div className="preset-group-label">{group.label}</div>
                    <div className="preset-group-chips">
                      {group.chips.map((chip, ci) => (
                        <button
                          key={ci}
                          className="suggestion-chip"
                          onClick={() => sendMessage(chip.text)}
                        >
                          {chip.display}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Floating preset button when conversation is active */}
        {messages.length > 0 && (
          <div className="preset-float-wrap">
            <button
              className="preset-float-btn"
              onClick={() => setShowAllPresets(v => !v)}
              title="Preset questions"
            >
              💬 Presets
            </button>
            {showAllPresets && (
              <div className="preset-dropdown">
                {PRESET_GROUPS.map((group, gi) => (
                  <div key={gi} className="preset-group">
                    <div className="preset-group-label">{group.label}</div>
                    <div className="preset-group-chips">
                      {group.chips.map((chip, ci) => (
                        <button
                          key={ci}
                          className="suggestion-chip"
                          onClick={() => sendMessage(chip.text)}
                        >
                          {chip.display}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
