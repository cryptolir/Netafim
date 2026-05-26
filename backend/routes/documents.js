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
