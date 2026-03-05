import React, { useEffect, useState, useContext, useCallback, useMemo, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Polyline,
  CircleMarker, Tooltip, useMap
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';

// Fix Leaflet default icon paths broken by webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Icons ──────────────────────────────────────────────────────────────────
const makeCircleIcon = (bg, size = 14, border = '#fff', borderW = 2.5) =>
  L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${bg};border:${borderW}px solid ${border};border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const netafimPortIcon = makeCircleIcon('#1565c0', 12);
const netafimPortHighlightIcon = makeCircleIcon('#e65100', 16, '#fff', 3);
const originIcon = makeCircleIcon('#16a34a', 16);
const destIcon = makeCircleIcon('#dc2626', 16);
const waypointIcon = makeCircleIcon('#64748b', 10, '#fff', 2);
const vesselIcon = L.divIcon({
  className: '',
  html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));">🚢</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// ── Helpers ────────────────────────────────────────────────────────────────
function greatCirclePoints(lat1, lng1, lat2, lng2, n = 60) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const φ1 = toRad(lat1), λ1 = toRad(lng1);
    const φ2 = toRad(lat2), λ2 = toRad(lng2);
    const A = Math.sin((1 - f) * φ1), B = Math.sin(f * φ2);
    const C = Math.cos((1 - f) * φ1) * Math.cos(λ1), D = Math.cos(f * φ2) * Math.cos(λ2);
    const E = Math.cos((1 - f) * φ1) * Math.sin(λ1), F = Math.cos(f * φ2) * Math.sin(λ2);
    const x = C + D, y = E + F, z = A + B;
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}

function formatDate(d) {
  if (!d || d === '—') return '—';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function statusColor(s) {
  if (!s) return '#94a3b8';
  const l = s.toLowerCase();
  if (l.includes('transit') || l.includes('vessel')) return '#2563eb';
  if (l.includes('deliver') || l.includes('discharg')) return '#16a34a';
  if (l.includes('port') || l.includes('terminal') || l.includes('gate')) return '#d97706';
  return '#94a3b8';
}

// ── Sub-components ─────────────────────────────────────────────────────────
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 1) {
      try { map.fitBounds(L.latLngBounds(positions), { padding: [50, 50], maxZoom: 8 }); }
      catch {}
    }
  }, [positions, map]);
  return null;
}

function MapRef({ mapRef }) {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
}

