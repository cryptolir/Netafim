/**
 * BusinessChat.js — mind-logistics Business Chat
 * Layout: phone-style chat window on the left + shipment info panel on the right
 */
import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';

// ── Business reference highlighter ───────────────────────────────────────────
function highlightRefs(text) {
  if (!text) return text;
  const combined = /(\b[A-Z]{4}\d{6,7}\b|\b\d{3}-\d{7,10}\b|\b[A-Z]{6,}[A-Z0-9]{4,}\b|\b\d{7}\b)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  combined.lastIndex = 0;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={key++} className="bc-ref-tag" title="Business reference">{match[0]}</span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtDateShort(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg, isMine }) {
  return (
    <div className={`bc-bubble-row ${isMine ? 'bc-bubble-mine' : 'bc-bubble-theirs'}`}>
      {!isMine && (
        <div className="bc-avatar">{msg.avatar || msg.username?.[0]?.toUpperCase() || '?'}</div>
      )}
      <div className="bc-bubble-body">
        {!isMine && <div className="bc-bubble-sender">{msg.username}</div>}
        <div className={`bc-bubble ${isMine ? 'bc-bubble-out' : 'bc-bubble-in'}`}>
          {highlightRefs(msg.text)}
        </div>
        <div className="bc-bubble-time">{formatTime(msg.ts)}</div>
      </div>
      {isMine && (
        <div className="bc-avatar bc-avatar-mine">{msg.avatar || msg.username?.[0]?.toUpperCase() || '?'}</div>
      )}
    </div>
  );
}

