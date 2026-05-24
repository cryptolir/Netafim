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
      ['3007308', 'MEDUXK675106', 'GOA', 'MSNU8656572'],
      ['3007373', 'HLCUIZ1260201827', 'GOA', 'HLBU1333628'],
      ['2034143', 'EBKG16025165', 'GOA', 'FFAU5533113'],
      ['3007337', '265858161', 'GOA', 'TCKU7806690'],
      ['4011660', 'VIEA40642', 'DHL', 'MSBU4228120'],
      ['4011676', 'ZIMUIAH985650', 'FRITZ', 'JZPU8021158, JXLU6468215, ZCSU6927417, GAOU7588197'],
      ['2034114', 'MEDUKM055225', 'Rosenthal', 'TXGU5057347'],
      ['2034110', '721336190', 'FRITZ', 'GCXU5788346'],
      ['3007394', 'VIE0244556', 'UNICARGO', 'APHU7018733'],
      ['3007315', '6443358570', 'UNICARGO', 'CSLU2384211'],
      ['3007321', 'ZIMUMER26803264', 'BDL', 'ZCSU6524670'],
    ],
  },
  active: {
    title: 'Active Shipments',
    icon: '🚢',
    rows: [
      ['Shipment', 'Type', 'Forwarder', 'Reference'],
      ['3007308', 'Sea', 'GOA', 'MEDUXK675106'],
      ['3007373', 'Sea', 'GOA', 'HLCUIZ1260201827'],
      ['2034143', 'Sea', 'GOA', 'EBKG16025165'],
      ['3007337', 'Sea', 'GOA', '265858161'],
      ['4011660', 'Sea', 'DHL', 'VIEA40642'],
      ['4011676', 'Sea', 'FRITZ', 'ZIMUIAH985650'],
      ['2034114', 'Sea', 'Rosenthal', 'MEDUKM055225'],
      ['2034110', 'Sea', 'FRITZ', '721336190'],
      ['3007394', 'Sea', 'UNICARGO', 'VIE0244556'],
      ['3007315', 'Sea', 'UNICARGO', '6443358570'],
      ['3007321', 'Sea', 'BDL', 'ZIMUMER26803264'],
      ['2440348', 'Air', 'FC', 'AWB 700-5128021300'],
      ['2440321', 'Air', 'FC', 'AWB 716-0188634'],
      ['2440328', 'Air', 'Fritz', 'AWB 114-64228592'],
    ],
  },
  inprogress: {
    title: 'Shipping In Progress',
    icon: '🗺️',
    rows: [
      ['Shipment', 'MBL', 'Carrier', 'Forwarder'],
      ['3007308', 'MEDUXK675106', 'MSC', 'GOA'],
      ['3007373', 'HLCUIZ1260201827', 'Hapag-Lloyd', 'GOA'],
      ['2034143', 'EBKG16025165', 'MSC', 'GOA'],
      ['3007337', '265858161', 'Maersk', 'GOA'],
      ['4011660', 'VIEA40642', 'MSC', 'DHL'],
      ['4011676', 'ZIMUIAH985650', 'ZIM', 'FRITZ'],
      ['2034114', 'MEDUKM055225', 'MSC', 'Rosenthal'],
      ['2034110', '721336190', 'Maersk', 'FRITZ'],
      ['3007394', 'VIE0244556', 'CMA CGM', 'UNICARGO'],
      ['3007315', '6443358570', 'COSCO', 'UNICARGO'],
      ['3007321', 'ZIMUMER26803264', 'ZIM', 'BDL'],
    ],
  },
  air: {
    title: 'Air Shipments',
    icon: '✈️',
    rows: [
      ['AWB', 'Shipment', 'Origin', 'Destination', 'Forwarder'],
      ['700-5128021300', '2440348', 'Tel Aviv (TLV)', 'Jakarta (CGK)', 'FC'],
      ['716-0188634', '2440321', 'Tel Aviv (TLV)', 'Cape Town (CPT)', 'FC'],
      ['114-64228592', '2440328', 'Tel Aviv (TLV)', 'Lima (LIM)', 'Fritz'],
    ],
  },
  forwarders: {
    title: 'Freight Forwarders',
    icon: '🤝',
    rows: [
      ['Forwarder', 'Shipments', 'Type'],
      ['GOA', '4', 'Sea'],
      ['DHL', '1', 'Sea'],
      ['FRITZ', '2', 'Sea + Air'],
      ['Rosenthal', '1', 'Sea'],
      ['UNICARGO', '2', 'Sea'],
      ['BDL', '1', 'Sea'],
      ['FC', '2', 'Air'],
    ],
  },
};

