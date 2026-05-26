import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';

// ── Static shipment registry grouped by MBL ─────────────────────────────
const SEA_SHIPMENTS = [
  { mbl: 'ZIMUMER25802993', shipmentNo: '3007283', forwarder: 'BDL', scac: 'ZIMU', containers: ['ZCSU7221847'] },
  { mbl: 'MEDUXK674836', shipmentNo: '3007304', forwarder: 'BDL', scac: 'MEDU', containers: ['BMOU6008700'] },
  { mbl: 'MEDUXK687986', shipmentNo: '3007344', forwarder: 'BDL', scac: 'MEDU', containers: ['CAIU7795981'] },
  { mbl: 'MEDUKM036373', shipmentNo: '2033991', forwarder: 'Rosenthal', scac: 'MEDU', containers: ['TRHU7345364', 'MSCU5426470'] },
  { mbl: 'MEDUKM045440', shipmentNo: '2034060', forwarder: 'Rosenthal', scac: 'MEDU', containers: ['MEDU8765745'] },
  { mbl: 'MEDUKM045788', shipmentNo: '2034062', forwarder: 'Rosenthal', scac: 'MEDU', containers: ['MSNU5191379'] },
  { mbl: '265573092', shipmentNo: '3007325', forwarder: 'UNICARGO', scac: 'MAEU', containers: ['TRLU7537616', 'MRKU2456776', 'MIEU2031241', 'MRKU2810811'] },
  { mbl: '265555402', shipmentNo: '3007333', forwarder: 'UNICARGO', scac: 'MAEU', containers: ['MRSU7660635', 'MSKU1569471', 'MSKU0761303', 'MRSU5717201'] },
  { mbl: '6443358570', shipmentNo: '3007315', forwarder: 'UNICARGO', scac: 'COSU', containers: ['CSLU2384211'] },
  { mbl: '263497067', shipmentNo: '3007302', forwarder: 'UNICARGO', scac: 'MAEU', containers: ['MSKU1708833', 'HASU4794517', 'MRSU5655394', 'CAAU8976390', 'CAAU7757551', 'MRKU4153130', 'MRKU4474043', 'CAIU4649303', 'MRSU5022020', 'MRSU7535058', 'TRHU7289276', 'MRKU3855934', 'MRKU6142095', 'GAOU7139684', 'SUDU5985228', 'UETU6940030', 'HASU4593976', 'MRSU6504828', 'TGHU6962586', 'TCLU8372569'] },
  { mbl: 'ANT1975091', shipmentNo: '3007335', forwarder: 'UNICARGO', scac: 'MAEU', containers: ['TGBU6980952', 'TXGU8820344'] },
  { mbl: 'MERG00219900', shipmentNo: '3007319', forwarder: 'UNICARGO', scac: 'ONEY', containers: ['ONEU2961683'] },
  { mbl: '264232297', shipmentNo: '2033947', forwarder: 'GOA', scac: 'MAEU', containers: ['TCKU7713880', 'GAOU7866580', 'UETU8152824'] },
  { mbl: 'ONEYHAMG01212900', shipmentNo: '3007313', forwarder: 'GOA', scac: 'ONEY', containers: ['FFAU1436408'] },
  { mbl: '265804079', shipmentNo: '2034010', forwarder: 'GOA', scac: 'MAEU', containers: ['TEMU8855116'] },
  { mbl: 'ESLTURCDI0002100', shipmentNo: '3007294', forwarder: 'GOA', scac: 'ESPU', containers: ['ESDU7003087'] },
];

const SCAC_NAMES = {
  MSCU: 'MSC', MEDU: 'MSC', HDMU: 'Hyundai', MAEU: 'Maersk', ZIMU: 'ZIM',
  COSU: 'COSCO', CMDU: 'CMA CGM', ONEY: 'ONE', ESPU: 'Evergreen',
};

function statusBadge(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes('transit') || s.includes('sea')) return { label: 'In Transit', cls: 'status-transit' };
  if (s.includes('arrived') || s.includes('delivered')) return { label: 'Arrived', cls: 'status-arrived' };
  if (s.includes('loaded') || s.includes('departed')) return { label: 'Departed', cls: 'status-departed' };
  if (s.includes('discharged')) return { label: 'Discharged', cls: 'status-discharged' };
  return { label: status, cls: 'status-unknown' };
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

