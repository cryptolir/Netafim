import React, { useState, useContext } from 'react';
import netafimLogo from '../netafim-logo.png';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../contexts/AuthContext';
import ChatAgent from './ChatAgent';
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

function TrackingResult({ data }) {
  if (!data) return null;

  // The API returns locations/facilities as arrays; route/events reference them by integer ID
  const metadata = data.metadata || {};
  const route = data.route || {};
  const containers = data.containers || [];
  const vessels = data.vessels || [];
  const container = containers[0] || {};
  const events = container.events || [];

  // Build lookup maps by id
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

  // Pick the most recent vessel
  const lastVesselEvent = [...events].reverse().find(e => e.vessel);
  const mainVessel = vesMap[lastVesselEvent?.vessel] || vessels[0] || {};

  const status = metadata.status || container.status || 'Unknown';

  return (
    <div className="tracking-result">
      <div className="tracking-header">
        <div className="container-number">{metadata.number || '—'}</div>
        <span className={`status-badge ${getStatusClass(status)}`}>{status.replace(/_/g, ' ')}</span>
      </div>

      {/* Route visual */}
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

      {/* Meta info */}
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
        {metadata.api_calls && (
          <div className="meta-item">
            <div className="meta-label">API Calls Remaining</div>
            <div className="meta-value">{metadata.api_calls.remaining} / {metadata.api_calls.total}</div>
          </div>
        )}
      </div>

      {/* Event timeline */}
      {events.length > 0 && (
        <>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)', marginBottom: 12 }}>
            Shipment Events
          </div>
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
        </>
      )}
    </div>
  );
}

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

export default function ClientPortal() {
  const { token, logout } = useContext(AuthContext);
  const { t, i18n } = useTranslation();

  // Tracking state
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState(null);

  // Schedules state
  const [schedOrigin, setSchedOrigin] = useState('ILASH');
  const [schedDest, setSchedDest] = useState('DEHAM');
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedWeeks, setSchedWeeks] = useState('4');
  const [schedCargoType, setSchedCargoType] = useState('GC');
  const [schedDirect, setSchedDirect] = useState(false);
  const [schedulesData, setSchedulesData] = useState(null);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [schedulesError, setSchedulesError] = useState(null);

  const fetchTracking = async () => {
    if (!trackingNumber.trim()) return;
    setTrackingLoading(true);
    setTrackingError(null);
    setTrackingData(null);
    try {
      const res = await axios.get(`/api/containers/track/${encodeURIComponent(trackingNumber.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Searates API returns { status, data: { metadata, locations, ... } }
      // Pass the inner 'data' object to TrackingResult
      setTrackingData(res.data.data || res.data);
    } catch (err) {
      setTrackingError(err.response?.data?.error || 'Failed to fetch tracking information. Please check the container number.');
    } finally {
      setTrackingLoading(false);
    }
  };

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

  return (
    <div className="app-shell">
      {/* Top navigation */}
      <nav className="top-nav">
        <div className="nav-brand">
          <img src={netafimLogo} alt="Netafim" className="nav-logo-img" />
        </div>
        <div className="nav-spacer" />
        <div className="nav-user">
          <span>Client Portal</span>
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
        </div>
      </nav>

      {/* Split layout */}
      <div className="split-layout">
        {/* LEFT PANEL — App features */}
        <div className="left-panel">

          {/* Container Tracking */}
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
              {trackingData && <TrackingResult data={trackingData} />}
            </div>
          </div>

          {/* Ship Schedules */}
          <div className="section-card">
            <div className="section-header">
              <div className="section-icon">🗓️</div>
              <div>
                <div className="section-title">Ship Schedules</div>
                <div className="section-subtitle">Find sailing itineraries between ports</div>
              </div>
            </div>
            <div className="section-body">
              {/* Port quick-select */}
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

          {/* Interactive Map */}
          <div className="section-card map-card">
            <div className="section-header">
              <div className="section-icon">🗺️</div>
              <div>
                <div className="section-title">Live Shipping Map</div>
                <div className="section-subtitle">Interactive vessel positions, port network &amp; route visualization</div>
              </div>
            </div>
            <ShippingMap
              trackingData={trackingData}
              schedulesData={schedulesData}
            />
          </div>

        </div>

        {/* RIGHT PANEL — Chat agent (mobile app style) */}
        <div className="right-panel">
          <ChatAgent />
        </div>
      </div>
    </div>
  );
}