function NetworkStatBar() {
  const [openPopup, setOpenPopup] = React.useState(null);
  const stats = [
    { key: 'containers', value: 14, label: 'TOTAL CONTAINERS', icon: '📦' },
    { key: 'active',     value: 14, label: 'ACTIVE SHIPMENTS', icon: '🚢' },
    { key: 'inprogress', value: 11, label: 'SHIPPING IN PROGRESS', icon: '🗺️' },
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
        {metadata.sealine_name && (
          <div className="meta-item">
            <div className="meta-label">Shipping Line</div>
            <div className="meta-value">{metadata.sealine_name}</div>
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
        {metadata.updated_at && (
          <div className="meta-item">
            <div className="meta-label">Last Updated</div>
            <div className="meta-value">{formatDate(metadata.updated_at)}</div>
          </div>
        )}

      </div>

      {/* Events + Documents side-by-side */}
      {(events.length > 0 || docsLoading || hasDocs) && (
        <div className="events-docs-row">
          {/* Left: Shipment Events */}
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
  if (!data) return null;
  const schedules = data.data?.schedules || data.schedules || [];
  if (schedules.length === 0) {
    return <div className="empty-state"><div className="empty-icon">🔍</div><p>No schedules found for this route.</p></div>;
  }

  return (
    <div className="schedules-table-wrap">
      <table className="schedules-table">
        <thead>
          <tr>
            <th>Carrier</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Transit</th>
            <th>Route</th>
            <th>Service</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((s, i) => {
            const firstLeg = s.legs?.[0] || {};
            const lastLeg = s.legs?.[s.legs.length - 1] || {};
            return (
              <tr key={i}>
                <td>
                  <span className="carrier-badge">🚢 {s.carrier_name || s.carrier_scac}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{formatDate(s.origin?.estimated_date || firstLeg.departure?.estimated_date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.origin?.port_name}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{formatDate(s.destination?.estimated_date || lastLeg.arrival?.estimated_date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{s.destination?.port_name}</div>
                </td>
                <td><span className="transit-time">{s.transit_time}d</span></td>
                <td>
                  {s.direct
                    ? <span className="direct-badge">Direct</span>
                    : <span className="via-badge">{s.legs?.length} leg{s.legs?.length > 1 ? 's' : ''}</span>
                  }
                </td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  {firstLeg.service_name || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Air Tracking Result ────────────────────────────────────────────────────
function AirTrackingResult({ data }) {
  if (!data) return null;
  const meta = data.metadata || {};
  const info = data.data || {};
  const routes = info.routes || [];
  const events = info.events || [];
  const airline = meta.airline || {};
  const status = info.status || 'Unknown';
  const isFallback = data.isFallback === true;

  const statusColor = (s) => {
    if (!s) return '#94a3b8';
    const l = s.toLowerCase();
    if (l === 'delivered') return '#16a34a';
    if (l === 'in_transit' || l === 'in transit' || l === 'departed') return '#2563eb';
    if (l === 'arrived') return '#d97706';
    return '#94a3b8';
  };

  // ── Fallback card (MIND data only) ──────────────────────────────────────
  if (isFallback) {
    return (
      <div className="tracking-result">
        <div className="tracking-header">
          <div className="container-number" style={{ fontSize: 14 }}>✈️ {info.awb || meta.request_parameters?.number || '—'}</div>
          <span className="status-badge" style={{ background: '#2563eb', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>IN TRANSIT</span>
        </div>
        {/* Route visual using file data */}
        <div className="route-visual">
          <div className="route-port">
            <div className="port-code">{info.origin ? info.origin.match(/\(([^)]+)\)/)?.[1] || 'TLV' : 'TLV'}</div>
            <div className="port-name">{info.origin ? info.origin.replace(/\s*\([^)]*\)/, '') : 'Tel Aviv'}</div>
          </div>
          <div className="route-arrow">
            <div className="route-line" />
            <div className="route-vessel">✈️ Air Export</div>
          </div>
          <div className="route-port">
            <div className="port-code">{info.destination ? info.destination.match(/\(([^)]+)\)/)?.[1] || info.destination.slice(0,3).toUpperCase() : '—'}</div>
            <div className="port-name">{info.destination ? info.destination.replace(/\s*\([^)]*\)/, '') : '—'}</div>
          </div>
        </div>
        <div className="tracking-meta">
          <div className="meta-item">
            <div className="meta-label">AWB</div>
            <div className="meta-value" style={{ fontFamily: 'monospace' }}>{info.awb || '—'}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Shipment No.</div>
            <div className="meta-value" style={{ fontFamily: 'monospace' }}>{info.shipmentNo || '—'}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Forwarder</div>
            <div className="meta-value">{info.forwarder || '—'}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Type</div>
            <div className="meta-value">{info.type || '—'}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-result">
      <div className="tracking-header">
        <div className="container-number" style={{ fontSize: 14 }}>
          ✈️ {meta.request_parameters?.number || '—'}
        </div>
        <span className="status-badge" style={{
          background: statusColor(status), color: '#fff', borderRadius: 6,
          padding: '3px 10px', fontSize: 11, fontWeight: 700
        }}>{status.replace(/_/g, ' ')}</span>
      </div>

      {/* Route visual */}
      {(info.from || info.to) && (
        <div className="route-visual">
          <div className="route-port">
            <div className="port-code">{info.from?.iata_code || '—'}</div>
            <div className="port-name">{info.from?.nearest_city || info.from?.name || 'Origin'}</div>
            <div className="port-date">{formatDate(info.departure_datetime_local?.actual || info.departure_datetime_local?.estimated)}</div>
          </div>
          <div className="route-arrow">
            <div className="route-line" />
            <div className="route-vessel">✈️ {airline.name || info.flight_number || ''}</div>
          </div>
          <div className="route-port">
            <div className="port-code">{info.to?.iata_code || '—'}</div>
            <div className="port-name">{info.to?.nearest_city || info.to?.name || 'Destination'}</div>
            <div className="port-date">
              {info.arrival_datetime_local?.actual
                ? `Arrived: ${formatDate(info.arrival_datetime_local.actual)}`
                : info.arrival_datetime_local?.estimated
                  ? `ETA: ${formatDate(info.arrival_datetime_local.estimated)}`
                  : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Meta info */}
      <div className="tracking-meta">
        {airline.name && (
          <div className="meta-item">
            <div className="meta-label">Airline</div>
            <div className="meta-value">{airline.name} ({airline.iata_code})</div>
          </div>
        )}
        {info.flight_number && (
          <div className="meta-item">
            <div className="meta-label">Flight</div>
            <div className="meta-value">{info.flight_number}</div>
          </div>
        )}
        {info.piece !== undefined && (
          <div className="meta-item">
            <div className="meta-label">Pieces</div>
            <div className="meta-value">{info.piece}</div>
          </div>
        )}
        {info.weight !== undefined && (
          <div className="meta-item">
            <div className="meta-label">Weight</div>
            <div className="meta-value">{info.weight} kg</div>
          </div>
        )}
        {meta.updated_at && (
          <div className="meta-item">
            <div className="meta-label">Last Updated</div>
            <div className="meta-value">{formatDate(meta.updated_at)}</div>
          </div>
        )}
      </div>

      {/* Route legs */}
      {routes.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)', marginBottom: 8, marginTop: 4 }}>
            Flight Legs
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {routes.map((leg, i) => (
              <div key={i} style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                padding: '10px 12px', borderLeft: `3px solid ${statusColor(leg.status)}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>
                    {leg.from?.iata_code} → {leg.to?.iata_code}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#fff',
                    background: statusColor(leg.status), borderRadius: 4, padding: '2px 6px'
                  }}>{(leg.status || '').replace(/_/g, ' ')}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  ✈️ {leg.flight_number || '—'} &nbsp;·&nbsp;
                  {leg.transport_type === 'TRUCK' ? '🚛 Truck' : '✈️ Air'}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                  Dep: {formatDate(leg.departure_datetime_local?.actual || leg.departure_datetime_local?.estimated)}
                  &nbsp;→&nbsp;
                  Arr: {formatDate(leg.arrival_datetime_local?.actual || leg.arrival_datetime_local?.estimated)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Events */}
      {events.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)', marginBottom: 8, marginTop: 12 }}>
            Shipment Events
          </div>
          <div className="timeline">
            {events.slice(0, 10).map((ev, i) => (
              <div key={i} className={`timeline-event ${ev.datetime_local?.actual ? 'actual' : 'estimated'}`}>
                <div className="event-date">
                  {formatDate(ev.datetime_local?.actual || ev.datetime_local?.estimated)}
                  {!ev.datetime_local?.actual ? ' (est.)' : ''}
                </div>
                <div className="event-desc">{ev.description || ev.event_code}</div>
                <div className="event-location">
                  {ev.location?.nearest_city || ev.location?.name || ''}
                  {ev.location?.country ? `, ${ev.location.country}` : ''}
                  {ev.flight_number ? ` · ✈️ ${ev.flight_number}` : ''}
                </div>
              </div>
            ))}
          </div>
        </>
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

function ShipmentDetailsForm({ sapData }) {
  const [formData, setFormData] = useState({
    businessUnit: '',
    consignee: '',
    country: '',
    project: '',
    actualShippingCost: sapData?.actualShippingCost || '',
    reportType: '',
  });
  const [generated, setGenerated] = useState(false);

  // SAP-sourced read-only values
  const plannedShippingCost = sapData?.plannedShippingCost || 'N/A';
  const annualShippingCost = sapData?.annualShippingCost || 'N/A';

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setGenerated(false);
  };

  const handleGenerate = () => {
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
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
          <div className="section-title">Shipment Details</div>
          <div className="section-subtitle">Business data linked to this shipment (sourced from SAP)</div>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            className="btn-search"
            onClick={handleGenerate}
            style={{ minWidth: 150 }}
          >
            {generated ? '✅ Report Generated' : '📊 Generate Report'}
          </button>
        </div>
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
      const innerData = res.data.data || res.data;
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

      // Auto-fetch documents for the tracked container
      fetchDocuments(trackingNumber.trim().toUpperCase());

      setTrackedContainers(prev => {
        const existing = prev.find(c => c.number === trackingNumber.trim().toUpperCase());
        if (existing) return prev;
        return [...prev, {
          number: trackingNumber.trim().toUpperCase(),
          status: metadata.status || container.status || 'UNKNOWN',
          carrier: metadata.carrier_name || metadata.carrier_scac || '—',
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
                {airTrackingData && <AirTrackingResult data={airTrackingData} />}
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
          <ShipmentDetailsForm sapData={null} />
        </div>
      </div>}
    </div>
  );
}
