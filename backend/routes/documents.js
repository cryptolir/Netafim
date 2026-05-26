/**
 * Documents & Reports API
 *
 * Routes:
 *   GET /api/documents/all                       — list all containers and their docs
 *   GET /api/documents/reports/list              — list available reports
 *   GET /api/documents/reports/download/:key     — serve a report PDF
 *   GET /api/documents/download/:filename        — serve a document PDF
 *   GET /api/documents/:containerNo              — list docs for a specific container
 */
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { authenticateToken } = require('../middlewares/authMiddleware');

const DOCS_DIR = path.join(__dirname, '..', '..', 'sample_documents');

// Human-readable labels for each document type code
const DOC_LABELS = {
  AWB:         { label: 'Air Waybill',             icon: '\u2708\ufe0f' },
  BL_DRAFT:    { label: 'Bill of Lading (Draft)', icon: '\ud83d\udcc4' },
  SWB:         { label: 'Sea Waybill',             icon: '\ud83c\udf0a' },
  INV:         { label: 'Commercial Invoice',      icon: '\ud83e\uddfe' },
  PROFORMA_INV:{ label: 'Proforma Invoice',        icon: '\ud83d\udccb' },
  PL:          { label: 'Packing List',            icon: '\ud83d\udce6' },
  COO:         { label: 'Certificate of Origin',   icon: '\ud83c\udfdb\ufe0f' },
  COC:         { label: 'Certificate of Conformity', icon: '\u2705' },
  BANK_TRANSFER:{ label: 'Bank Transfer',          icon: '\ud83c\udfe6' },
};

// Preferred display order
const DOC_ORDER = ['AWB','BL_DRAFT','SWB','INV','PROFORMA_INV','PL','COO','COC','BANK_TRANSFER'];

/**
 * Parse the docs directory and return a map: containerNo -> [docObject, ...]
 */
function buildDocMap() {
  let files = [];
  try { files = fs.readdirSync(DOCS_DIR); } catch { return {}; }

  const map = {};
  files.forEach(filename => {
    if (!filename.endsWith('.pdf')) return;
    const match = filename.match(/^([A-Z]{3,4}\d{7,11})_(.+)\.pdf$/);
    if (!match) return;
    const containerNo = match[1];
    const typeCode    = match[2];
    const meta        = DOC_LABELS[typeCode] || { label: typeCode, icon: '\ud83d\udcce' };
    if (!map[containerNo]) map[containerNo] = [];
    map[containerNo].push({
      filename,
      containerNo,
      typeCode,
      label: meta.label,
      icon:  meta.icon,
      downloadUrl: `/api/documents/download/${encodeURIComponent(filename)}`,
    });
  });

  // Sort each container's docs by preferred order
  Object.values(map).forEach(docs => {
    docs.sort((a, b) => {
      const ai = DOC_ORDER.indexOf(a.typeCode);
      const bi = DOC_ORDER.indexOf(b.typeCode);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  });

  return map;
}

// ── Reports API (must be before :containerNo) ──────────────────────────────
const REPORTS_DIR = path.join(__dirname, '..', 'data', 'reports');

const REPORT_FILES = {
  demurrage: 'demurrage_report.pdf',
  late_shipments: 'late_shipments_report.pdf',
  shipments_per_carrier: 'shipments_per_carrier_report.pdf',
  shipments_per_forwarder: 'shipments_per_forwarder_report.pdf',
};

// GET /api/documents/reports/list
router.get('/reports/list', authenticateToken, (req, res) => {
  const reports = Object.entries(REPORT_FILES).map(([key, filename]) => ({
    key,
    filename,
    downloadUrl: `/api/documents/reports/download/${key}`,
  }));
  res.json({ reports });
});

// GET /api/documents/reports/download/:reportKey
router.get('/reports/download/:reportKey', authenticateToken, (req, res) => {
  const key = req.params.reportKey;
  const filename = REPORT_FILES[key];
  if (!filename) {
    return res.status(404).json({ error: 'Report not found' });
  }
  const filepath = path.join(REPORTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'Report file not found on server' });
  }
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(filepath);
});