// ── Port click side panel ──────────────────────────────────────────────────
function PortPanel({ selectedPort, onClose }) {
  if (!selectedPort) return null;
  const { port, containers } = selectedPort;
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12,
      width: 300, maxHeight: 'calc(100% - 24px)',
      background: '#fff', borderRadius: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', border: '1px solid #e2e8f0',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a2342 0%, #1565c0 100%)',
        padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>🏭 {port.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
            {port.country} · LOCODE: {port.locode || port.code}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
          borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8,
        }}>✕</button>
      </div>
      {/* Body */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '10px 12px' }}>
        {containers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>No containers tracked at this port</div>
            <div style={{ fontSize: 11, marginTop: 6, color: '#94a3b8', lineHeight: 1.5 }}>
              Track a container with <strong>{port.locode || port.code}</strong> as origin or destination to see it here.
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
              {containers.length} container{containers.length > 1 ? 's' : ''} via this port
            </div>
            {containers.map((c, i) => {
              const locode = (port.locode || port.code || '').toUpperCase();
              const isOrigin = (c.polCode || '').toUpperCase() === locode;
              const isWaypoint = !isOrigin && (c.polCode || '').toUpperCase() !== locode && (c.podCode || '').toUpperCase() !== locode;
              const role = isOrigin ? 'Origin' : isWaypoint ? 'Waypoint' : 'Destination';
              const roleColor = isOrigin ? '#16a34a' : isWaypoint ? '#d97706' : '#dc2626';
              return (
                <div key={i} style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '10px 12px', marginBottom: 8,
                  borderLeft: `3px solid ${statusColor(c.status)}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0a2342', fontFamily: 'monospace' }}>{c.number}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: '#fff',
                      background: statusColor(c.status), borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                    }}>{(c.status || 'UNKNOWN').replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: roleColor, fontWeight: 600, marginTop: 4 }}>
                    {isOrigin ? '🟢' : isWaypoint ? '🟡' : '🔴'} {role} at this port
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                    {isOrigin ? `→ ${c.podName || c.podCode || '—'}` : `← ${c.polName || c.polCode || '—'}`}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 11, color: '#94a3b8' }}>
                    <span>🚢 {c.carrier}</span>
                    {c.eta && c.eta !== '—' && <span>📅 ETA: {formatDate(c.eta)}</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ShippingMap({ trackingData, schedulesData, trackedContainers = [] }) {
  const { token } = useContext(AuthContext);
  const [netafimPorts, setNetafimPorts] = useState([]);
  const [mapLayer, setMapLayer] = useState('standard');
  const [selectedPort, setSelectedPort] = useState(null);
  const mapRef = useRef(null);

  // Load Netafim default ports
  useEffect(() => {
    axios.get('/api/containers/ports', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setNetafimPorts(res.data.ports || []))
      .catch(() => {});
  }, [token]);

  // Build a merged port list: Netafim defaults + all ports from tracked containers
  const allPorts = useMemo(() => {
    const portMap = {};
    // Add Netafim ports first
    netafimPorts.forEach(p => {
      portMap[p.code.toUpperCase()] = { ...p, locode: p.code, isNetafim: true };
    });
    // Add dynamic ports from tracked containers
    trackedContainers.forEach(c => {
      (c.ports || []).forEach(p => {
        const key = (p.locode || '').toUpperCase();
        if (key && !portMap[key]) {
          portMap[key] = {
            code: p.locode, locode: p.locode, name: p.name,
            country: p.country, lat: p.lat, lng: p.lng, isNetafim: false,
          };
        }
      });
    });
    return Object.values(portMap).filter(p => p.lat && p.lng);
  }, [netafimPorts, trackedContainers]);

  // For each port, find containers that passed through it
  const getContainersAtPort = useCallback((locode) => {
    const code = (locode || '').toUpperCase();
    return trackedContainers.filter(c =>
      (c.polCode || '').toUpperCase() === code ||
      (c.podCode || '').toUpperCase() === code ||
      (c.ports || []).some(p => (p.locode || '').toUpperCase() === code)
    );
  }, [trackedContainers]);

  const handlePortClick = useCallback((port) => {
    const locode = (port.locode || port.code || '').toUpperCase();
    const containers = getContainersAtPort(locode);
    setSelectedPort({ port, containers });
  }, [getContainersAtPort]);

  // Extract tracking geo data
  const trackingGeo = useMemo(() => {
    if (!trackingData) return null;
    const d = trackingData.data ? trackingData.data : trackingData;
    const locations = d.locations || [];
    const vessels = d.vessels || [];
    const containers = d.containers || [];
    const route = d.route || {};
    const ais = d.ais || null;
    const locMap = {};
    locations.forEach(l => { locMap[l.id] = l; });
    const polLoc = locMap[route.pol?.location];
    const podLoc = locMap[route.pod?.location];
    const eventLocations = [];
    const seen = new Set();
    (containers[0]?.events || []).forEach(ev => {
      const loc = locMap[ev.location];
      if (loc && loc.lat && loc.lng && !seen.has(loc.id)) {
        seen.add(loc.id);
        eventLocations.push({ ...loc, event: ev });
      }
    });
    return { polLoc, podLoc, vessels, ais, eventLocations };
  }, [trackingData]);

  // Auto-fit map when tracking data changes
  const fitPositions = useMemo(() => {
    const pts = [];
    if (trackingGeo?.polLoc?.lat) pts.push([trackingGeo.polLoc.lat, trackingGeo.polLoc.lng]);
    if (trackingGeo?.podLoc?.lat) pts.push([trackingGeo.podLoc.lat, trackingGeo.podLoc.lng]);
    if (trackingGeo?.ais?.lat) pts.push([trackingGeo.ais.lat, trackingGeo.ais.lng]);
    return pts;
  }, [trackingGeo]);

  // Route arc for tracked container
  const trackingArc = useMemo(() => {
    if (!trackingGeo?.polLoc?.lat || !trackingGeo?.podLoc?.lat) return null;
    return greatCirclePoints(
      trackingGeo.polLoc.lat, trackingGeo.polLoc.lng,
      trackingGeo.podLoc.lat, trackingGeo.podLoc.lng
    );
  }, [trackingGeo]);

  // Schedule route arcs
  const scheduleArcs = useMemo(() => {
    if (!schedulesData) return [];
    const schedules = schedulesData.data?.schedules || schedulesData.schedules || [];
    return schedules.slice(0, 5).map(s => {
      const origin = s.origin || {};
      const dest = s.destination || {};
      const oPort = allPorts.find(p => (p.locode || p.code) === origin.port_locode);
      const dPort = allPorts.find(p => (p.locode || p.code) === dest.port_locode);
      if (!oPort || !dPort) return null;
      return {
        carrier: s.carrier_name || s.carrier_scac,
        transitTime: s.transit_time,
        originName: origin.port_name || oPort.name,
        destName: dest.port_name || dPort.name,
        arc: greatCirclePoints(oPort.lat, oPort.lng, dPort.lat, dPort.lng),
        originCoords: [oPort.lat, oPort.lng],
        destCoords: [dPort.lat, dPort.lng],
      };
    }).filter(Boolean);
  }, [schedulesData, allPorts]);

  const arcColors = ['#1565c0', '#e65100', '#2e7d32', '#6a1b9a', '#00838f'];

  const tileLayers = {
    standard: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  };

  return (
    <div className="map-section" style={{ position: 'relative' }}>
      {/* Toolbar */}
      <div className="map-toolbar">
        <div className="map-legend">
          {trackingGeo && (
            <>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#16a34a' }} /> Origin</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#dc2626' }} /> Destination</span>
              <span className="legend-item"><span className="legend-line" style={{ background: '#0a2342' }} /> Route</span>
              {trackingGeo.ais && <span className="legend-item">🚢 Live Vessel</span>}
            </>
          )}
          {scheduleArcs.length > 0 && (
            <span className="legend-item"><span className="legend-line" style={{ background: '#1565c0', borderStyle: 'dashed' }} /> Schedules</span>
          )}
          <span className="legend-item"><span className="legend-dot" style={{ background: '#1565c0' }} /> Ports</span>
          {trackedContainers.length > 0 && (
            <span className="legend-item" style={{ color: '#e65100', fontWeight: 600 }}>
              📦 {trackedContainers.length} tracked — click a port
            </span>
          )}
        </div>
        <div className="map-layer-btns">
          {['standard', 'satellite'].map(l => (
            <button key={l} className={`map-layer-btn ${mapLayer === l ? 'active' : ''}`} onClick={() => setMapLayer(l)}>
              {l === 'standard' ? '🗺 Map' : '🛰 Satellite'}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="map-container-wrap" style={{ position: 'relative' }}>
        <MapContainer center={[30, 20]} zoom={3} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <MapRef mapRef={mapRef} />
          <TileLayer url={tileLayers[mapLayer].url} attribution={tileLayers[mapLayer].attribution} />
          <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" attribution="© OpenSeaMap" opacity={0.4} />

          {/* Auto-fit when tracking data changes */}
          {fitPositions.length > 1 && <FitBounds positions={fitPositions} />}

          {/* ── ALL PORTS (Netafim defaults + dynamic from tracked containers) ── */}
          {allPorts.map(port => {
            const locode = (port.locode || port.code || '').toUpperCase();
            const hasContainers = getContainersAtPort(locode).length > 0;
            const isSelected = (selectedPort?.port?.locode || selectedPort?.port?.code || '').toUpperCase() === locode;
            const icon = hasContainers || isSelected ? netafimPortHighlightIcon : netafimPortIcon;
            return (
              <Marker
                key={locode}
                position={[port.lat, port.lng]}
                icon={icon}
                eventHandlers={{ click: () => handlePortClick(port) }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{locode}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>{port.name}, {port.country}</div>
                  {hasContainers && (
                    <div style={{ fontSize: 11, color: '#e65100', fontWeight: 600, marginTop: 2 }}>
                      📦 {getContainersAtPort(locode).length} container{getContainersAtPort(locode).length > 1 ? 's' : ''} — click to view
                    </div>
                  )}
                </Tooltip>
              </Marker>
            );
          })}

          {/* ── SCHEDULE ARCS ── */}
          {scheduleArcs.map((arc, i) => (
            <React.Fragment key={i}>
              <Polyline positions={arc.arc} pathOptions={{ color: arcColors[i % arcColors.length], weight: 2, opacity: 0.6, dashArray: '6 4' }} />
              <CircleMarker center={arc.originCoords} radius={6}
                pathOptions={{ color: '#fff', fillColor: arcColors[i % arcColors.length], fillOpacity: 1, weight: 2 }}>
                <Popup><div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{arc.originName}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>Origin · {arc.carrier}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>Transit: {arc.transitTime} days</div>
                </div></Popup>
              </CircleMarker>
              <CircleMarker center={arc.destCoords} radius={6}
                pathOptions={{ color: '#fff', fillColor: arcColors[i % arcColors.length], fillOpacity: 1, weight: 2 }}>
                <Popup><div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{arc.destName}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>Destination · {arc.carrier}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>Transit: {arc.transitTime} days</div>
                </div></Popup>
              </CircleMarker>
            </React.Fragment>
          ))}

          {/* ── CONTAINER TRACKING ROUTE ARC ── */}
          {trackingArc && (
            <Polyline positions={trackingArc} pathOptions={{ color: '#0a2342', weight: 3.5, opacity: 0.9 }} />
          )}

          {/* Origin marker */}
          {trackingGeo?.polLoc?.lat && (
            <Marker position={[trackingGeo.polLoc.lat, trackingGeo.polLoc.lng]} icon={originIcon}>
              <Popup><div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>🟢 Origin (POL)</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{trackingGeo.polLoc.name}, {trackingGeo.polLoc.country}</div>
                <div style={{ fontSize: 11, color: '#888' }}>LOCODE: {trackingGeo.polLoc.locode}</div>
              </div></Popup>
            </Marker>
          )}

          {/* Destination marker */}
          {trackingGeo?.podLoc?.lat && (
            <Marker position={[trackingGeo.podLoc.lat, trackingGeo.podLoc.lng]} icon={destIcon}>
              <Popup><div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>🔴 Destination (POD)</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{trackingGeo.podLoc.name}, {trackingGeo.podLoc.country}</div>
                <div style={{ fontSize: 11, color: '#888' }}>LOCODE: {trackingGeo.podLoc.locode}</div>
              </div></Popup>
            </Marker>
          )}

          {/* Waypoint event markers */}
          {trackingGeo?.eventLocations?.map((loc, i) => (
            <Marker key={i} position={[loc.lat, loc.lng]} icon={waypointIcon}>
              <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{loc.event?.description || 'Event'}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{loc.name}, {loc.country}</div>
              </Tooltip>
            </Marker>
          ))}

          {/* Live vessel position */}
          {trackingGeo?.ais?.lat && (
            <Marker position={[trackingGeo.ais.lat, trackingGeo.ais.lng]} icon={vesselIcon}>
              <Popup><div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#0a2342' }}>🚢 Live Vessel Position</div>
                {trackingGeo.vessels[0] && (
                  <>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{trackingGeo.vessels[0].name}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>IMO: {trackingGeo.vessels[0].imo}</div>
                  </>
                )}
                {trackingGeo.ais.speed !== undefined && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Speed: {trackingGeo.ais.speed} kn</div>
                )}
              </div></Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Port click panel overlay */}
        <PortPanel selectedPort={selectedPort} onClose={() => setSelectedPort(null)} />
      </div>

      {/* Info bar */}
      <div className="map-info-bar">
        {selectedPort ? (
          <span>🏭 <strong>{selectedPort.port.name}</strong> — {selectedPort.containers.length} container{selectedPort.containers.length !== 1 ? 's' : ''} tracked at this port</span>
        ) : trackingGeo ? (
          <span>
            📦 Route: <strong>{trackingGeo.polLoc?.name || '—'}</strong> → <strong>{trackingGeo.podLoc?.name || '—'}</strong>
            {trackingGeo.ais ? ' · 🚢 Live vessel active' : ''}
            {trackedContainers.length > 0 ? ` · ${trackedContainers.length} container${trackedContainers.length > 1 ? 's' : ''} tracked — click highlighted ports` : ''}
          </span>
        ) : scheduleArcs.length > 0 ? (
          <span>📅 Showing {scheduleArcs.length} schedule route{scheduleArcs.length > 1 ? 's' : ''} · Click markers for details</span>
        ) : (
          <span>🌍 Netafim port network · Track a container to see its route · Click any port for container details</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11 }}>Scroll to zoom · Click ports for details</span>
      </div>
    </div>
  );
}
