/**
 * Business Chat API — in-memory store
 * Groups are seeded from hardcoded shipment data (sea + air).
 * Messages reset on redeploy (MVP).
 *
 * Routes:
 *   GET  /api/biz-chat/groups
 *   GET  /api/biz-chat/groups/:id/messages
 *   POST /api/biz-chat/groups/:id/messages
 *   POST /api/biz-chat/groups/:id/invite
 *   GET  /api/biz-chat/users
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');

// ── Static users (mirrors auth.js) ───────────────────────────────────────────
const USERS = [
  { id: 1, username: 'admin',  displayName: 'Admin',       role: 'admin',  avatar: '🛡️' },
  { id: 2, username: 'client', displayName: 'Client User', role: 'client', avatar: '👤' },
];

// ── Seed data — sea shipments ─────────────────────────────────────────────────
const SEA_SHIPMENTS = [
  { shipmentNo: '3007283', mbl: 'ZIMUMER25802993', fwd: 'BDL',        containers: ['ZCSU7221847'] },
  { shipmentNo: '3007304', mbl: 'MEDUXK674836',   fwd: 'BDL',        containers: ['BMOU6008700'] },
  { shipmentNo: '3007344', mbl: 'MEDUXK687986',   fwd: 'BDL',        containers: ['CAIU7795981'] },
  { shipmentNo: '2033991', mbl: 'MEDUKM036373',   fwd: 'Rosenthal',  containers: ['TRHU7345364', 'MSCU5191379'] },
  { shipmentNo: '2034060', mbl: 'MEDUKM045440',   fwd: 'Rosenthal',  containers: ['MEDU8765745'] },
  { shipmentNo: '2034062', mbl: 'MEDUKM045788',   fwd: 'Rosenthal',  containers: ['MSNU5191379'] },
  { shipmentNo: '3007325', mbl: '265573092',       fwd: 'UNICARGO',   containers: ['TRLU7537616', 'MRKU2345678'] },
  { shipmentNo: '3007333', mbl: 'MEDUKM051234',   fwd: 'Rosenthal',  containers: ['MRSU7660635', 'MSKU1234567'] },
  { shipmentNo: '3007315', mbl: 'COSU6123456',    fwd: 'BDL',        containers: ['CSLU2384211'] },
  { shipmentNo: '3007302', mbl: 'HLCUTEL210001',  fwd: 'UNICARGO',   containers: ['HLXU3456789'] },
  { shipmentNo: '2034100', mbl: 'MEDUKM060001',   fwd: 'Rosenthal',  containers: ['MSCU6789012'] },
  { shipmentNo: '3007290', mbl: 'ZIMUMER26000001',fwd: 'BDL',        containers: ['ZCSU8901234'] },
];

// ── Seed data — air shipments ─────────────────────────────────────────────────
const AIR_SHIPMENTS = [
  { shipmentNo: '2440348', awb: '700-5128021300', fwd: 'FC',    route: 'TLV → Jakarta' },
  { shipmentNo: '2440321', awb: '716-0188634',    fwd: 'FC',    route: 'TLV → Cape Town' },
  { shipmentNo: '2440290', awb: '020-17363006',   fwd: 'Fritz', route: 'TLV → Sydney' },
];

// ── Build initial groups ──────────────────────────────────────────────────────
let groups = [];
let msgStore = {};   // groupId -> [{ id, userId, username, avatar, text, ts }]
let nextMsgId = 1;

function seedGroups() {
  groups = [];
  msgStore = {};

  SEA_SHIPMENTS.forEach(s => {
    const gid = `sea-${s.shipmentNo}`;
    const containerList = s.containers.join(', ');
    groups.push({
      id: gid,
      type: 'sea',
      icon: '🚢',
      name: s.shipmentNo,
      subtitle: `MBL: ${s.mbl} · ${s.fwd}`,
      mbl: s.mbl,
      fwd: s.fwd,
      containers: s.containers,
      members: [1, 2],
      lastTs: null,
      lastText: null,
    });
    msgStore[gid] = [
      {
        id: nextMsgId++,
        userId: 0,
        username: 'System',
        avatar: '🔔',
        text: `Shipment group opened for ${s.shipmentNo} · Containers: ${containerList}`,
        ts: new Date().toISOString(),
      },
    ];
  });

  AIR_SHIPMENTS.forEach(s => {
    const gid = `air-${s.awb}`;
    groups.push({
      id: gid,
      type: 'air',
      icon: '✈️',
      name: s.awb,
      subtitle: `${s.route} · ${s.fwd}`,
      awb: s.awb,
      fwd: s.fwd,
      containers: [],
      members: [1, 2],
      lastTs: null,
      lastText: null,
    });
    msgStore[gid] = [
      {
        id: nextMsgId++,
        userId: 0,
        username: 'System',
        avatar: '🔔',
        text: `Air shipment group opened for AWB ${s.awb} · Route: ${s.route}`,
        ts: new Date().toISOString(),
      },
    ];
  });
}

seedGroups();

// ── Helper ────────────────────────────────────────────────────────────────────
function getGroup(id) {
  return groups.find(g => g.id === id);
}

// ── GET /api/biz-chat/groups ──────────────────────────────────────────────────
router.get('/groups', authenticateToken, (req, res) => {
  const result = groups.map(g => ({
    ...g,
    lastTs:   msgStore[g.id]?.slice(-1)[0]?.ts   || null,
    lastText: msgStore[g.id]?.slice(-1)[0]?.text  || null,
  }));
  res.json({ groups: result });
});

// ── GET /api/biz-chat/groups/:id/messages ────────────────────────────────────
router.get('/groups/:id/messages', authenticateToken, (req, res) => {
  const g = getGroup(req.params.id);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  res.json({ messages: msgStore[g.id] || [] });
});

// ── POST /api/biz-chat/groups/:id/messages ───────────────────────────────────
router.post('/groups/:id/messages', authenticateToken, (req, res) => {
  const g = getGroup(req.params.id);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });

  const sender = USERS.find(u => u.id === req.user.id) || { displayName: req.user.username, avatar: '👤' };
  const msg = {
    id: nextMsgId++,
    userId: req.user.id,
    username: sender.displayName,
    avatar: sender.avatar,
    text: text.trim(),
    ts: new Date().toISOString(),
  };
  msgStore[g.id].push(msg);
  res.json({ message: msg });
});

// ── POST /api/biz-chat/groups/:id/invite ─────────────────────────────────────
router.post('/groups/:id/invite', authenticateToken, (req, res) => {
  const g = getGroup(req.params.id);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  const { userId } = req.body;
  const user = USERS.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!g.members.includes(userId)) {
    g.members.push(userId);
    msgStore[g.id].push({
      id: nextMsgId++,
      userId: 0,
      username: 'System',
      avatar: '🔔',
      text: `${user.displayName} was added to the group.`,
      ts: new Date().toISOString(),
    });
  }
  res.json({ members: g.members });
});

// ── GET /api/biz-chat/users ───────────────────────────────────────────────────
router.get('/users', authenticateToken, (req, res) => {
  res.json({ users: USERS });
});

module.exports = router;