export default function AllContainersList() {
  const { token } = useContext(AuthContext);
  const [popup, setPopup]   = useState(null);
  const [loading, setLoading] = useState(null);
  const [error, setError]   = useState(null);

  const openStatus = async (shipment) => {
    setLoading(shipment.mbl);
    setError(null);
    setPopup(null);
    try {
      const res = await axios.get(
        `/api/containers/track/${encodeURIComponent(shipment.mbl)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data.data || res.data;
      setPopup({ shipment, data });
    } catch (err) {
      setError(shipment.mbl);
    } finally {
      setLoading(null);
    }
  };

  const closePopup = () => setPopup(null);

  const getLatestEvent = (data) => {
    const containers = data?.containers || [];
    const events = (containers[0]?.events || []).filter(e => e.actual);
    if (!events.length) return null;
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    return events[0];
  };

  const getRoute = (data) => {
    const route = data?.route || {};
    const locations = data?.locations || [];
    const locMap = {};
    locations.forEach(l => { locMap[l.id] = l; });
    const pol = locMap[route.pol?.location];
    const pod = locMap[route.pod?.location];
    return { pol, pod, eta: route.pod?.date };
  };

  const getStatus = (data) => {
    const containers = data?.containers || [];
    return containers[0]?.status || null;
  };

  const getVessel = (data) => {
    const containers = data?.containers || [];
    const events = containers[0]?.events || [];
    const withVessel = events.filter(e => e.vessel?.name);
    if (!withVessel.length) return null;
    withVessel.sort((a, b) => new Date(b.date) - new Date(a.date));
    return withVessel[0].vessel?.name;
  };

  const totalContainers = SEA_SHIPMENTS.reduce((sum, s) => sum + s.containers.length, 0);

  return (
    <>
      <div className="section-card acl-card">
        <div className="section-header">
          <div className="section-icon">📦</div>
          <div>
            <div className="section-title">All Shipments</div>
            <div className="section-subtitle">{SEA_SHIPMENTS.length} shipments ({totalContainers} containers) — click for latest status</div>
          </div>
        </div>
        <div className="section-body acl-body">
          {SEA_SHIPMENTS.map(s => {
            const isLoading = loading === s.mbl;
            const isError   = error === s.mbl;
            return (
              <button
                key={s.mbl}
                className={`acl-row${isLoading ? ' acl-row--loading' : ''}${isError ? ' acl-row--error' : ''}`}
                onClick={() => openStatus(s)}
                disabled={!!loading}
              >
                <span className="acl-icon">🚢</span>
                <span className="acl-main">
                  <span className="acl-container">{s.mbl}</span>
                  <span className="acl-meta">{s.shipmentNo} · {SCAC_NAMES[s.scac] || s.scac} · {s.forwarder} · {s.containers.length} cntr{s.containers.length > 1 ? 's' : ''}</span>
                </span>
                {isLoading
                  ? <span className="acl-spinner">⏳</span>
                  : isError
                    ? <span className="acl-err-icon" title="Could not load">⚠️</span>
                    : <span className="acl-chevron">›</span>
                }
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Status Popup ─────────────────────────────────────────────────── */}
      {popup && (() => {
        const { shipment, data } = popup;
        const latestEvent = getLatestEvent(data);
        const { pol, pod, eta } = getRoute(data);
        const status = getStatus(data);
        const vessel = getVessel(data);
        const badge = statusBadge(status);
        const allEvents = (data?.containers?.[0]?.events || [])
          .filter(e => e.actual)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);

        return (
          <div className="acl-overlay" onClick={closePopup}>
            <div className="acl-popup" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="acl-popup-header">
                <div>
                  <div className="acl-popup-title">
                    🚢 {shipment.mbl}
                    {badge && <span className={`acl-popup-badge ${badge.cls}`}>{badge.label}</span>}
                  </div>
                  <div className="acl-popup-sub">
                    Shipment {shipment.shipmentNo} · {SCAC_NAMES[shipment.scac] || shipment.scac} · {shipment.forwarder}
                  </div>
                </div>
                <button className="acl-popup-close" onClick={closePopup}>✕</button>
              </div>

              {/* Route bar */}
              {(pol || pod) && (
                <div className="acl-route-bar">
                  <div className="acl-route-port">
                    <div className="acl-route-locode">{pol?.locode || '—'}</div>
                    <div className="acl-route-name">{pol?.name || '—'}</div>
                    <div className="acl-route-date">{formatDate(data?.route?.pol?.date)}</div>
                  </div>
                  <div className="acl-route-arrow">
                    {vessel && <span className="acl-route-vessel">🚢 {vessel}</span>}
                    <span className="acl-route-line">──────────────→</span>
                  </div>
                  <div className="acl-route-port acl-route-port--right">
                    <div className="acl-route-locode">{pod?.locode || '—'}</div>
                    <div className="acl-route-name">{pod?.name || '—'}</div>
                    <div className="acl-route-date" style={{ color: '#2563eb' }}>{formatDate(eta)}</div>
                  </div>
                </div>
              )}

              {/* Latest event highlight */}
              {latestEvent && (
                <div className="acl-latest-event">
                  <span className="acl-le-label">Latest update</span>
                  <span className="acl-le-date">{formatDate(latestEvent.date)}</span>
                  <span className="acl-le-desc">{latestEvent.description || latestEvent.type}</span>
                  {latestEvent.location && (
                    <span className="acl-le-loc">
                      📍 {data?.locations?.find(l => l.id === latestEvent.location)?.name || latestEvent.location}
                    </span>
                  )}
                </div>
              )}

              {/* Containers list */}
              <div className="acl-containers-list">
                <div className="acl-events-title">Containers ({shipment.containers.length})</div>
                <div className="acl-containers-grid">
                  {shipment.containers.map(c => (
                    <span key={c} className="acl-container-chip">{c}</span>
                  ))}
                </div>
              </div>

              {/* Recent events */}
              {allEvents.length > 0 && (
                <div className="acl-events">
                  <div className="acl-events-title">Recent Events</div>
                  {allEvents.map((ev, i) => {
                    const loc = data?.locations?.find(l => l.id === ev.location);
                    return (
                      <div key={i} className="acl-event-row">
                        <span className="acl-ev-dot" />
                        <span className="acl-ev-date">{formatDate(ev.date)}</span>
                        <span className="acl-ev-desc">{ev.description || ev.type}</span>
                        {loc && <span className="acl-ev-loc">{loc.name}</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="acl-popup-footer">
                MBL: <strong>{shipment.mbl}</strong> · Shipment: <strong>{shipment.shipmentNo}</strong>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
