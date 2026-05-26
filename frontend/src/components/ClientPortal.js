import React, { useState, useContext } from 'react';
import BusinessChat from './BusinessChat';
import netafimLogo from '../netafim-logo.png';
import axios from 'axios';
import APP_VERSION from '../version';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../contexts/AuthContext';
import ChatAgent from './ChatAgent';
import AllContainersList from './AllContainersList';
import ShippingMap from './ShippingMap';

// Common Netafim port codes for quick selection
const NETAFIM_PORTS = [
  { code: 'ILASH', name: 'Ashdod, IL' },
  { code: 'ILHFA', name: 'Haifa, IL' },
  { code: 'DEHAM', name: 'Hamburg, DE' },
  { code: 'NLRTM', name: 'Rotterdam, NL' },
  { code: 'BEANR', name: 'Antwerp, BE' },
  { code: 'FRFOS', name: 'Fos-sur-Mer, FR' },
  { code: 'ESVLC', name: 'Valencia, ES' },
  { code: 'CNSHA', name: 'Shanghai, CN' },
  { code: 'USLAX', name: 'Los Angeles, US' },
  { code: 'AEJEA', name: 'Jebel Ali, AE' },
];

// Common airports for quick selection
const NETAFIM_AIRPORTS = [
  { code: 'TLV', name: 'Tel Aviv, IL' },
  { code: 'CDG', name: 'Paris, FR' },
  { code: 'FRA', name: 'Frankfurt, DE' },
  { code: 'AMS', name: 'Amsterdam, NL' },
  { code: 'LHR', name: 'London, UK' },
  { code: 'JFK', name: 'New York, US' },
  { code: 'DXB', name: 'Dubai, AE' },
  { code: 'SIN', name: 'Singapore, SG' },
  { code: 'PVG', name: 'Shanghai, CN' },
  { code: 'YUL', name: 'Montreal, CA' },
];

function getStatusClass(status) {
  if (!status) return 'unknown';
  const s = status.toLowerCase();
  if (s.includes('transit') || s.includes('vessel')) return 'in-transit';
  if (s.includes('deliver') || s.includes('discharg')) return 'delivered';
  if (s.includes('port') || s.includes('terminal') || s.includes('gate')) return 'at-port';
  return 'unknown';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return dateStr; }
}

/// ── Network Stat Bar with Popup Summaries ──────────────────────────────
const STAT_POPUPS = {
  containers: {
    title: 'Total Containers',
    icon: '📦',
    rows: [
      ['Shipment', 'MBL', 'Forwarder', 'Containers'],
      ['3007283', 'ZIMUMER25802993', 'BDL', 'ZCSU7221847'],
      ['3007304', 'MEDUXK674836', 'BDL', 'BMOU6008700'],
      ['3007344', 'MEDUXK687986', 'BDL', 'CAIU7795981'],
      ['2033991', 'MEDUKM036373', 'Rosenthal', 'TRHU7345364, MSCU5426470'],
      ['2034060', 'MEDUKM045440', 'Rosenthal', 'MEDU8765745'],
      ['2034062', 'MEDUKM045788', 'Rosenthal', 'MSNU5191379'],
      ['3007325', '265573092', 'UNICARGO', 'TRLU7537616, MRKU2456776, MIEU2031241, MRKU2810811'],
      ['3007333', '265555402', 'UNICARGO', 'MRSU7660635, MSKU1569471, MSKU0761303, MRSU5717201'],
      ['3007315', '6443358570', 'UNICARGO', 'CSLU2384211'],
      ['3007302', '263497067', 'UNICARGO', '20 containers'],
      ['3007313', 'ONEYHAMG01212900', 'GOA', 'FFAU1436408'],
      ['2034010', '265804079', 'GOA', 'TEMU8855116'],
    ],
  },
  active: {
    title: 'Active Shipments',
    icon: '🚢',
    rows: [
      ['Shipment', 'Type', 'Forwarder', 'Reference'],
      ['3007283', 'Sea', 'BDL', 'ZIMUMER25802993'],
      ['3007304', 'Sea', 'BDL', 'MEDUXK674836'],
      ['3007344', 'Sea', 'BDL', 'MEDUXK687986'],
      ['2033991', 'Sea', 'Rosenthal', 'MEDUKM036373'],
      ['2034060', 'Sea', 'Rosenthal', 'MEDUKM045440'],
      ['3007325', 'Sea', 'UNICARGO', '265573092'],
      ['3007333', 'Sea', 'UNICARGO', '265555402'],
      ['3007302', 'Sea', 'UNICARGO', '263497067'],
      ['3007335', 'Sea', 'UNICARGO', 'ANT1975091'],
      ['2033947', 'Sea', 'GOA', '264232297'],
      ['3007313', 'Sea', 'GOA', 'ONEYHAMG01212900'],
      ['3007294', 'Sea', 'GOA', 'ESLTURCDI0002100'],
      ['3007506', 'Air', 'DIVYA', 'AWB 057-58874082'],
      ['3007508', 'Air', 'DIVYA', 'AWB 618-53281141'],
      ['3007532', 'Air', 'Unicargo', 'AWB 074-05164585'],
    ],
  },
  inprogress: {
    title: 'Late Arrivals',
    icon: '⚠️',
    rows: [
      ['Shipment', 'MBL', 'Carrier', 'Forwarder'],
      ['3007283', 'ZIMUMER25802993', 'ZIM', 'BDL'],
      ['3007304', 'MEDUXK674836', 'MSC', 'BDL'],
      ['3007344', 'MEDUXK687986', 'MSC', 'BDL'],
      ['2033991', 'MEDUKM036373', 'MSC', 'Rosenthal'],
      ['3007325', '265573092', 'Maersk', 'UNICARGO'],
      ['3007333', '265555402', 'Maersk', 'UNICARGO'],
      ['3007315', '6443358570', 'COSCO', 'UNICARGO'],
      ['3007302', '263497067', 'Maersk', 'UNICARGO'],
      ['3007319', 'MERG00219900', 'ONE', 'UNICARGO'],
      ['2033947', '264232297', 'Maersk', 'GOA'],
      ['3007313', 'ONEYHAMG01212900', 'ONE', 'GOA'],
    ],
  },
  air: {
    title: 'Air Shipments',
    icon: '✈️',
    rows: [
      ['AWB', 'Shipment', 'Origin', 'Destination', 'Forwarder'],
      ['057-58874082', '3007506', 'Delhi (DEL)', 'Santiago (SCL)', 'DIVYA'],
      ['618-53281141', '3007508', 'Delhi (DEL)', 'Melbourne (MEL)', 'DIVYA'],
      ['729-94581793', '3007511', 'Delhi (DEL)', 'San Pedro Sula (SAP)', 'DIVYA'],
      ['074-05164585', '3007532', 'Barcelona (BCN)', 'Cape Town (CPT)', 'Unicargo'],
    ],
  },
  forwarders: {
    title: 'Freight Forwarders',
    icon: '🤝',
    rows: [
      ['Forwarder', 'Shipments', 'Type'],
      ['GOA', '6', 'Sea'],
      ['BDL', '3', 'Sea'],
      ['Rosenthal', '3', 'Sea'],
      ['UNICARGO', '6', 'Sea'],
      ['DIVYA', '3', 'Air'],
      ['Unicargo', '1', 'Air'],
    ],
  },
};