function SysMsg({ msg }) {
  return (
    <div className="bc-sys-msg">
      <span>{highlightRefs(msg.text)}</span>
    </div>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ users, groupMembers, onInvite, onClose }) {
  return (
    <div className="cube-modal-overlay" onClick={onClose}>
      <div className="cube-modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="cube-modal-header">
          <span>👥 Invite Members</span>
          <button className="cube-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cube-modal-body">
          {users.map(u => {
            const isMember = groupMembers.includes(u.id);
            return (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="bc-avatar" style={{ width: 32, height: 32, fontSize: 14 }}>{u.avatar}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{u.displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{u.role}</div>
                  </div>
                </div>
                {isMember
                  ? <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>✓ Member</span>
                  : <button className="btn-search" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => onInvite(u.id)}>Invite</button>
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Shipment Info Panel ───────────────────────────────────────────────────────
function ShipmentInfoPanel({ group, token }) {
  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!group) { setTrackData(null); return; }
    const container = (group.containers || [])[0];
    const awb = group.awb;
    if (!container && !awb) { setTrackData(null); return; }
    setLoading(true);
    const url = awb
      ? `/api/containers/air/track/${encodeURIComponent(awb)}`
      : `/api/containers/track/${encodeURIComponent(container)}`;
    axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setTrackData(r.data))
      .catch(() => setTrackData(null))
      .finally(() => setLoading(false));
  }, [group, token]);

  if (!group) {
    return (
      <div className="bc-info-panel bc-info-empty">
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 6 }}>Shipment Details</div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
          Select a shipment group to view live tracking details here.
        </div>
      </div>
    );
  }

  // ── Sea shipment ──────────────────────────────────────────────────────────
  if (group.type === 'sea' && trackData) {
    const meta = trackData.data?.metadata || {};
    const locs = trackData.data?.locations || [];
    const route = trackData.data?.route || {};
    const vessels = trackData.data?.vessels || [];
    const containers = trackData.data?.containers || [];
    const locById = (id) => locs.find(l => l.id === id);
    const polLoc = locById(route.pol?.location);
    const podLoc = locById(route.pod?.location);
    const vessel = vessels[0];
    const ctr = containers[0] || {};
    const status = meta.status || 'UNKNOWN';
    const statusColor = status === 'DELIVERED' ? '#16a34a' : status === 'IN_TRANSIT' ? '#2563eb' : '#d97706';
    const events = (ctr.events || []).slice(0, 5);

    return (
      <div className="bc-info-panel">
        <div className="bc-info-header">
          <span>🚢 {group.name}</span>
          <span className="bc-info-status" style={{ background: statusColor }}>{status.replace(/_/g, ' ')}</span>
        </div>

        {/* Route */}
        <div className="bc-info-route">
          <div className="bc-info-port">
            <div className="bc-info-port-code">{polLoc?.locode || '—'}</div>
            <div className="bc-info-port-name">{polLoc?.name || 'Origin'}</div>
            <div className="bc-info-port-date">{fmtDateShort(route.pol?.date)}</div>
          </div>
          <div className="bc-info-route-arrow">
            <div className="bc-info-route-line" />
            <div className="bc-info-route-label">{vessel?.name || '—'}</div>
          </div>
          <div className="bc-info-port">
            <div className="bc-info-port-code">{podLoc?.locode || '—'}</div>
            <div className="bc-info-port-name">{podLoc?.name || 'Destination'}</div>
            <div className="bc-info-port-date">ETA: {fmtDateShort(route.pod?.date)}</div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="bc-info-meta">
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">MBL</div>
            <div className="bc-info-meta-value">{group.mbl || '—'}</div>
          </div>
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">Carrier</div>
            <div className="bc-info-meta-value">{meta.sealine_name || meta.sealine || '—'}</div>
          </div>
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">Container</div>
            <div className="bc-info-meta-value">{(group.containers || []).join(', ') || '—'}</div>
          </div>
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">Forwarder</div>
            <div className="bc-info-meta-value">{group.fwd || '—'}</div>
          </div>
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">Container Type</div>
            <div className="bc-info-meta-value">{ctr.size_type || '—'}</div>
          </div>
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">Last Updated</div>
            <div className="bc-info-meta-value">{fmtDateShort(meta.updated_at)}</div>
          </div>
        </div>

        {/* Recent events */}
        {events.length > 0 && (
          <div className="bc-info-events">
            <div className="bc-info-events-title">Recent Events</div>
            {events.map((ev, i) => (
              <div key={i} className="bc-info-event-row">
                <div className="bc-info-event-dot" />
                <div className="bc-info-event-text">
                  <span className="bc-info-event-desc">{ev.description || ev.status}</span>
                  <span className="bc-info-event-date">{fmtDateShort(ev.date)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && <div className="bc-info-loading">Refreshing…</div>}
      </div>
    );
  }

  // ── Air shipment ──────────────────────────────────────────────────────────
  if (group.type === 'air' && trackData) {
    const info = trackData.data || {};
    const meta = trackData.metadata || {};
    const isFallback = trackData.isFallback;
    const originCode = info.origin ? (info.origin.match(/\(([^)]+)\)/)?.[1] || 'TLV') : 'TLV';
    const originName = info.origin ? info.origin.replace(/\s*\([^)]*\)/, '') : 'Tel Aviv';
    const destCode = info.destination ? (info.destination.match(/\(([^)]+)\)/)?.[1] || info.destination.slice(0,3).toUpperCase()) : '—';
    const destName = info.destination ? info.destination.replace(/\s*\([^)]*\)/, '') : '—';

    return (
      <div className="bc-info-panel">
        <div className="bc-info-header">
          <span>✈️ {group.name}</span>
          <span className="bc-info-status" style={{ background: '#2563eb' }}>IN TRANSIT</span>
        </div>

        <div className="bc-info-route">
          <div className="bc-info-port">
            <div className="bc-info-port-code">{originCode}</div>
            <div className="bc-info-port-name">{originName}</div>
          </div>
          <div className="bc-info-route-arrow">
            <div className="bc-info-route-line" />
            <div className="bc-info-route-label">✈️ Air Export</div>
          </div>
          <div className="bc-info-port">
            <div className="bc-info-port-code">{destCode}</div>
            <div className="bc-info-port-name">{destName}</div>
          </div>
        </div>

        <div className="bc-info-meta">
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">AWB</div>
            <div className="bc-info-meta-value">{info.awb || group.awb || '—'}</div>
          </div>
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">Shipment No.</div>
            <div className="bc-info-meta-value">{info.shipmentNo || '—'}</div>
          </div>
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">Forwarder</div>
            <div className="bc-info-meta-value">{info.forwarder || group.fwd || '—'}</div>
          </div>
          <div className="bc-info-meta-item">
            <div className="bc-info-meta-label">Type</div>
            <div className="bc-info-meta-value">{info.type || 'Air Export'}</div>
          </div>
          {!isFallback && meta.airline?.name && (
            <div className="bc-info-meta-item">
              <div className="bc-info-meta-label">Airline</div>
              <div className="bc-info-meta-value">{meta.airline.name}</div>
            </div>
          )}
          {!isFallback && info.flight_number && (
            <div className="bc-info-meta-item">
              <div className="bc-info-meta-label">Flight</div>
              <div className="bc-info-meta-value">{info.flight_number}</div>
            </div>
          )}
        </div>

        {loading && <div className="bc-info-loading">Refreshing…</div>}
      </div>
    );
  }

  // ── Loading / no data ─────────────────────────────────────────────────────
  return (
    <div className="bc-info-panel bc-info-empty">
      {loading
        ? <div className="bc-info-loading" style={{ marginTop: 40 }}>Loading shipment data…</div>
        : (
          <>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 4 }}>{group.name}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{group.subtitle}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-300)', marginTop: 8 }}>Live data unavailable</div>
          </>
        )
      }
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BusinessChat() {
  const { token, user } = useContext(AuthContext);
  const myId = user?.id;
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [allGroups, setAllGroups] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeGroupData, setActiveGroupData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [showInvite, setShowInvite] = useState(false);

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const dropdownRef = useRef(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await axios.get('/api/biz-chat/groups', { headers: authHeaders });
      const gs = res.data.groups || [];
      setAllGroups(gs);
      if (!searchQ.trim()) setGroups(gs);
    } catch (e) { console.error('fetchGroups', e); }
    finally { setGroupsLoading(false); }
  }, [token]); // eslint-disable-line

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  useEffect(() => {
    if (!searchQ.trim()) { setGroups(allGroups); return; }
    const lq = searchQ.toLowerCase();
    setGroups(allGroups.filter(g =>
      g.name.toLowerCase().includes(lq) ||
      (g.mbl || '').toLowerCase().includes(lq) ||
      (g.awb || '').toLowerCase().includes(lq) ||
      (g.containers || []).some(c => c.toLowerCase().includes(lq)) ||
      (g.subtitle || '').toLowerCase().includes(lq)
    ));
    setShowDropdown(true);
  }, [searchQ, allGroups]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchMessages = useCallback(async (groupId) => {
    if (!groupId) return;
    try {
      const res = await axios.get(`/api/biz-chat/groups/${encodeURIComponent(groupId)}/messages`, { headers: authHeaders });
      setMessages(res.data.messages || []);
    } catch (e) { console.error('fetchMessages', e); }
  }, [token]); // eslint-disable-line

  useEffect(() => {
    if (!activeGroup) return;
    setMsgsLoading(true);
    fetchMessages(activeGroup).finally(() => setMsgsLoading(false));
    pollRef.current = setInterval(() => fetchMessages(activeGroup), 5000);
    return () => clearInterval(pollRef.current);
  }, [activeGroup, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    axios.get('/api/biz-chat/users', { headers: authHeaders })
      .then(r => setAllUsers(r.data.users || []))
      .catch(() => {});
  }, [token]); // eslint-disable-line

  const selectGroup = (g) => {
    setActiveGroup(g.id);
    setActiveGroupData(g);
    setMessages([]);
    setSearchQ('');
    setShowDropdown(false);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !activeGroup || sending) return;
    setSending(true);
    try {
      const res = await axios.post(
        `/api/biz-chat/groups/${encodeURIComponent(activeGroup)}/messages`,
        { text: inputText.trim() },
        { headers: authHeaders }
      );
      setMessages(prev => [...prev, res.data.message]);
      setInputText('');
      fetchGroups();
    } catch (e) { console.error('sendMessage', e); }
    finally { setSending(false); }
  };

  const inviteMember = async (userId) => {
    if (!activeGroup) return;
    try {
      const res = await axios.post(
        `/api/biz-chat/groups/${encodeURIComponent(activeGroup)}/invite`,
        { userId },
        { headers: authHeaders }
      );
      setActiveGroupData(prev => prev ? { ...prev, members: res.data.members } : prev);
      fetchMessages(activeGroup);
    } catch (e) { console.error('inviteMember', e); }
  };

  return (
    <div className="bc-root">
      {/* ── SPLIT LAYOUT: phone chat left + info panel right ── */}
      <div className="bc-split">

        {/* ── LEFT: Phone-style chat ── */}
        <div className="bc-phone-wrap">
          <div className="bc-phone">

            {/* Phone top bar */}
            <div className="bc-phone-topbar">
              <div className="bc-group-selector" ref={dropdownRef}>
                <div className="bc-group-selector-input-wrap">
                  <span className="bc-search-icon">🔍</span>
                  <input
                    className="bc-group-selector-input"
                    placeholder={activeGroupData
                      ? `${activeGroupData.icon} ${activeGroupData.name}`
                      : 'Search shipment, MBL, container…'}
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {searchQ && (
                    <button className="bc-search-clear" onClick={() => { setSearchQ(''); setShowDropdown(false); }}>✕</button>
                  )}
                </div>
                {showDropdown && (
                  <div className="bc-group-dropdown">
                    {groupsLoading && <div className="bc-dropdown-empty">Loading…</div>}
                    {!groupsLoading && groups.length === 0 && <div className="bc-dropdown-empty">No groups found</div>}
                    {groups.map(g => (
                      <div
                        key={g.id}
                        className={`bc-dropdown-item ${activeGroup === g.id ? 'bc-dropdown-item-active' : ''}`}
                        onClick={() => selectGroup(g)}
                      >
                        <span className="bc-dropdown-icon">{g.icon}</span>
                        <div className="bc-dropdown-info">
                          <span className="bc-dropdown-name">{g.name}</span>
                          <span className="bc-dropdown-sub">{g.subtitle}</span>
                        </div>
                        {g.lastTs && <span className="bc-dropdown-date">{formatDate(g.lastTs)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {activeGroupData && (
                <button
                  className="btn-search"
                  style={{ padding: '4px 10px', fontSize: 11, whiteSpace: 'nowrap', marginTop: 4 }}
                  onClick={() => setShowInvite(true)}
                >
                  👥
                </button>
              )}
            </div>

            {/* Group banner */}
            {activeGroupData && (
              <div className="bc-group-banner">
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--navy)' }}>
                  {activeGroupData.icon} {activeGroupData.name}
                </span>
                {activeGroupData.mbl && (
                  <span className="bc-ref-tag" style={{ marginLeft: 6, fontSize: 10 }}>{activeGroupData.mbl}</span>
                )}
                {activeGroupData.awb && (
                  <span className="bc-ref-tag" style={{ marginLeft: 6, fontSize: 10 }}>{activeGroupData.awb}</span>
                )}
                {(activeGroupData.containers || []).map(c => (
                  <span key={c} className="bc-ref-tag" style={{ marginLeft: 4, fontSize: 10 }}>{c}</span>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="bc-messages">
              {!activeGroup && (
                <div className="bc-empty">
                  <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 6 }}>
                    Select a shipment group
                  </div>
                  <div style={{ color: 'var(--gray-500)', fontSize: 12, textAlign: 'center' }}>
                    Search by shipment number, container ID, MBL, or AWB.
                  </div>
                </div>
              )}
              {msgsLoading && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--gray-400)', fontSize: 12 }}>Loading…</div>
              )}
              {messages.map(msg =>
                msg.userId === 0
                  ? <SysMsg key={msg.id} msg={msg} />
                  : <MsgBubble key={msg.id} msg={msg} isMine={msg.userId === myId} />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {activeGroup && (
              <div className="bc-input-row">
                <input
                  className="bc-input"
                  placeholder="Type a message…"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={sending}
                />
                <button
                  className="btn-search bc-send-btn"
                  onClick={sendMessage}
                  disabled={sending || !inputText.trim()}
                >
                  {sending ? '…' : '➤'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Shipment info panel ── */}
        <div className="bc-info-wrap">
          <ShipmentInfoPanel group={activeGroupData} token={token} />
        </div>

      </div>

      {showInvite && activeGroupData && (
        <InviteModal
          users={allUsers}
          groupMembers={activeGroupData.members || []}
          onInvite={async (uid) => { await inviteMember(uid); }}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}
