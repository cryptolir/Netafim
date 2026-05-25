/**
 * Documents API
 *
 * Routes:
 *   GET /api/documents/:containerNo        — list docs for a specific container
 *   GET /api/documents/all                 — list all containers and their docs
 *   GET /api/documents/download/:filename  — serve a PDF file
 */
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { authenticateToken } = require('../middlewares/authMiddleware');

const DOCS_DIR = path.join(__dirname, '..', '..', 'sample_documents');

// Human-readable labels for each document type code
const DOC_LABELS = {
  AWB:         { label: 'Air Waybill',             icon: '✈️' },
  BL_DRAFT:    { label: 'Bill of Lading (Draft)', icon: '📄' },
  SWB:         { label: 'Sea Waybill',             icon: '🌊' },
  INV:         { label: 'Commercial Invoice',      icon: '🧾' },
  PROFORMA_INV:{ label: 'Proforma Invoice',        icon: '📋' },
  PL:          { label: 'Packing List',            icon: '📦' },
  COO:         { label: 'Certificate of Origin',   icon: '🏛️' },
  COC:         { label: 'Certificate of Conformity', icon: '✅' },
  BANK_TRANSFER:{ label: 'Bank Transfer',          icon: '🏦' },
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
    // Filename format: {ID}_{DOCTYPE}.pdf
    // ID can be a container number (4 letters + 7 digits, e.g. BMOU6008700)
    // or an AWB ID (AWB + digits, e.g. AWB70051280213)
    const match = filename.match(/^([A-Z]{3,4}\d{7,11})_(.+)\.pdf$/);
    if (!match) return;
    const containerNo = match[1];
    const typeCode    = match[2];
    const meta        = DOC_LABELS[typeCode] || { label: typeCode, icon: '📎' };
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

// GET /api/documents/:containerNo — docs for one container
router.get('/:containerNo', authenticateToken, (req, res) => {
  const containerNo = req.params.containerNo.toUpperCase().trim();
  const map = buildDocMap();
  const docs = map[containerNo];
  if (!docs || docs.length === 0) {
    return res.json({ containerNo, docs: [] });
  }
  res.json({ containerNo, docs });
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

module.exports = router;