function NetworkStatBar() {
  const [openPopup, setOpenPopup] = React.useState(null);
  const stats = [
    { key: 'containers', value: 14, label: 'TOTAL CONTAINERS', icon: '📦' },
    { key: 'active',     value: 14, label: 'ACTIVE SHIPMENTS', icon: '🚢' },
    { key: 'inprogress', value: 11, label: 'LATE ARRIVALS', icon: '⚠️' },
    { key: 'air',        value: 3,  label: 'AIR SHIPMENTS', icon: '✈️' },
    { key: 'forwarders', value: 6,  label: 'FREIGHT FORWARDERS', icon: '🤝' },
  ];
  const popup = openPopup ? STAT_POPUPS[openPopup] : null;
  return (
    <>
      <div className="network-stat-bar">
        {stats.map(s => (
          <div
            key={s.key}
            className="network-stat-box"
            onClick={() => setOpenPopup(openPopup === s.key ? null : s.key)}
            title="Click for details"
          >
            <div className="nsb-icon">{s.icon}</div>
            <div className="nsb-value">{s.value}</div>
            <div className="nsb-label">{s.label}</div>
          </div>
        ))}
      </div>
      {popup && (
        <div className="nsb-overlay" onClick={() => setOpenPopup(null)}>
          <div className="nsb-popup" onClick={e => e.stopPropagation()}>
            <div className="nsb-popup-header">
              <span>{popup.icon} {popup.title}</span>
              <button className="nsb-popup-close" onClick={() => setOpenPopup(null)}>×</button>
            </div>
            <div className="nsb-popup-body">
              <table className="nsb-popup-table">
                <thead>
                  <tr>{popup.rows[0].map((h, i) => <th key={i}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {popup.rows.slice(1).map((row, ri) => (
                    <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Container Tracking Result ──────────────────────────────────────────
function TrackingResult({ data, docsData, docsLoading, token }) {
  const [previewDoc, setPreviewDoc] = React.useState(null); // { label, blobUrl }
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const openPreview = async (doc) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(doc.downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewDoc({ label: doc.label, blobUrl, filename: doc.filename });
    } catch {
      alert('Could not load preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewDoc?.blobUrl) URL.revokeObjectURL(previewDoc.blobUrl);
    setPreviewDoc(null);
  };

  if (!data) return null;

  const metadata = data.metadata || {};
  const route = data.route || {};
  const containers = data.containers || [];
  const vessels = data.vessels || [];
  const container = containers[0] || {};
  const events = container.events || [];
  const localShipment = data.localShipment || null;
  const isLocalFallback = data.isLocalFallback === true;

  const locMap = {};
  (data.locations || []).forEach(l => { locMap[l.id] = l; });
  const facMap = {};
  (data.facilities || []).forEach(f => { facMap[f.id] = f; });
  const vesMap = {};
  (vessels || []).forEach(v => { vesMap[v.id] = v; });

  const pol = route.pol || {};
  const pod = route.pod || {};
  const polLoc = locMap[pol.location] || {};
  const podLoc = locMap[pod.location] || {};

  const lastVesselEvent = [...events].reverse().find(e => e.vessel);
  const mainVessel = vesMap[lastVesselEvent?.vessel] || vessels[0] || {};

  const status = metadata.status || container.status || 'Unknown';
  const hasDocs = docsData && docsData.docs && docsData.docs.length > 0;

  return (
    <div className="tracking-result">
      {/* PDF Preview Modal */}
      {previewDoc && (
        <div className="doc-preview-overlay" onClick={closePreview}>
          <div className="doc-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="doc-preview-header">
              <span className="doc-preview-title">📄 {previewDoc.label}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={previewDoc.blobUrl}
                  download={previewDoc.filename}
                  className="doc-preview-dl-btn"
                  title="Download"
                >↓ Download</a>
                <button className="doc-preview-close" onClick={closePreview}>✕</button>
              </div>
            </div>
            <iframe
              src={previewDoc.blobUrl}
              title={previewDoc.label}
              className="doc-preview-iframe"
            />
          </div>
        </div>
      )}

      <div className="tracking-header">
        <div className="container-number">{metadata.number || '—'}</div>
        <span className={`status-badge ${getStatusClass(status)}`}>{status.replace(/_/g, ' ')}</span>
      </div>



      {(polLoc.name || podLoc.name) && (
        <div className="route-visual">
          <div className="route-port">
            <div className="port-code">{polLoc.locode || '—'}</div>
            <div className="port-name">{polLoc.name || 'Origin'}</div>
            <div className="port-date">{formatDate(pol.date)}</div>
          </div>
          <div className="route-arrow">
            <div className="route-line" />
            {mainVessel.name && <div className="route-vessel">🚢 {mainVessel.name}</div>}
          </div>
          <div className="route-port">
            <div className="port-code">{podLoc.locode || '—'}</div>
            <div className="port-name">{podLoc.name || 'Destination'}</div>
            <div className="port-date">
              {pod.predictive_eta ? `ETA: ${formatDate(pod.predictive_eta)}` : formatDate(pod.date)}
            </div>
          </div>
        </div>
      )}

      <div className="tracking-meta">
        {(metadata.sealine_name || metadata.carrier_name) && (
          <div className="meta-item">
            <div className="meta-label">Shipping Line</div>
            <div className="meta-value">{metadata.carrier_name || metadata.sealine_name}</div>
          </div>
        )}
        {metadata.carrier_scac && (
          <div className="meta-item">
            <div className="meta-label">SCAC Code</div>
            <div className="meta-value">{metadata.carrier_scac}</div>
          </div>
        )}
        {mainVessel.name && (
          <div className="meta-item">
            <div className="meta-label">Vessel</div>
            <div className="meta-value">{mainVessel.name}</div>
          </div>
        )}
        {container.size_type && (
          <div className="meta-item">
            <div className="meta-label">Container Type</div>
            <div className="meta-value">{container.size_type}</div>
          </div>
        )}
        {containers.length > 1 && (
          <div className="meta-item">
            <div className="meta-label">Total Containers</div>
            <div className="meta-value">{containers.length}</div>
          </div>
        )}
        {metadata.updated_at && (
          <div className="meta-item">
            <div className="meta-label">Last Updated</div>
            <div className="meta-value">{formatDate(metadata.updated_at)}</div>
          </div>
        )}

      </div>

      {/* Events + Documents side-by-side */}
      {(events.length > 0 || docsLoading || hasDocs || localShipment) && (
        <div className="events-docs-row">
          {/* Left: Shipment Events or Container List */}
          {events.length === 0 && localShipment && localShipment.containers.length > 0 && (
            <div className="events-col">
              <div className="events-col-title">Containers ({localShipment.containers.length})</div>
              <div className="timeline">
                {localShipment.containers.map((c, i) => (
                  <div key={i} className="timeline-event actual">
                    <div className="event-desc" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{c}</div>
                    <div className="event-location">Container {i + 1} of {localShipment.containers.length}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {events.length > 0 && (
            <div className="events-col">
              <div className="events-col-title">Shipment Events</div>
              <div className="timeline">
                {events.map((ev, i) => {
                  const evLoc = locMap[ev.location] || {};
                  const evFac = facMap[ev.facility] || {};
                  const evVes = vesMap[ev.vessel] || {};
                  return (
                    <div
                      key={i}
                      className={`timeline-event ${ev.actual ? 'actual' : 'estimated'} ${i === events.length - 1 ? 'latest' : ''}`}
                    >
                      <div className="event-date">{formatDate(ev.date)}{!ev.actual ? ' (est.)' : ''}</div>
                      <div className="event-desc">{ev.description || ev.event_code}</div>
                      <div className="event-location">
                        {evLoc.name || ''}
                        {evFac.name ? ` · ${evFac.name}` : ''}
                        {evVes.name ? ` · 🚢 ${evVes.name}` : ''}
                        {ev.voyage ? ` · Voyage ${ev.voyage}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right: Shipment Documents */}
          {(docsLoading || hasDocs) && (
            <div className="docs-col">
              <div className="docs-col-header">
                <span className="docs-col-title">📎 Documents</span>
                {hasDocs && (
                  <button
                    className="docs-view-all-btn"
                    onClick={() => {
                      const w = window.open('', '_blank');
                      fetch('/api/documents/all', { headers: { Authorization: `Bearer ${token}` } })
                        .then(r => r.json())
                        .then(allData => {
                          const rows = allData.map(c =>
                            `<tr><td colspan="3" style="background:#f0f4ff;font-weight:700;padding:8px 12px">${c.containerNo}</td></tr>` +
                            c.docs.map(d =>
                              `<tr><td style="padding:6px 12px">${d.icon}</td><td style="padding:6px 12px">${d.label}</td><td style="padding:6px 12px"><a href="${d.downloadUrl}" download style="color:#1565c0">Download</a></td></tr>`
                            ).join('')
                          ).join('');
                          w.document.write(`<!DOCTYPE html><html><head><title>All Shipment Documents</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #eee}h2{color:#0d2b4e}</style></head><body><h2>All Shipment Documents</h2><table>${rows}</table></body></html>`);
                          w.document.close();
                        });
                    }}
                  >View all ↗</button>
                )}
              </div>
              {docsLoading && <div className="docs-loading">Loading documents…</div>}
              {hasDocs && (
                <div className="docs-list">
                  {docsData.docs.map(doc => (
                    <div key={doc.filename} className="doc-row">
                      <span className="doc-row-icon">{doc.icon}</span>
                      <span className="doc-row-label">{doc.label}</span>
                      <div className="doc-row-actions">
                        <button
                          className="doc-btn doc-btn-preview"
                          title="Preview"
                          disabled={previewLoading}
                          onClick={() => openPreview(doc)}
                        >👁</button>
                        <button
                          className="doc-btn doc-btn-download"
                          title="Download"
                          onClick={() => {
                            fetch(doc.downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
                              .then(r => r.blob())
                              .then(blob => {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = doc.filename; a.click();
                                URL.revokeObjectURL(url);
                              });
                          }}
                        >↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Ship Schedules Result ──────────────────────────────────────────────────
function SchedulesResult({ data }) {
  const [expandedIdx, setExpandedIdx] = React.useState(null);
  if (!data) return null;
  const schedules = data.data?.schedules || data.schedules || [];
  const stats = data.metadata?.response_stats || [];
  if (schedules.length === 0) {
    return <div className="empty-state"><div className="empty-icon">🔍</div><p>No schedules found for this route.</p></div>;
  }

  const toggleExpand = (idx) => setExpandedIdx(expandedIdx === idx ? null : idx);

  return (
    <div className="schedules-results-wrap">
      {/* Stats summary */}
      {stats.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {stats.map((st, i) => (
            <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: st.found_schedules > 0 ? '#dcfce7' : '#fef2f2', color: st.found_schedules > 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
              {st.carrier_name}: {st.found_schedules} schedule{st.found_schedules !== 1 ? 's' : ''}
            </span>
          ))}
          <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }}>
            Total: {schedules.length} results
          </span>
        </div>
      )}

      {/* Schedule cards */}
      {schedules.map((s, i) => {
        const firstLeg = s.legs?.[0] || {};
        const lastLeg = s.legs?.[s.legs.length - 1] || {};
        const isExpanded = expandedIdx === i;
        return (
          <div key={i} className="schedule-card" style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 10, overflow: 'hidden', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff', transition: 'all 0.2s' }} onClick={() => toggleExpand(i)}>
            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.5fr 0.7fr 0.8fr 0.5fr', alignItems: 'center', padding: '12px 16px', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1e3a5f' }}>🚢 {s.carrier_name || s.carrier_scac}</span>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.carrier_scac}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Departure</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{formatDate(s.origin?.estimated_date || firstLeg.departure?.estimated_date)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{s.origin?.port_name} ({s.origin?.port_locode})</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Arrival</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{formatDate(s.destination?.estimated_date || lastLeg.arrival?.estimated_date)}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{s.destination?.port_name} ({s.destination?.port_locode})</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a5f' }}>{s.transit_time}d</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>transit</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                {s.direct
                  ? <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: '#dcfce7', color: '#166534', fontWeight: 600 }}>Direct</span>
                  : <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>{s.legs?.length} legs</span>
                }
              </div>
              <div style={{ textAlign: 'center', fontSize: 18, color: '#94a3b8' }}>
                {isExpanded ? '▲' : '▼'}
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px', background: '#f8fafc' }} onClick={e => e.stopPropagation()}>
                {/* Route visual */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Route Details</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', padding: '8px 0' }}>
                    {(s.legs || []).map((leg, li) => (
                      <React.Fragment key={li}>
                        {li === 0 && (
                          <div style={{ textAlign: 'center', minWidth: 80 }}>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#2563eb', margin: '0 auto 4px' }} />
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f' }}>{leg.departure?.port_locode}</div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{leg.departure?.port_name}</div>
                            <div style={{ fontSize: 10, color: '#2563eb' }}>{formatDate(leg.departure?.estimated_date)}</div>
                          </div>
                        )}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
                          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{leg.vessel_name}</div>
                          <div style={{ width: '100%', height: 2, background: '#2563eb', position: 'relative' }}>
                            <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 10 }}>🚢</span>
                          </div>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{leg.service_name || ''} {leg.voyages?.[0]?.voyage ? `(${leg.voyages[0].voyage})` : ''}</div>
                        </div>
                        <div style={{ textAlign: 'center', minWidth: 80 }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: li === (s.legs || []).length - 1 ? '#16a34a' : '#f59e0b', margin: '0 auto 4px' }} />
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f' }}>{leg.arrival?.port_locode}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{leg.arrival?.port_name}</div>
                          <div style={{ fontSize: 10, color: li === (s.legs || []).length - 1 ? '#16a34a' : '#d97706' }}>{formatDate(leg.arrival?.estimated_date)}</div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Legs table */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vessel Legs</div>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Leg</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Vessel</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Voyage</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>From</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>ETD</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>To</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>ETA</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Service</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(s.legs || []).map((leg, li) => (
                        <tr key={li} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{leg.order_id || li + 1}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1e3a5f' }}>{leg.vessel_name || '—'}</td>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: 11 }}>{leg.voyages?.[0]?.voyage || '—'}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ fontWeight: 500 }}>{leg.departure?.port_name}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{leg.departure?.terminal_name?.substring(0, 30)}{leg.departure?.terminal_name?.length > 30 ? '...' : ''}</div>
                          </td>
                          <td style={{ padding: '6px 8px', color: '#2563eb', fontWeight: 500 }}>{formatDate(leg.departure?.estimated_date)}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <div style={{ fontWeight: 500 }}>{leg.arrival?.port_name}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{leg.arrival?.terminal_name?.substring(0, 30)}{leg.arrival?.terminal_name?.length > 30 ? '...' : ''}</div>
                          </td>
                          <td style={{ padding: '6px 8px', color: '#16a34a', fontWeight: 500 }}>{formatDate(leg.arrival?.estimated_date)}</td>
                          <td style={{ padding: '6px 8px', fontSize: 11, color: '#64748b' }}>{leg.service_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Terminal info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Origin Terminal</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1e3a5f' }}>{s.origin?.terminal_name || firstLeg.departure?.terminal_name || 'N/A'}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Destination Terminal</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1e3a5f' }}>{s.destination?.terminal_name || lastLeg.arrival?.terminal_name || 'N/A'}</div>
                  </div>
                </div>

                {/* Cut-off dates */}
                {s.cut_off_dates && s.cut_off_dates.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cut-off Dates</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {s.cut_off_dates.map((co, ci) => (
                        <div key={ci} style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '4px 10px', fontSize: 11 }}>
                          <span style={{ fontWeight: 600, color: '#92400e' }}>{co.name}:</span>{' '}
                          <span style={{ color: '#78350f' }}>{formatDate(co.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Updated info */}
                {s.updated_at && (
                  <div style={{ marginTop: 12, fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>Last updated: {s.updated_at}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Air Tracking Result ────────────────────────────────────────────────────
function AirTrackingResult({ data, docsData, docsLoading, token }) {
  if (!data) return null;
  const meta = data.metadata || {};
  const info = data.data || {};
  const routes = info.routes || [];
  const events = info.events || [];
  const airline = meta.airline || {};
  const status = info.status || 'Unknown';
  const isFallback = data.isFallback === true;
  const hasDocs = docsData && docsData.docs && docsData.docs.length > 0;

  // Build unique station list from routes — deduplicate by IATA code
  const buildStations = () => {
    if (!routes.length) return [];
    const stationMap = new Map(); // iata_code → station data
    routes.forEach((leg, i) => {
      const fromCode = leg.from?.iata_code || 'FROM_' + i;
      const toCode = leg.to?.iata_code || 'TO_' + i;
      if (!stationMap.has(fromCode)) {
        stationMap.set(fromCode, {
          airport: leg.from,
          dep: leg.departure_datetime_local,
          isOrigin: true,
          flights: [],
        });
      }
      if (!stationMap.has(toCode)) {
        stationMap.set(toCode, {
          airport: leg.to,
          arr: leg.arrival_datetime_local,
          flights: [leg.flight_number],
          isDestination: false,
        });
      } else {
        // Update arrival if later
        const existing = stationMap.get(toCode);
        const existingArr = existing.arr?.actual || existing.arr?.estimated || '';
        const newArr = leg.arrival_datetime_local?.actual || leg.arrival_datetime_local?.estimated || '';
        if (newArr > existingArr) existing.arr = leg.arrival_datetime_local;
        if (leg.flight_number && !existing.flights?.includes(leg.flight_number)) {
          existing.flights = existing.flights || [];
          existing.flights.push(leg.flight_number);
        }
      }
    });
    // Mark last station as destination
    const stationsArr = Array.from(stationMap.values());
    if (stationsArr.length > 1) {
      stationsArr[stationsArr.length - 1].isDestination = true;
      // Remove isOrigin from non-first stations
      stationsArr.forEach((s, i) => { if (i > 0) s.isOrigin = false; });
    }
    return stationsArr;
  };
  const stations = buildStations();

  // Format datetime from API format "2026-03-23 11:03:00" or datetime_local object
  const fmtDateTime = (dtObj) => {
    if (!dtObj) return '—';
    const val = dtObj.actual || dtObj.estimated || dtObj;
    if (typeof val !== 'string') return '—';
    try {
      const d = new Date(val.replace(' ', 'T'));
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
             d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return val; }
  };

  const [previewDoc, setPreviewDoc] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const openPreview = async (doc) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(doc.downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewDoc({ label: doc.label, blobUrl, filename: doc.filename });
    } catch {
      alert('Could not load preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewDoc?.blobUrl) URL.revokeObjectURL(previewDoc.blobUrl);
    setPreviewDoc(null);
  };

  const statusColor = (s) => {
    if (!s) return '#94a3b8';
    const l = s.toLowerCase();
    if (l === 'delivered') return '#16a34a';
    if (l === 'in_transit' || l === 'in transit' || l === 'departed') return '#2563eb';
    if (l === 'arrived') return '#d97706';
    return '#94a3b8';
  };

  // Docs panel — shared by both fallback and live views
  const DocsPanel = () => (
    (docsLoading || hasDocs) ? (
      <div className="docs-col">
        <div className="docs-col-header">
          <span className="docs-col-title">📎 Documents</span>
        </div>
        {docsLoading && <div className="docs-loading">Loading documents…</div>}
        {hasDocs && (
          <div className="docs-list">
            {docsData.docs.map(doc => (
              <div key={doc.filename} className="doc-row">
                <span className="doc-row-icon">{doc.icon}</span>
                <span className="doc-row-label">{doc.label}</span>
                <div className="doc-row-actions">
                  <button
                    className="doc-btn doc-btn-preview"
                    title="Preview"
                    disabled={previewLoading}
                    onClick={() => openPreview(doc)}
                  >👁</button>
                  <button
                    className="doc-btn doc-btn-download"
                    title="Download"
                    onClick={() => {
                      fetch(doc.downloadUrl, { headers: { Authorization: `Bearer ${token}` } })
                        .then(r => r.blob())
                        .then(blob => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = doc.filename; a.click();
                          URL.revokeObjectURL(url);
                        });
                    }}
                  >↓</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null
  );

  // ── Fallback card (MIND data only) ────────────────────────────────────────────────
  if (isFallback) {
    // Build stations from fallback routes
    const fallbackStations = [];
    if (routes.length > 0) {
      routes.forEach((leg, i) => {
        if (i === 0 && leg.from) fallbackStations.push({ code: leg.from.iata_code || leg.from.name, name: leg.from.name || '', dep: leg.departure, isOrigin: true });
        if (leg.to) fallbackStations.push({ code: leg.to.iata_code || leg.to.name, name: leg.to.name || '', arr: leg.arrival, flightIn: leg.flight_number, isDestination: i === routes.length - 1 });
      });
    }

    return (
      <div className="tracking-result">
        {previewDoc && (
          <div className="doc-preview-overlay" onClick={closePreview}>
            <div className="doc-preview-modal" onClick={e => e.stopPropagation()}>
              <div className="doc-preview-header">
                <span className="doc-preview-title">📄 {previewDoc.label}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={previewDoc.blobUrl} download={previewDoc.filename} className="doc-preview-dl-btn" title="Download">↓ Download</a>
                  <button className="doc-preview-close" onClick={closePreview}>✕</button>
                </div>
              </div>
              <iframe src={previewDoc.blobUrl} title={previewDoc.label} className="doc-preview-iframe" />
            </div>
          </div>
        )}
        <div className="tracking-header">
          <div className="container-number" style={{ fontSize: 14 }}>✈️ {info.awb || meta.request_parameters?.number || '—'}</div>
          <span className="status-badge" style={{ background: statusColor(status), color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{status.toUpperCase()}</span>
        </div>

        {/* Multi-stop route visual for fallback */}
        {fallbackStations.length > 0 ? (
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: fallbackStations.length * 120, gap: 0 }}>
              {fallbackStations.map((st, i) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100, flex: '0 0 auto' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: st.isOrigin ? '#0d2b4e' : st.isDestination ? '#16a34a' : '#e2e8f0',
                      color: (st.isOrigin || st.isDestination) ? '#fff' : '#64748b',
                      fontSize: 14, fontWeight: 700, border: '2px solid',
                      borderColor: st.isOrigin ? '#0d2b4e' : st.isDestination ? '#16a34a' : '#cbd5e1'
                    }}>
                      {st.isOrigin ? '✈' : st.isDestination ? '📍' : '⬤'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, color: '#0d2b4e' }}>{st.code || '—'}</div>
                    <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', maxWidth: 90 }}>{st.name || ''}</div>
                    {st.dep && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Dep: {formatDate(st.dep)}</div>}
                    {st.arr && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Arr: {formatDate(st.arr)}</div>}
                    {st.flightIn && <div style={{ fontSize: 9, color: '#2563eb', marginTop: 1 }}>✈️ {st.flightIn}</div>}
                  </div>
                  {i < fallbackStations.length - 1 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 14, minWidth: 40 }}>
                      <div style={{ width: '100%', height: 2, background: '#2563eb', borderRadius: 2, position: 'relative' }}>
                        <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 12 }}>✈</span>
                      </div>
                      {routes[i]?.flight_number && (
                        <div style={{ fontSize: 9, color: '#64748b', marginTop: 6, whiteSpace: 'nowrap' }}>{routes[i].flight_number}</div>
                      )}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div className="route-visual">
            <div className="route-port">
              <div className="port-code">{info.origin ? info.origin.match(/\(([^)]+)\)/)?.[1] || 'TLV' : 'TLV'}</div>
              <div className="port-name">{info.origin ? info.origin.replace(/\s*\([^)]*\)/, '') : 'Tel Aviv'}</div>
            </div>
            <div className="route-arrow">
              <div className="route-line" />
              <div className="route-vessel">✈️ {info.carrier || 'Air Export'}</div>
            </div>
            <div className="route-port">
              <div className="port-code">{info.destination ? info.destination.match(/\(([^)]+)\)/)?.[1] || info.destination.slice(0,3).toUpperCase() : '—'}</div>
              <div className="port-name">{info.destination ? info.destination.replace(/\s*\([^)]*\)/, '') : '—'}</div>
            </div>
          </div>
        )}

        <div className="tracking-meta">
          {info.carrier && <div className="meta-item"><div className="meta-label">Airline</div><div className="meta-value">{info.carrier}</div></div>}
          <div className="meta-item"><div className="meta-label">AWB</div><div className="meta-value" style={{ fontFamily: 'monospace' }}>{info.awb || '—'}</div></div>
          <div className="meta-item"><div className="meta-label">Shipment No.</div><div className="meta-value" style={{ fontFamily: 'monospace' }}>{info.shipmentNo || '—'}</div></div>
          <div className="meta-item"><div className="meta-label">Forwarder</div><div className="meta-value">{info.forwarder || '—'}</div></div>
          <div className="meta-item"><div className="meta-label">Type</div><div className="meta-value">{info.type || '—'}</div></div>
          {info.flightNo && <div className="meta-item"><div className="meta-label">Flight</div><div className="meta-value">{info.flightNo}</div></div>}
        </div>

        {/* Events + Documents side-by-side */}
        {(events.length > 0 || docsLoading || hasDocs) && (
          <div className="events-docs-row">
            {events.length > 0 && (
              <div className="events-col">
                <div className="events-col-title">Shipment Events</div>
                <div className="timeline">
                  {events.map((ev, i) => (
                    <div key={i} className={`timeline-event actual ${i === events.length - 1 ? 'latest' : ''}`}>
                      <div className="event-date">{formatDate(ev.date)}</div>
                      <div className="event-desc">{ev.status}</div>
                      <div className="event-location">
                        {ev.location || ''}
                        {ev.flight ? ` · ✈️ ${ev.flight}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DocsPanel />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tracking-result">
      {previewDoc && (
        <div className="doc-preview-overlay" onClick={closePreview}>
          <div className="doc-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="doc-preview-header">
              <span className="doc-preview-title">📄 {previewDoc.label}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={previewDoc.blobUrl} download={previewDoc.filename} className="doc-preview-dl-btn" title="Download">↓ Download</a>
                <button className="doc-preview-close" onClick={closePreview}>✕</button>
              </div>
            </div>
            <iframe src={previewDoc.blobUrl} title={previewDoc.label} className="doc-preview-iframe" />
          </div>
        </div>
      )}

      <div className="tracking-header">
        <div className="container-number" style={{ fontSize: 14 }}>
          ✈️ {meta.request_parameters?.number || '—'}
        </div>
        <span className="status-badge" style={{
          background: statusColor(status), color: '#fff', borderRadius: 6,
          padding: '3px 10px', fontSize: 11, fontWeight: 700
        }}>{status.replace(/_/g, ' ')}</span>
      </div>

      {/* Route visual: unique stations */}
      {stations.length > 0 ? (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: stations.length * 140, gap: 0 }}>
            {stations.map((st, i) => (
              <React.Fragment key={i}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 110, flex: '0 0 auto' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: st.isOrigin ? '#0d2b4e' : st.isDestination ? (status === 'ARRIVED' ? '#16a34a' : '#2563eb') : '#e2e8f0',
                    color: (st.isOrigin || st.isDestination) ? '#fff' : '#64748b',
                    fontSize: 15, fontWeight: 700, border: '2px solid',
                    borderColor: st.isOrigin ? '#0d2b4e' : st.isDestination ? (status === 'ARRIVED' ? '#16a34a' : '#2563eb') : '#cbd5e1'
                  }}>
                    {st.isOrigin ? '✈' : st.isDestination ? '📍' : '⬤'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4, color: '#0d2b4e' }}>{st.airport?.iata_code || '—'}</div>
                  <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', maxWidth: 100 }}>{st.airport?.nearest_city || st.airport?.name || ''}</div>
                  {st.isOrigin && st.dep && (
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Dep: {formatDate(st.dep?.actual || st.dep?.estimated)}</div>
                  )}
                  {!st.isOrigin && st.arr && (
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>Arr: {formatDate(st.arr?.actual || st.arr?.estimated)}</div>
                  )}
                  {st.flights && st.flights.length > 0 && !st.isOrigin && (
                    <div style={{ fontSize: 9, color: '#2563eb', marginTop: 1 }}>✈️ {st.flights.join(', ')}</div>
                  )}
                </div>
                {i < stations.length - 1 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 16, minWidth: 50 }}>
                    <div style={{ width: '100%', height: 2, background: '#2563eb', borderRadius: 2, position: 'relative' }}>
                      <span style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', fontSize: 12 }}>✈</span>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (info.from || info.to) && (
        <div className="route-visual">
          <div className="route-port">
            <div className="port-code">{info.from?.iata_code || '—'}</div>
            <div className="port-name">{info.from?.nearest_city || info.from?.name || 'Origin'}</div>
          </div>
          <div className="route-arrow"><div className="route-line" /><div className="route-vessel">✈️ {airline.name || ''}</div></div>
          <div className="route-port">
            <div className="port-code">{info.to?.iata_code || '—'}</div>
            <div className="port-name">{info.to?.nearest_city || info.to?.name || 'Destination'}</div>
          </div>
        </div>
      )}

      {/* Meta info bar */}
      <div className="tracking-meta">
        {airline.name && <div className="meta-item"><div className="meta-label">AIRLINE</div><div className="meta-value">{airline.name}</div></div>}
        <div className="meta-item"><div className="meta-label">AWB</div><div className="meta-value" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{meta.request_parameters?.number || '—'}</div></div>
        {info.mindShipmentNo && <div className="meta-item"><div className="meta-label">SHIPMENT NO.</div><div className="meta-value" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{info.mindShipmentNo}</div></div>}
        {info.mindForwarder && <div className="meta-item"><div className="meta-label">FORWARDER</div><div className="meta-value">{info.mindForwarder}</div></div>}
        {info.mindType && <div className="meta-item"><div className="meta-label">TYPE</div><div className="meta-value">{info.mindType}</div></div>}
        {info.flight_number && <div className="meta-item"><div className="meta-label">FLIGHT</div><div className="meta-value">{info.flight_number}</div></div>}
      </div>

      {/* Flight legs table */}
      {routes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0d2b4e', marginBottom: 6 }}>Flight Legs ({routes.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#0d2b4e', color: '#fff' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>FROM</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>TO</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>FLIGHT</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>ETD / ATD</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>ETA / ATA</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>PCS</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>WEIGHT</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((leg, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{leg.from?.iata_code || '—'}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{leg.to?.iata_code || '—'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', color: '#2563eb', fontWeight: 600 }}>{leg.flight_number || '—'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10 }}>
                      <span style={{ color: leg.departure_datetime_local?.actual ? '#16a34a' : '#0d2b4e' }}>
                        {fmtDateTime(leg.departure_datetime_local)}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: 10 }}>
                      <span style={{ color: leg.arrival_datetime_local?.actual ? '#16a34a' : '#0d2b4e' }}>
                        {fmtDateTime(leg.arrival_datetime_local)}
                      </span>
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>{leg.piece || '—'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>{leg.weight ? `${leg.weight} kg` : '—'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                      <span style={{
                        background: leg.status === 'ARRIVED' ? '#dcfce7' : leg.status === 'IN_TRANSIT' ? '#dbeafe' : '#f1f5f9',
                        color: leg.status === 'ARRIVED' ? '#16a34a' : leg.status === 'IN_TRANSIT' ? '#2563eb' : '#64748b',
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600
                      }}>{(leg.status || 'Unknown').replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>
            Total: {info.piece || '—'} pcs · {info.weight ? `${info.weight} kg` : '—'}
          </div>
        </div>
      )}

      {/* Events + Documents side-by-side */}
      {(events.length > 0 || docsLoading || hasDocs) && (
        <div className="events-docs-row">
          {events.length > 0 && (
            <div className="events-col">
              <div className="events-col-title">Shipment Events ({events.length})</div>
              <div className="timeline">
                {events.map((ev, i) => (
                  <div key={i} className={`timeline-event ${ev.datetime_local?.actual ? 'actual' : 'estimated'} ${i === events.length - 1 ? 'latest' : ''}`}>
                    <div className="event-date">
                      {fmtDateTime(ev.datetime_local)}
                    </div>
                    <div className="event-desc">{ev.description || ev.event_code}</div>
                    <div className="event-location">
                      {ev.location?.iata_code ? `${ev.location.iata_code} · ` : ''}
                      {ev.location?.nearest_city || ev.location?.name || ''}
                      {ev.location?.country ? `, ${ev.location.country}` : ''}
                      {ev.flight_number ? ` · ✈️ ${ev.flight_number}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DocsPanel />
        </div>
      )}
    </div>
  );
}

// ── Air Schedules Result ───────────────────────────────────────────────────
function AirSchedulesResult({ data }) {
  if (!data) return null;
  // Searates flight schedules API returns an array or object with trips
  const trips = Array.isArray(data) ? data
    : data.data?.trips || data.trips || data.data || [];

  if (!Array.isArray(trips) || trips.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">✈️</div>
        <p>No flight schedules found for this route and date.</p>
        <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
          Try a different date or check the airport codes (IATA format, e.g. TLV, CDG).
        </p>
      </div>
    );
  }

  return (
    <div className="schedules-table-wrap">
      <table className="schedules-table">
        <thead>
          <tr>
            <th>Airline</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Transit</th>
            <th>Flights</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {trips.slice(0, 20).map((trip, i) => {
            const legs = trip.legs || trip.flights || [];
            const firstLeg = legs[0] || {};
            const lastLeg = legs[legs.length - 1] || {};
            const isDirect = legs.length <= 1 || trip.direct;
            const transitHours = trip.transit_time_hours || trip.transit_time || null;
            const airlineName = trip.airline_name || trip.carrier_name || firstLeg.airline_name || firstLeg.carrier || '—';
            const airlineCode = trip.airline_code || trip.carrier_code || firstLeg.airline_code || '';
            return (
              <tr key={i}>
                <td>
                  <span className="carrier-badge" style={{ background: 'rgba(14,165,233,0.1)', color: '#0369a1' }}>
                    ✈️ {airlineName}{airlineCode ? ` (${airlineCode})` : ''}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {trip.departure_date || firstLeg.departure_date || formatDate(firstLeg.departure_time || firstLeg.departure) || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                    {firstLeg.origin || firstLeg.from || trip.origin_airport_code || ''}
                    {firstLeg.departure_time ? ` · ${firstLeg.departure_time}` : ''}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {trip.arrival_date || lastLeg.arrival_date || formatDate(lastLeg.arrival_time || lastLeg.arrival) || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                    {lastLeg.destination || lastLeg.to || trip.destination_airport_code || ''}
                    {lastLeg.arrival_time ? ` · ${lastLeg.arrival_time}` : ''}
                  </div>
                </td>
                <td>
                  <span className="transit-time">
                    {transitHours ? `${transitHours}h` : legs.length > 0 ? `${legs.length} leg${legs.length > 1 ? 's' : ''}` : '—'}
                  </span>
                </td>
                <td>
                  {isDirect
                    ? <span className="direct-badge">Direct</span>
                    : <span className="via-badge">{legs.length} stop{legs.length > 1 ? 's' : ''}</span>
                  }
                </td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  {trip.cargo_type || trip.service_type || 'Air Cargo'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Shipment Details Form ──────────────────────────────────────────────────
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
  'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo (DRC)','Congo (Republic)',
  'Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador',
  'Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France',
  'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau',
  'Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland',
  'Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar',
  'Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia',
  'Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal',
  'Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan',
  'Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar',
  'Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia',
  'Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa',
  'South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan',
  'Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan',
  'Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City',
  'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
];

function ShipmentDetailsForm({ sapData, token }) {
  const [formData, setFormData] = useState({
    businessUnit: '',
    consignee: '',
    country: '',
    project: '',
    actualShippingCost: sapData?.actualShippingCost || '',
    reportType: '',
  });
  const [generated, setGenerated] = useState(false);
  const [reportBlobUrl, setReportBlobUrl] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);

  // SAP-sourced read-only values
  const plannedShippingCost = sapData?.plannedShippingCost || 'N/A';
  const annualShippingCost = sapData?.annualShippingCost || 'N/A';

  // Map dropdown values to backend report keys
  const REPORT_KEY_MAP = {
    demurrage: 'demurrage',
    late_shipments: 'late_shipments',
    per_carrier: 'shipments_per_carrier',
    per_forwarder: 'shipments_per_forwarder',
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setGenerated(false);
    if (field === 'reportType') {
      // Clear previous report when type changes
      if (reportBlobUrl) URL.revokeObjectURL(reportBlobUrl);
      setReportBlobUrl(null);
      setReportError('');
    }
  };

  const handleGenerate = async () => {
    if (!formData.reportType) {
      setReportError('Please select a report type.');
      return;
    }
    setReportLoading(true);
    setReportError('');
    if (reportBlobUrl) URL.revokeObjectURL(reportBlobUrl);
    setReportBlobUrl(null);
    try {
      const key = REPORT_KEY_MAP[formData.reportType];
      const res = await fetch(`/api/documents/reports/download/${key}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Report not available');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setReportBlobUrl(url);
      setGenerated(true);
    } catch (err) {
      setReportError('Failed to generate report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  const costDiff = () => {
    const planned = parseFloat(plannedShippingCost);
    const actual = parseFloat(formData.actualShippingCost);
    if (isNaN(planned) || isNaN(actual)) return null;
    const diff = actual - planned;
    const pct = planned !== 0 ? ((diff / planned) * 100).toFixed(1) : null;
    return { diff, pct, over: diff > 0 };
  };

  const diff = costDiff();

  return (
    <div className="section-card" style={{ marginTop: 0 }}>
      <div className="section-header">
        <div className="section-icon">📋</div>
        <div>
          <div className="section-title">Reports</div>
          <div className="section-subtitle">Generate reports based on shipment data (sourced from SAP)</div>
        </div>
      </div>
      <div className="section-body">
        <div className="shipment-form-grid">
          {/* Row 1 — Business Unit & Consignee */}
          <div className="form-field">
            <label className="form-label">
              <span className="form-label-icon">🏢</span> Business Unit
            </label>
            <select
              className="form-input sap-field"
              value={formData.businessUnit}
              onChange={e => handleChange('businessUnit', e.target.value)}
            >
              <option value="">— Select —</option>
              <option value="Business Unit 1">Business Unit 1</option>
              <option value="Business Unit 2">Business Unit 2</option>
              <option value="Business Unit 3">Business Unit 3</option>
              <option value="Business Unit 4">Business Unit 4</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">
              <span className="form-label-icon">👤</span> Consignee
            </label>
            <select
              className="form-input sap-field"
              value={formData.consignee}
              onChange={e => handleChange('consignee', e.target.value)}
            >
              <option value="">— Select —</option>
              <option value="Consignee 1">Consignee 1</option>
              <option value="Consignee 2">Consignee 2</option>
              <option value="Consignee 3">Consignee 3</option>
              <option value="Consignee 4">Consignee 4</option>
            </select>
          </div>
          {/* Row 2 — Country & Project */}
          <div className="form-field">
            <label className="form-label">
              <span className="form-label-icon">🌍</span> Country
            </label>
            <select
              className="form-input sap-field"
              value={formData.country}
              onChange={e => handleChange('country', e.target.value)}
            >
              <option value="">— Select Country —</option>
              {COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">
              <span className="form-label-icon">📁</span> Project Name
            </label>
            <input
              type="text"
              className="form-input"
              value={formData.project}
              onChange={e => handleChange('project', e.target.value)}
              placeholder="Enter project name"
            />
          </div>
        </div>

        {/* Cost row — Planned (SAP) + Actual on same line */}
        <div className="cost-row-inline">
          <div className="form-field cost-field-inline">
            <label className="form-label">
              <span className="form-label-icon">💰</span> Planned Shipping Cost
              <span className="sap-tag">Retrieved from SAP</span>
            </label>
            <div className="cost-input-wrap">
              <span className="cost-currency">$</span>
              <input
                type="text"
                className="form-input cost-input sap-readonly"
                value={plannedShippingCost}
                readOnly
                placeholder="N/A"
              />
            </div>
          </div>
          <div className="form-field cost-field-inline">
            <label className="form-label">
              <span className="form-label-icon">💵</span> Actual Shipping Cost
            </label>
            <div className="cost-input-wrap">
              <span className="cost-currency">$</span>
              <input
                type="number"
                className="form-input cost-input"
                value={formData.actualShippingCost}
                onChange={e => handleChange('actualShippingCost', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Annual Shipping Cost — SAP read-only, full width */}
        <div className="form-field" style={{ marginTop: 12 }}>
          <label className="form-label">
            <span className="form-label-icon">📅</span> Annual Shipping Cost
            <span className="sap-tag">Retrieved from SAP</span>
          </label>
          <div className="cost-input-wrap">
            <span className="cost-currency">$</span>
            <input
              type="text"
              className="form-input cost-input sap-readonly"
              value={annualShippingCost}
              readOnly
              placeholder="N/A"
            />
          </div>
        </div>

        {/* Cost variance indicator */}
        {diff !== null && (
          <div className={`cost-variance ${diff.over ? 'over-budget' : 'under-budget'}`}>
            <span className="variance-icon">{diff.over ? '⚠️' : '✅'}</span>
            <span className="variance-label">
              {diff.over ? 'Over budget' : 'Under budget'} by{' '}
              <strong>${Math.abs(diff.diff).toFixed(2)}</strong>
              {diff.pct !== null && ` (${Math.abs(diff.pct)}%)`}
            </span>
          </div>
        )}

        {/* Report Type dropdown */}
        <div className="form-field" style={{ marginTop: 16 }}>
          <label className="form-label">
            <span className="form-label-icon">📊</span> Report Type
          </label>
          <select
            className="form-input"
            value={formData.reportType}
            onChange={e => handleChange('reportType', e.target.value)}
          >
            <option value="">— Select Report Type —</option>
            <option value="demurrage">Demurrage Report</option>
            <option value="late_shipments">Late Shipments</option>
            <option value="per_carrier">Shipments per Carrier</option>
            <option value="per_forwarder">Shipments per Forwarder</option>
          </select>
        </div>

        {/* SAP source note */}
        <div className="sap-source-note">
          <span className="sap-badge">SAP</span>
          Fields marked with a blue border are populated from SAP S/4HANA.
          When no SAP connection is available, values default to <em>N/A</em>.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8, alignItems: 'center' }}>
          {reportError && <span style={{ color: '#dc2626', fontSize: 12 }}>{reportError}</span>}
          <button
            className="btn-search"
            onClick={handleGenerate}
            disabled={reportLoading}
            style={{ minWidth: 150 }}
          >
            {reportLoading ? '⏳ Generating...' : generated ? '✅ Report Generated' : '📊 Generate Report'}
          </button>
        </div>

        {/* Report action buttons after generation */}
        {reportBlobUrl && (
          <div className="report-actions-bar">
            <div className="report-actions-label">✅ Report ready</div>
            <div className="report-actions-btns">
              <button
                className="report-preview-btn"
                onClick={() => setReportPreviewOpen(true)}
              >👁 Preview Report</button>
              <a
                href={reportBlobUrl}
                download={`${formData.reportType || 'report'}.pdf`}
                className="report-download-btn"
              >↓ Download PDF</a>
            </div>
          </div>
        )}

        {/* Report Preview Popup Modal */}
        {reportPreviewOpen && reportBlobUrl && (
          <div className="report-preview-overlay" onClick={() => setReportPreviewOpen(false)}>
            <div className="report-preview-modal" onClick={e => e.stopPropagation()}>
              <div className="report-preview-header">
                <span className="report-preview-title">📄 Report Preview</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a
                    href={reportBlobUrl}
                    download={`${formData.reportType || 'report'}.pdf`}
                    className="doc-preview-dl-btn"
                  >↓ Download</a>
                  <button className="doc-preview-close" onClick={() => setReportPreviewOpen(false)}>✕</button>
                </div>
              </div>
              <iframe
                src={reportBlobUrl}
                title="Report Preview"
                className="report-preview-iframe"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ClientPortal() {
  const { token, logout } = useContext(AuthContext);
  const { t, i18n } = useTranslation();
  const [activeView, setActiveView] = useState('portal'); // 'portal' | 'chat'

  // Container tracking state
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState(null);
  const [trackedContainers, setTrackedContainers] = useState([]);

  // Ship schedules state
  const [schedOrigin, setSchedOrigin] = useState('ILASH');
  const [schedDest, setSchedDest] = useState('DEHAM');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedWeeks, setSchedWeeks] = useState('4');
  const [schedCargoType, setSchedCargoType] = useState('GC');
  const [schedDirect, setSchedDirect] = useState(false);
  const [schedulesData, setSchedulesData] = useState(null);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulesError, setSchedulesError] = useState(null);

  // Air tracking state
  const [awbNumber, setAwbNumber] = useState('');
  const [airTrackingData, setAirTrackingData] = useState(null);
  const [airTrackingLoading, setAirTrackingLoading] = useState(false);
  const [airTrackingError, setAirTrackingError] = useState(null);

  // Air schedules state
  const [airOrigin, setAirOrigin] = useState('TLV');
  const [airDest, setAirDest] = useState('CDG');
  const [airDate, setAirDate] = useState(new Date().toISOString().split('T')[0]);
  const [airDirect, setAirDirect] = useState(false);
  const [airSchedulesData, setAirSchedulesData] = useState(null);
  const [airSchedulesLoading, setAirSchedulesLoading] = useState(false);
  const [airSchedulesError, setAirSchedulesError] = useState(null);

  // MIND air shipments state
  const [mindAirShipments, setMindAirShipments] = useState([]);
  const [mindAirLoading, setMindAirLoading] = useState(false);
  const [mindAirQuery, setMindAirQuery] = useState('');

  // Documents state
  const [docsData, setDocsData] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsContainerNo, setDocsContainerNo] = useState(null);

  // ── Fetch documents for a container ──────────────────────────────────
  const fetchDocuments = async (containerNo) => {
    if (!containerNo) return;
    setDocsLoading(true);
    setDocsData(null);
    setDocsContainerNo(containerNo);
    try {
      const res = await axios.get(`/api/documents/${encodeURIComponent(containerNo)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocsData(res.data);
    } catch (err) {
      setDocsData({ containerNo, docs: [] });
    } finally {
      setDocsLoading(false);
    }
  };

  // ── Fetch container tracking ──────────────────────────────────────────
  const fetchTracking = async () => {
    if (!trackingNumber.trim()) return;
    setTrackingLoading(true);
    setTrackingError(null);
    setTrackingData(null);
    try {
      const res = await axios.get(`/api/containers/track/${encodeURIComponent(trackingNumber.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const responseData = res.data;
      const innerData = responseData.data || responseData;
      const localShipment = responseData.localShipment || innerData.localShipment || null;
      const isLocalFallback = responseData.isLocalFallback === true;

      // Attach local shipment info to the data for display
      if (localShipment) {
        innerData.localShipment = localShipment;
        innerData.isLocalFallback = isLocalFallback;
      }

      setTrackingData(innerData);

      const route = innerData?.route || {};
      const locations = innerData?.locations || [];
      const metadata = innerData?.metadata || {};
      const locMap = {};
      locations.forEach(l => { locMap[l.id] = l; });
      const polLoc = locMap[route.pol?.location];
      const podLoc = locMap[route.pod?.location];
      const container = (innerData?.containers || [])[0] || {};
      const allPortsForContainer = [];
      const seenLoc = new Set();
      if (polLoc && polLoc.locode && !seenLoc.has(polLoc.locode)) {
        seenLoc.add(polLoc.locode);
        allPortsForContainer.push({ ...polLoc, role: 'pol' });
      }
      if (podLoc && podLoc.locode && !seenLoc.has(podLoc.locode)) {
        seenLoc.add(podLoc.locode);
        allPortsForContainer.push({ ...podLoc, role: 'pod' });
      }
      (container.events || []).forEach(ev => {
        const loc = locMap[ev.location];
        if (loc && loc.locode && !seenLoc.has(loc.locode)) {
          seenLoc.add(loc.locode);
          allPortsForContainer.push({ ...loc, role: 'waypoint' });
        }
      });

      // Auto-fetch documents: if local shipment found, try first container; otherwise use search input
      const docContainer = localShipment
        ? (localShipment.containers && localShipment.containers[0]) || trackingNumber.trim().toUpperCase()
        : trackingNumber.trim().toUpperCase();
      fetchDocuments(docContainer);

      setTrackedContainers(prev => {
        const existing = prev.find(c => c.number === trackingNumber.trim().toUpperCase());
        if (existing) return prev;
        return [...prev, {
          number: trackingNumber.trim().toUpperCase(),
          status: metadata.status || container.status || 'UNKNOWN',
          carrier: metadata.carrier_name || metadata.carrier_scac || localShipment?.scac || '—',
          polCode: polLoc?.locode || '',
          podCode: podLoc?.locode || '',
          polName: polLoc?.name || '—',
          podName: podLoc?.name || '—',
          polCountry: polLoc?.country || '',
          podCountry: podLoc?.country || '',
          polLat: polLoc?.lat,
          polLng: polLoc?.lng,
          podLat: podLoc?.lat,
          podLng: podLoc?.lng,
          eta: route.pod?.predictive_eta || route.pod?.date || '—',
          ports: allPortsForContainer,
        }];
      });
    } catch (err) {
      setTrackingError(err.response?.data?.error || 'Failed to fetch tracking information. Please check the container number.');
    } finally {
      setTrackingLoading(false);
    }
  };

  // ── Fetch ship schedules ──────────────────────────────────────────────
  const fetchSchedules = async () => {
    setSchedulesLoading(true);
    setSchedulesError(null);
    setSchedulesData(null);
    try {
      const res = await axios.get('/api/containers/schedules', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          origin: schedOrigin,
          destination: schedDest,
          from_date: schedDate,
          weeks: schedWeeks,
          cargo_type: schedCargoType,
          direct_only: schedDirect
        }
      });
      setSchedulesData(res.data);
    } catch (err) {
      setSchedulesError(err.response?.data?.error || 'Failed to fetch schedules.');
    } finally {
      setSchedulesLoading(false);
    }
  };

  // ── Fetch air tracking ────────────────────────────────────────────────
  const fetchAirTracking = async () => {
    if (!awbNumber.trim()) return;
    setAirTrackingLoading(true);
    setAirTrackingError(null);
    setAirTrackingData(null);
    try {
      const res = await axios.get(`/api/containers/air/track/${encodeURIComponent(awbNumber.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAirTrackingData(res.data);
      // Auto-fetch documents: try AWB-prefixed ID (e.g. AWB70051280213)
      const cleanAwb = awbNumber.trim().replace(/[^0-9]/g, '');
      const awbDocId = `AWB${cleanAwb}`;
      fetchDocuments(awbDocId);
    } catch (err) {
      setAirTrackingError(err.response?.data?.error || 'Failed to fetch air tracking information. Please check the AWB number.');
    } finally {
      setAirTrackingLoading(false);
    }
  };

  // ── Fetch air schedules ───────────────────────────────────────────────
  const fetchAirSchedules = async () => {
    setAirSchedulesLoading(true);
    setAirSchedulesError(null);
    setAirSchedulesData(null);
    try {
      const res = await axios.get('/api/containers/air/schedules', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          origin: airOrigin,
          destination: airDest,
          departure_date: airDate,
          direct_only: airDirect
        }
      });
      setAirSchedulesData(res.data);
    } catch (err) {
      setAirSchedulesError(err.response?.data?.error || 'Failed to fetch flight schedules.');
    } finally {
      setAirSchedulesLoading(false);
    }
  };

  // ── Fetch MIND air shipments ──────────────────────────────────────────
  const fetchMindAirShipments = async (q) => {
    setMindAirLoading(true);
    try {
      const res = await axios.get('/api/containers/air/shipments', {
        headers: { Authorization: `Bearer ${token}` },
        params: q ? { q } : {}
      });
      setMindAirShipments(res.data.shipments || []);
    } catch (err) {
      setMindAirShipments([]);
    } finally {
      setMindAirLoading(false);
    }
  };

  // Load MIND air shipments on mount
  React.useEffect(() => { fetchMindAirShipments(''); }, []);

  return (
    <div className="app-shell">
      {/* Top navigation */}
      <nav className="top-nav">
        <div className="nav-brand">
          <img src={netafimLogo} alt="Netafim" className="nav-logo-img" />
        </div>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeView === 'portal' ? 'active' : ''}`}
            onClick={() => setActiveView('portal')}
          >🚢 Logistics Portal</button>
          <button
            className={`nav-tab ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveView('chat')}
          >💬 Business Chat</button>
        </div>
        <div className="nav-spacer" />
        <div className="nav-user">
          <span>Admin Portal</span>
          <button className="btn-logout" onClick={logout}>Sign Out</button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage('en')}
              style={{ padding: '3px 10px', fontSize: 11 }}
            >EN</button>
            <button
              className={`lang-btn ${i18n.language === 'fr' ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage('fr')}
              style={{ padding: '3px 10px', fontSize: 11 }}
            >FR</button>
          </div>
          <span className="version-badge">v{APP_VERSION}</span>
        </div>
      </nav>

      {/* Conditional view */}
      {activeView === 'chat' && <BusinessChat />}

      {/* ── Network Overview Stat Boxes ── */}
      {activeView === 'portal' && (
        <NetworkStatBar />
      )}

      {activeView === 'portal' && <div className="split-layout">
        {/* LEFT PANEL — App features */}
        <div className="left-panel">

          {/* ── Container Tracking ── */}
          <div className="section-card">
            <div className="section-header">
              <div className="section-icon">📦</div>
              <div>
                <div className="section-title">Container Tracking</div>
                <div className="section-subtitle">Track by container number, B/L, or booking reference</div>
              </div>
            </div>
            <div className="section-body">
              <div className="search-row">
                <div className="input-group" style={{ flex: 3 }}>
                  <label>Container / B/L Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={e => setTrackingNumber(e.target.value)}
                    placeholder="e.g. MSCU1234567 or MAEU123456789"
                    onKeyDown={e => e.key === 'Enter' && fetchTracking()}
                  />
                </div>
                <button
                  className="btn-search"
                  onClick={fetchTracking}
                  disabled={trackingLoading || !trackingNumber.trim()}
                >
                  {trackingLoading ? 'Tracking...' : '🔍 Track'}
                </button>
              </div>
              {trackingLoading && (
                <div className="loading-state">
                  <div className="spinner" /> Fetching live tracking data...
                </div>
              )}
              {trackingError && <div className="error-state">⚠️ {trackingError}</div>}
              {trackingData && <TrackingResult data={trackingData} docsData={docsData} docsLoading={docsLoading} token={token} />}


            </div>
          </div>

          {/* ── Ship Schedules ── */}
          <div className="section-card">
            <div className="section-header">
              <div className="section-icon">🗓️</div>
              <div>
                <div className="section-title">Ship Schedules</div>
                <div className="section-subtitle">Find sailing itineraries between ports</div>
              </div>
            </div>
            <div className="section-body">
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Quick Port Selection
                </div>
                <div className="port-hints">
                  {NETAFIM_PORTS.map(p => (
                    <button
                      key={p.code}
                      className="port-chip"
                      title={p.name}
                      onClick={() => {
                        if (!schedOrigin || schedOrigin === p.code) setSchedOrigin(p.code);
                        else setSchedDest(p.code);
                      }}
                    >
                      {p.code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="search-row">
                <div className="input-group">
                  <label>Origin (LOCODE)</label>
                  <input
                    type="text"
                    value={schedOrigin}
                    onChange={e => setSchedOrigin(e.target.value.toUpperCase())}
                    placeholder="ILASH"
                    maxLength={5}
                  />
                </div>
                <div className="input-group">
                  <label>Destination (LOCODE)</label>
                  <input
                    type="text"
                    value={schedDest}
                    onChange={e => setSchedDest(e.target.value.toUpperCase())}
                    placeholder="DEHAM"
                    maxLength={5}
                  />
                </div>
                <div className="input-group">
                  <label>From Date</label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={e => setSchedDate(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ maxWidth: 90 }}>
                  <label>Weeks</label>
                  <select value={schedWeeks} onChange={e => setSchedWeeks(e.target.value)}>
                    {[1,2,3,4,5,6].map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{ maxWidth: 100 }}>
                  <label>Cargo</label>
                  <select value={schedCargoType} onChange={e => setSchedCargoType(e.target.value)}>
                    <option value="GC">General</option>
                    <option value="REEF">Reefer</option>
                    <option value="LCL">LCL</option>
                    <option value="RORO">RoRo</option>
                  </select>
                </div>
                <button
                  className="btn-search"
                  onClick={fetchSchedules}
                  disabled={schedulesLoading}
                >
                  {schedulesLoading ? 'Searching...' : '🔍 Search'}
                </button>
              </div>

              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="direct-only"
                  checked={schedDirect}
                  onChange={e => setSchedDirect(e.target.checked)}
                />
                <label htmlFor="direct-only" style={{ fontSize: 13, color: 'var(--gray-600)', cursor: 'pointer' }}>
                  Direct sailings only
                </label>
              </div>

              {schedulesLoading && (
                <div className="loading-state">
                  <div className="spinner" /> Searching vessel schedules...
                </div>
              )}
              {schedulesError && <div className="error-state">⚠️ {schedulesError}</div>}
              {schedulesData && <SchedulesResult data={schedulesData} />}
            </div>
          </div>

          {/* ── Air Schedules ── */}
          <div className="section-card air-section">
            <div className="section-header">
              <div className="section-icon">✈️</div>
              <div>
                <div className="section-title">Air Schedules</div>
                <div className="section-subtitle">Find air cargo flight itineraries between airports</div>
              </div>
              <div className="air-mode-badge">AIR FREIGHT</div>
            </div>
            <div className="section-body">
              {/* Air Tracking sub-section */}
              <div className="air-tracking-subsection">
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📡</span> Air Shipment Tracking (AWB)
                </div>
                <div className="search-row">
                  <div className="input-group" style={{ flex: 3 }}>
                    <label>Air Waybill (AWB) Number</label>
                    <input
                      type="text"
                      value={awbNumber}
                      onChange={e => setAwbNumber(e.target.value)}
                      placeholder="e.g. 020-17363006 or 057-06399886"
                      onKeyDown={e => e.key === 'Enter' && fetchAirTracking()}
                    />
                  </div>
                  <button
                    className="btn-search btn-air"
                    onClick={fetchAirTracking}
                    disabled={airTrackingLoading || !awbNumber.trim()}
                  >
                    {airTrackingLoading ? 'Tracking...' : '✈️ Track'}
                  </button>
                </div>
                {airTrackingLoading && (
                  <div className="loading-state">
                    <div className="spinner" /> Fetching live air tracking data...
                  </div>
                )}
                {airTrackingError && <div className="error-state">⚠️ {airTrackingError}</div>}
                {airTrackingData && <AirTrackingResult data={airTrackingData} docsData={docsData} docsLoading={docsLoading} token={token} />}
              </div>

              {/* ── MIND Air Shipments ── */}
              <div className="mind-air-section">
                <div className="mind-air-header">
                  <span className="mind-air-title">📦 MIND Air Shipments</span>
                  <div className="mind-air-search">
                    <input
                      type="text"
                      value={mindAirQuery}
                      onChange={e => {
                        setMindAirQuery(e.target.value);
                        fetchMindAirShipments(e.target.value);
                      }}
                      placeholder="Search by shipment no., AWB, destination…"
                      className="mind-air-input"
                    />
                  </div>
                </div>
                {mindAirLoading && <div className="docs-loading">Loading…</div>}
                {!mindAirLoading && mindAirShipments.length === 0 && (
                  <div className="docs-empty">No shipments found</div>
                )}
                {!mindAirLoading && mindAirShipments.length > 0 && (
                  <table className="mind-air-table">
                    <thead>
                      <tr>
                        <th>Shipment No.</th>
                        <th>AWB</th>
                        <th>Forwarder</th>
                        <th>Destination</th>
                        <th>Type</th>
                        <th>Track</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mindAirShipments.map(s => (
                        <tr key={s.shipmentNo}>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--navy)' }}>{s.shipmentNo}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.awb}</td>
                          <td>{s.forwarder}</td>
                          <td>{s.destination}</td>
                          <td><span className="air-badge">{s.type}</span></td>
                          <td>
                            <button
                              className="btn-track-awb"
                              onClick={() => {
                                setAwbNumber(s.awb);
                                setTimeout(() => fetchAirTracking(), 50);
                              }}
                            >✈️ Track</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="air-divider"><span>Flight Schedule Search</span></div>

              {/* Airport quick-select */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Quick Airport Selection
                </div>
                <div className="port-hints">
                  {NETAFIM_AIRPORTS.map(a => (
                    <button
                      key={a.code}
                      className="port-chip air-chip"
                      title={a.name}
                      onClick={() => {
                        if (!airOrigin || airOrigin === a.code) setAirOrigin(a.code);
                        else setAirDest(a.code);
                      }}
                    >
                      {a.code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="search-row">
                <div className="input-group">
                  <label>Origin Airport (IATA)</label>
                  <input
                    type="text"
                    value={airOrigin}
                    onChange={e => setAirOrigin(e.target.value.toUpperCase())}
                    placeholder="TLV"
                    maxLength={3}
                  />
                </div>
                <div className="input-group">
                  <label>Destination Airport (IATA)</label>
                  <input
                    type="text"
                    value={airDest}
                    onChange={e => setAirDest(e.target.value.toUpperCase())}
                    placeholder="CDG"
                    maxLength={3}
                  />
                </div>
                <div className="input-group">
                  <label>Departure Date</label>
                  <input
                    type="date"
                    value={airDate}
                    onChange={e => setAirDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <button
                  className="btn-search btn-air"
                  onClick={fetchAirSchedules}
                  disabled={airSchedulesLoading}
                >
                  {airSchedulesLoading ? 'Searching...' : '✈️ Search'}
                </button>
              </div>

              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="air-direct-only"
                  checked={airDirect}
                  onChange={e => setAirDirect(e.target.checked)}
                />
                <label htmlFor="air-direct-only" style={{ fontSize: 13, color: 'var(--gray-600)', cursor: 'pointer' }}>
                  Direct flights only
                </label>
              </div>

              {airSchedulesLoading && (
                <div className="loading-state">
                  <div className="spinner" /> Searching flight schedules...
                </div>
              )}
              {airSchedulesError && <div className="error-state">⚠️ {airSchedulesError}</div>}
              {airSchedulesData && <AirSchedulesResult data={airSchedulesData} />}
            </div>
          </div>

          {/* ── Interactive Map ── */}
          <div className="section-card map-card">
            <div className="section-header">
              <div className="section-icon">🗺️</div>
              <div>
                <div className="section-title">Live Shipping Map</div>
                <div className="section-subtitle">Interactive vessel &amp; flight positions, port/airport network &amp; route visualization</div>
              </div>
            </div>
            <ShippingMap
              trackingData={trackingData}
              schedulesData={schedulesData}
              trackedContainers={trackedContainers}
              airTrackingData={airTrackingData}
              airSchedulesData={airSchedulesData}
            />
          </div>

        </div>

        {/* RIGHT PANEL — Chat agent (mobile app style) + Shipment Details */}
        <div className="right-panel">
          <ChatAgent
            airTrackingData={airTrackingData}
            airSchedulesData={airSchedulesData}
          />
          <AllContainersList />
          <ShipmentDetailsForm sapData={null} token={token} />
        </div>
      </div>}
    </div>
  );
}
