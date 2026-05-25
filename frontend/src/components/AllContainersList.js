import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';

// ── Static container registry from shipment files ─────────────────────────
const SEA_CONTAINERS = [
  { containerNo: 'ZCSU7221847', shipmentNo: '3007283', forwarder: 'BDL',       scac: 'ZIMU', mbl: 'ZIMUMER25802993' },
  { containerNo: 'BMOU6008700', shipmentNo: '3007304', forwarder: 'BDL',       scac: 'MEDU', mbl: 'MEDUXK674836' },
  { containerNo: 'CAIU7795981', shipmentNo: '3007344', forwarder: 'BDL',       scac: 'MEDU', mbl: 'MEDUXK687986' },
  { containerNo: 'TRHU7345364', shipmentNo: '2033991', forwarder: 'Rosenthal', scac: 'MEDU', mbl: 'MEDUKM036373' },
  { containerNo: 'MSCU5426470', shipmentNo: '2033991', forwarder: 'Rosenthal', scac: 'MEDU', mbl: 'MEDUKM036373' },
  { containerNo: 'MEDU8765745', shipmentNo: '2034060', forwarder: 'Rosenthal', scac: 'MEDU', mbl: 'MEDUKM045440' },
  { containerNo: 'MSNU5191379', shipmentNo: '2034062', forwarder: 'Rosenthal', scac: 'MEDU', mbl: 'MEDUKM045788' },
  { containerNo: 'TRLU7537616', shipmentNo: '3007325', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '265573092' },
  { containerNo: 'MRKU2456776', shipmentNo: '3007325', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '265573092' },
  { containerNo: 'MIEU2031241', shipmentNo: '3007325', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '265573092' },
  { containerNo: 'MRKU2810811', shipmentNo: '3007325', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '265573092' },
  { containerNo: 'MRSU7660635', shipmentNo: '3007333', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '265555402' },
  { containerNo: 'MSKU1569471', shipmentNo: '3007333', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '265555402' },
  { containerNo: 'MSKU0761303', shipmentNo: '3007333', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '265555402' },
  { containerNo: 'MRSU5717201', shipmentNo: '3007333', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '265555402' },
  { containerNo: 'CSLU2384211', shipmentNo: '3007315', forwarder: 'UNICARGO',  scac: 'COSU', mbl: '6443358570' },
  { containerNo: 'MSKU1708833', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'HASU4794517', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'MRSU5655394', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'CAAU8976390', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'CAAU7757551', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'MRKU4153130', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'MRKU4474043', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'CAIU4649303', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'MRSU5022020', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'MRSU7535058', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'TRHU7289276', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'MRKU3855934', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'MRKU6142095', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'GAOU7139684', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'SUDU5985228', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'UETU6940030', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'HASU4593976', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'MRSU6504828', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'TGHU6962586', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'TCLU8372569', shipmentNo: '3007302', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: '263497067' },
  { containerNo: 'TGBU6980952', shipmentNo: '3007335', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: 'ANT1975091' },
  { containerNo: 'TXGU8820344', shipmentNo: '3007335', forwarder: 'UNICARGO',  scac: 'MAEU', mbl: 'ANT1975091' },
  { containerNo: 'ONEU2961683', shipmentNo: '3007319', forwarder: 'UNICARGO',  scac: 'ONEY', mbl: 'MERG00219900' },
  { containerNo: 'TCKU7713880', shipmentNo: '2033947', forwarder: 'GOA',       scac: 'MAEU', mbl: '264232297' },
  { containerNo: 'FFAU1436408', shipmentNo: '3007313', forwarder: 'GOA',       scac: 'ONEY', mbl: 'ONEYHAMG01212900' },
  { containerNo: 'TEMU8855116', shipmentNo: '2034010', forwarder: 'GOA',       scac: 'MAEU', mbl: '265804079' },
  { containerNo: 'ESDU7003087', shipmentNo: '3007294', forwarder: 'GOA',       scac: 'ESPU', mbl: 'ESLTURCDI0002100' },
  { containerNo: 'GAOU7866580', shipmentNo: '2033944', forwarder: 'GOA',       scac: 'MAEU', mbl: '264232297' },
  { containerNo: 'UETU8152824', shipmentNo: '2033947', forwarder: 'GOA',       scac: 'MAEU', mbl: '264232297' },
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
  const [popup, setPopup]   = useState(null);   // { container, data } | null
  const [loading, setLoading] = useState(null);  // containerNo being loaded
  const [error, setError]   = useState(null);

  const openStatus = async (c) => {
    setLoading(c.containerNo);
    setError(null);
    setPopup(null);
    try {
      const res = await axios.get(
        `/api/containers/track/${encodeURIComponent(c.containerNo)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = res.data.data || res.data;
      setPopup({ container: c, data });
    } catch (err) {
      setError(c.containerNo);
    } finally {
      setLoading(null);
    }
  };

  const closePopup = () => setPopup(null);

  // Extract latest event from tracking data
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

  return (
    <>
      <div className="section-card acl-card">
        <div className="section-header">
          <div className="section-icon">📦</div>
          <div>
            <div className="section-title">All Containers</div>
            <div className="section-subtitle">{SEA_CONTAINERS.length} sea containers — click for latest status</div>
          </div>
        </div>
        <div className="section-body acl-body">
          {SEA_CONTAINERS.map(c => {
            const isLoading = loading === c.containerNo;
            const isError   = error === c.containerNo;
            return (
              <button
                key={c.containerNo}
                className={`acl-row${isLoading ? ' acl-row--loading' : ''}${isError ? ' acl-row--error' : ''}`}
                onClick={() => openStatus(c)}
                disabled={!!loading}
              >
                <span className="acl-icon">🚢</span>
                <span className="acl-main">
                  <span className="acl-container">{c.containerNo}</span>
                  <span className="acl-meta">{c.shipmentNo} · {SCAC_NAMES[c.scac] || c.scac} · {c.forwarder}</span>
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
        const { container, data } = popup;
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
                    🚢 {container.containerNo}
                    {badge && <span className={`acl-popup-badge ${badge.cls}`}>{badge.label}</span>}
                  </div>
                  <div className="acl-popup-sub">
                    Shipment {container.shipmentNo} · {SCAC_NAMES[container.scac] || container.scac} · {container.forwarder}
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

              {/* MBL */}
              <div className="acl-popup-footer">
                MBL: <strong>{container.mbl}</strong>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
