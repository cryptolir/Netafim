import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';

// ── Static container registry from shipment files ─────────────────────────
const SEA_CONTAINERS = [
  { containerNo: 'MSNU8656572', shipmentNo: '3007308', forwarder: 'GOA',       scac: 'MSCU', mbl: 'MEDUXK675106' },
  { containerNo: 'HLBU1333628', shipmentNo: '3007373', forwarder: 'GOA',       scac: 'HDMU', mbl: 'HLCUIZ1260201827' },
  { containerNo: 'FFAU5533113', shipmentNo: '2034143', forwarder: 'GOA',       scac: 'MSCU', mbl: 'EBKG16025165' },
  { containerNo: 'TCKU7806690', shipmentNo: '3007337', forwarder: 'GOA',       scac: 'MAEU', mbl: '265858161' },
  { containerNo: 'MSBU4228120', shipmentNo: '4011660', forwarder: 'DHL',       scac: 'MSCU', mbl: 'VIEA40642' },
  { containerNo: 'JZPU8021158', shipmentNo: '4011676', forwarder: 'FRITZ',     scac: 'ZIMU', mbl: 'ZIMUIAH985650' },
  { containerNo: 'JXLU6468215', shipmentNo: '4011676', forwarder: 'FRITZ',     scac: 'ZIMU', mbl: 'ZIMUIAH985650' },
  { containerNo: 'ZCSU6927417', shipmentNo: '4011676', forwarder: 'FRITZ',     scac: 'ZIMU', mbl: 'ZIMUIAH985650' },
  { containerNo: 'GAOU7588197', shipmentNo: '4011676', forwarder: 'FRITZ',     scac: 'ZIMU', mbl: 'ZIMUIAH985650' },
  { containerNo: 'TXGU5057347', shipmentNo: '2034114', forwarder: 'Rosenthal', scac: 'MSCU', mbl: 'MEDUKM055225' },
  { containerNo: 'GCXU5788346', shipmentNo: '2034110', forwarder: 'FRITZ',     scac: 'MAEU', mbl: '721336190' },
  { containerNo: 'APHU7018733', shipmentNo: '3007394', forwarder: 'UNICARGO',  scac: 'CMDU', mbl: 'VIE0244556' },
  { containerNo: 'CSLU2384211', shipmentNo: '3007315', forwarder: 'UNICARGO',  scac: 'COSU', mbl: '6443358570' },
  { containerNo: 'ZCSU6524670', shipmentNo: '3007321', forwarder: 'BDL',       scac: 'ZIMU', mbl: 'ZIMUMER26803264' },
];

const SCAC_NAMES = {
  MSCU: 'MSC', HDMU: 'Hyundai', MAEU: 'Maersk', ZIMU: 'ZIM',
  COSU: 'COSCO', CMDU: 'CMA CGM',
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