// GET /api/documents/reports/data/:reportKey — serve report data as JSON for HTML rendering
router.get('/reports/data/:reportKey', authenticateToken, (req, res) => {
  const key = req.params.reportKey;
  const seaPath = path.join(__dirname, '..', 'data', 'seaShipments.json');
  const airPath = path.join(__dirname, '..', 'data', 'airShipments.json');
  let seaShipments = [];
  let airShipments = [];
  try { seaShipments = JSON.parse(fs.readFileSync(seaPath, 'utf8')); } catch {}
  try { airShipments = JSON.parse(fs.readFileSync(airPath, 'utf8')); } catch {}

  const SCAC_CARRIERS = {
    'ZIMU': 'ZIM (ZIMU)', 'MEDU': 'MSC (MEDU)', 'MSCU': 'MSC (MSCU)',
    'MAEU': 'Maersk (MAEU)', 'COSU': 'COSCO (COSU)', 'CMDU': 'CMA CGM (CMDU)',
    'ONEY': 'ONE (ONEY)', 'ESPU': 'Evergreen (ESPU)', 'HDMU': 'Hapag-Lloyd (HDMU)'
  };

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const allShipments = [
    ...seaShipments.map(s => ({ ...s, mode: 'Sea', carrier: SCAC_CARRIERS[s.scac] || s.scac })),
    ...airShipments.map(s => ({ ...s, mode: 'Air', carrier: s.carrier || s.carrierCode || '—' })),
  ];
  const total = allShipments.length;

  // Simulated late shipment data based on the report PDF content
  const lateShipments = [
    { shipmentNo: '3007283', mbl: 'ZIMUMER25802993', forwarder: 'BDL', carrier: 'ZIM', plannedETA: '28 Feb 2026', actualArrival: '11 Mar 2026', daysLate: 11 },
    { shipmentNo: '3007325', mbl: '265573092', forwarder: 'UNICARGO', carrier: 'Maersk', plannedETA: '15 Mar 2026', actualArrival: '22 Mar 2026', daysLate: 7 },
    { shipmentNo: '3007333', mbl: '265555402', forwarder: 'UNICARGO', carrier: 'Maersk', plannedETA: '18 Mar 2026', actualArrival: '28 Mar 2026', daysLate: 10 },
    { shipmentNo: '3007302', mbl: '263497067', forwarder: 'UNICARGO', carrier: 'Maersk', plannedETA: '10 Feb 2026', actualArrival: '24 Feb 2026', daysLate: 14 },
    { shipmentNo: '2033991', mbl: 'MEDUKM036373', forwarder: 'Rosenthal', carrier: 'MSC', plannedETA: '05 Mar 2026', actualArrival: '12 Mar 2026', daysLate: 7 },
    { shipmentNo: '3007335', mbl: 'ANT1975091', forwarder: 'UNICARGO', carrier: 'CMA CGM', plannedETA: '20 Apr 2026', actualArrival: '29 Apr 2026', daysLate: 9 },
    { shipmentNo: '3007313', mbl: 'ONEYHAMG01212900', forwarder: 'GOA', carrier: 'ONE', plannedETA: '12 Apr 2026', actualArrival: '18 Apr 2026', daysLate: 6 },
    { shipmentNo: '2034010', mbl: '265804079', forwarder: 'GOA', carrier: 'Maersk', plannedETA: '25 Apr 2026', actualArrival: '02 May 2026', daysLate: 7 },
  ];

  if (key === 'late_shipments') {
    // Group by forwarder
    const byForwarder = {};
    lateShipments.forEach(s => {
      if (!byForwarder[s.forwarder]) byForwarder[s.forwarder] = { total: 0, late: 0, totalDays: 0 };
      byForwarder[s.forwarder].late++;
      byForwarder[s.forwarder].totalDays += s.daysLate;
    });
    allShipments.forEach(s => {
      if (!byForwarder[s.forwarder]) byForwarder[s.forwarder] = { total: 0, late: 0, totalDays: 0 };
      byForwarder[s.forwarder].total++;
    });
    const forwarderTable = Object.entries(byForwarder)
      .filter(([, v]) => v.late > 0)
      .map(([name, v]) => ({ forwarder: name, total: v.total, late: v.late, pctLate: Math.round((v.late / v.total) * 100), avgDays: (v.totalDays / v.late).toFixed(1) }))
      .sort((a, b) => b.late - a.late);

    // Group by carrier
    const byCarrier = {};
    lateShipments.forEach(s => {
      if (!byCarrier[s.carrier]) byCarrier[s.carrier] = { total: 0, late: 0, totalDays: 0 };
      byCarrier[s.carrier].late++;
      byCarrier[s.carrier].totalDays += s.daysLate;
    });
    allShipments.forEach(s => {
      const cName = s.carrier ? s.carrier.split(' (')[0] : s.scac;
      if (!byCarrier[cName]) byCarrier[cName] = { total: 0, late: 0, totalDays: 0 };
      byCarrier[cName].total++;
    });
    const carrierTable = Object.entries(byCarrier)
      .filter(([, v]) => v.late > 0)
      .map(([name, v]) => ({ carrier: name, total: v.total, late: v.late, pctLate: Math.round((v.late / v.total) * 100), avgDays: (v.totalDays / v.late).toFixed(1) }))
      .sort((a, b) => b.late - a.late);

    return res.json({
      reportType: 'late_shipments',
      title: 'Late Shipments Report',
      generatedDate: today,
      summary: `This report identifies shipments that arrived after the planned delivery date. Period: January 2026 - May 2026. Total late shipments: ${lateShipments.length} out of ${total} (${Math.round((lateShipments.length / total) * 100)}%).`,
      lateShipments,
      forwarderTable,
      carrierTable,
      rootCauses: [
        'Port congestion at Santos, BR (3 shipments affected)',
        'Vessel schedule changes by Maersk on Asia-South America routes',
        'Customs delays at Mumbai, IN (2 shipments affected)',
        'Transshipment delays at Kingston, JM (ZIM routing)'
      ]
    });
  }

  if (key === 'shipments_per_carrier') {
    const byCarrier = {};
    allShipments.forEach(s => {
      const name = s.carrier || s.scac || 'Unknown';
      if (!byCarrier[name]) byCarrier[name] = { total: 0, sea: 0, air: 0, containers: 0 };
      byCarrier[name].total++;
      if (s.mode === 'Sea') { byCarrier[name].sea++; byCarrier[name].containers += (s.containers || []).length; }
      else byCarrier[name].air++;
    });
    const carrierTable = Object.entries(byCarrier)
      .map(([name, v]) => ({ carrier: name, total: v.total, sea: v.sea, air: v.air, containers: v.containers }))
      .sort((a, b) => b.total - a.total);
    return res.json({
      reportType: 'shipments_per_carrier',
      title: 'Shipments per Carrier Report',
      generatedDate: today,
      summary: `Overview of shipment distribution across carriers. Period: January 2026 - May 2026. Total shipments: ${total}.`,
      carrierTable,
    });
  }

  if (key === 'shipments_per_forwarder') {
    const byForwarder = {};
    allShipments.forEach(s => {
      const name = s.forwarder || 'Unknown';
      if (!byForwarder[name]) byForwarder[name] = { total: 0, sea: 0, air: 0, containers: 0 };
      byForwarder[name].total++;
      if (s.mode === 'Sea') { byForwarder[name].sea++; byForwarder[name].containers += (s.containers || []).length; }
      else byForwarder[name].air++;
    });
    const forwarderTable = Object.entries(byForwarder)
      .map(([name, v]) => ({ forwarder: name, total: v.total, sea: v.sea, air: v.air, containers: v.containers }))
      .sort((a, b) => b.total - a.total);
    return res.json({
      reportType: 'shipments_per_forwarder',
      title: 'Shipments per Forwarder Report',
      generatedDate: today,
      summary: `Overview of shipment distribution across forwarders. Period: January 2026 - May 2026. Total shipments: ${total}.`,
      forwarderTable,
    });
  }

  if (key === 'demurrage') {
    const demurrageData = [
      { shipmentNo: '3007302', container: 'MSKU1708833', port: 'Santos, BR', daysInPort: 12, freeDays: 5, demurrageDays: 7, dailyRate: 150, totalCost: 1050 },
      { shipmentNo: '3007302', container: 'HASU4794517', port: 'Santos, BR', daysInPort: 10, freeDays: 5, demurrageDays: 5, dailyRate: 150, totalCost: 750 },
      { shipmentNo: '3007283', container: 'ZCSU7221847', port: 'Haifa, IL', daysInPort: 8, freeDays: 4, demurrageDays: 4, dailyRate: 120, totalCost: 480 },
      { shipmentNo: '3007333', container: 'MRSU7660635', port: 'Mumbai, IN', daysInPort: 9, freeDays: 5, demurrageDays: 4, dailyRate: 100, totalCost: 400 },
      { shipmentNo: '3007335', container: 'TGBU6980952', port: 'Kingston, JM', daysInPort: 7, freeDays: 3, demurrageDays: 4, dailyRate: 130, totalCost: 520 },
    ];
    const totalCost = demurrageData.reduce((sum, d) => sum + d.totalCost, 0);
    return res.json({
      reportType: 'demurrage',
      title: 'Demurrage Report',
      generatedDate: today,
      summary: `Demurrage charges incurred during the period January 2026 - May 2026. Total demurrage cost: $${totalCost.toLocaleString()}. Containers affected: ${demurrageData.length}.`,
      demurrageData,
      totalCost,
    });
  }

  return res.status(404).json({ error: 'Unknown report type' });
});

// ── Documents API ──────────────────────────────────────────────────────────

// GET /api/documents/all — full list grouped by container
router.get('/all', authenticateToken, (req, res) => {
  const map = buildDocMap();
  const result = Object.entries(map).map(([containerNo, docs]) => ({
    containerNo,
    docs,
  }));
  result.sort((a, b) => a.containerNo.localeCompare(b.containerNo));
  res.json(result);
});

// GET /api/documents/download/:filename — serve the PDF
router.get('/download/:filename', authenticateToken, (req, res) => {
  const filename = path.basename(req.params.filename); // prevent path traversal
  const filepath = path.join(DOCS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(filepath);
});

// GET /api/documents/:containerNo — docs for one container (catch-all, must be last)
router.get('/:containerNo', authenticateToken, (req, res) => {
  const containerNo = req.params.containerNo.toUpperCase().trim();
  const map = buildDocMap();
  const docs = map[containerNo];
  if (!docs || docs.length === 0) {
    return res.json({ containerNo, docs: [] });
  }
  res.json({ containerNo, docs });
});

module.exports = router;
