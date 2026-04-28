/**
 * BusinessChat.js — Netafim Business Chat
 * Layout: top search/selector bar + full-width message thread
 * Business references (container/shipment/MBL/AWB) are highlighted inline.
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

  // ── Fetch groups ─────────────────────────────────────────────────────────
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

  // ── Filter groups ────────────────────────────────────────────────────────
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

  // ── Close dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch messages ───────────────────────────────────────────────────────
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

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load users ───────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get('/api/biz-chat/users', { headers: authHeaders })
      .then(r => setAllUsers(r.data.users || []))
      .catch(() => {});
  }, [token]); // eslint-disable-line

  // ── Select group ─────────────────────────────────────────────────────────
  const selectGroup = (g) => {
    setActiveGroup(g.id);
    setActiveGroupData(g);
    setMessages([]);
    setSearchQ('');
    setShowDropdown(false);
  };

  // ── Send message ─────────────────────────────────────────────────────────
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

  // ── Invite member ────────────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bc-root">

      {/* ── TOP BAR ── */}
      <div className="bc-topbar">
        <div className="bc-topbar-left">
          <div className="bc-group-selector" ref={dropdownRef}>
            <div className="bc-group-selector-input-wrap">
              <span className="bc-search-icon">🔍</span>
              <input
                className="bc-group-selector-input"
                placeholder={activeGroupData
                  ? `${activeGroupData.icon} ${activeGroupData.name}`
                  : 'Search shipment, container, MBL, AWB…'}
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
        </div>

        {activeGroupData && (
          <div className="bc-topbar-right">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {(activeGroupData.members || []).slice(0, 4).map(uid => {
                const u = allUsers.find(x => x.id === uid);
                return u ? (
                  <div key={uid} className="bc-avatar" title={u.displayName} style={{ width: 28, height: 28, fontSize: 12 }}>{u.avatar}</div>
                ) : null;
              })}
            </div>
            <button
              className="btn-search"
              style={{ padding: '5px 14px', fontSize: 12, whiteSpace: 'nowrap' }}
              onClick={() => setShowInvite(true)}
            >
              👥 Invite
            </button>
          </div>
        )}
      </div>

      {/* ── CHAT AREA ── */}
      {!activeGroup ? (
        <div className="bc-empty">
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)', marginBottom: 8 }}>
            Select a shipment group to start chatting
          </div>
          <div style={{ color: 'var(--gray-500)', fontSize: 14, maxWidth: 400, textAlign: 'center' }}>
            Use the search box above to find a shipment by number, container ID, MBL, or AWB.
          </div>
        </div>
      ) : (
        <>
          {/* Group context banner */}
          <div className="bc-group-banner">
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>
              {activeGroupData?.icon} {activeGroupData?.name}
            </span>
            <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 12 }}>
              {activeGroupData?.subtitle}
            </span>
            {activeGroupData?.mbl && (
              <span className="bc-ref-tag" style={{ marginLeft: 10 }}>{activeGroupData.mbl}</span>
            )}
            {activeGroupData?.awb && (
              <span className="bc-ref-tag" style={{ marginLeft: 10 }}>{activeGroupData.awb}</span>
            )}
            {(activeGroupData?.containers || []).map(c => (
              <span key={c} className="bc-ref-tag" style={{ marginLeft: 4 }}>{c}</span>
            ))}
          </div>

          {/* Messages */}
          <div className="bc-messages">
            {msgsLoading && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</div>
            )}
            {messages.map(msg =>
              msg.userId === 0
                ? <SysMsg key={msg.id} msg={msg} />
                : <MsgBubble key={msg.id} msg={msg} isMine={msg.userId === myId} />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bc-input-row">
            <input
              className="bc-input"
              placeholder="Type a message… container numbers and shipment refs will be highlighted"
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
              {sending ? '…' : '➤ Send'}
            </button>
          </div>
        </>
      )}

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
