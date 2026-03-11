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

const makeDiamondIcon = (bg, size = 14, border = '#fff') =>
  L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${bg};border:2px solid ${border};transform:rotate(45deg);box-shadow:0 1px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const netafimPortIcon = makeCircleIcon('#1565c0', 12);
const netafimPortHighlightIcon = makeCircleIcon('#e65100', 16, '#fff', 3);
const originIcon = makeCircleIcon('#16a34a', 16);
const destIcon = makeCircleIcon('#dc2626', 16);
const waypointIcon = makeCircleIcon('#64748b', 10, '#fff', 2);
const airportIcon = makeDiamondIcon('#0369a1', 12);
const airportHighlightIcon = makeDiamondIcon('#7c3aed', 16, '#fff');
const airOriginIcon = makeDiamondIcon('#16a34a', 16);
const airDestIcon = makeDiamondIcon('#dc2626', 16);

const vesselIcon = L.divIcon({
  className: '',
  html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));">🚢</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const planeIcon = L.divIcon({
  className: '',
  html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));">✈️</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

// ── Helpers ────────────────────────────────────────────────────────────────
function greatCirclePoints(lat1, lng1, lat2, lng2, n = 80) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lng1);
  const φ2 = toRad(lat2), λ2 = toRad(lng2);
  const x1 = Math.cos(φ1) * Math.cos(λ1), y1 = Math.cos(φ1) * Math.sin(λ1), z1 = Math.sin(φ1);
  const x2 = Math.cos(φ2) * Math.cos(λ2), y2 = Math.cos(φ2) * Math.sin(λ2), z2 = Math.sin(φ2);
  const dot = Math.min(1, Math.max(-1, x1*x2 + y1*y2 + z1*z2));
  const Ω = Math.acos(dot);
  if (Ω < 1e-10) return [[lat1, lng1], [lat2, lng2]];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const sinΩ = Math.sin(Ω);
    const A = Math.sin((1 - f) * Ω) / sinΩ;
    const B = Math.sin(f * Ω) / sinΩ;
    const x = A * x1 + B * x2;
    const y = A * y1 + B * y2;
    const z = A * z1 + B * z2;
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x*x + y*y))), toDeg(Math.atan2(y, x))]);
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
  const isAirport = port.isAirport;
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12,
      width: 300, maxHeight: 'calc(100% - 24px)',
      background: '#fff', borderRadius: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', border: '1px solid #e2e8f0',
    }}>
      <div style={{
        background: isAirport
          ? 'linear-gradient(135deg, #1e3a5f 0%, #0369a1 100%)'
          : 'linear-gradient(135deg, #0a2342 0%, #1565c0 100%)',
        padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
            {isAirport ? '✈️' : '🏭'} {port.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 }}>
            {port.country} · {isAirport ? 'IATA' : 'LOCODE'}: {port.locode || port.code}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
          borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8,
        }}>✕</button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '10px 12px' }}>
        {containers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: '#94a3b8' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{isAirport ? '✈️' : '📭'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
              No {isAirport ? 'air shipments' : 'containers'} tracked at this {isAirport ? 'airport' : 'port'}
            </div>
            <div style={{ fontSize: 11, marginTop: 6, color: '#94a3b8', lineHeight: 1.5 }}>
              Track a shipment with <strong>{port.locode || port.code}</strong> as origin or destination to see it here.
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
              {containers.length} shipment{containers.length > 1 ? 's' : ''} via this {isAirport ? 'airport' : 'port'}
            </div>
            {containers.map((c, i) => (
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
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  {c.polName || c.polCode || '—'} → {c.podName || c.podCode || '—'}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 11, color: '#94a3b8' }}>
                  <span>{isAirport ? '✈️' : '🚢'} {c.carrier}</span>
                  {c.eta && c.eta !== '—' && <span>📅 ETA: {formatDate(c.eta)}</span>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ShippingMap({
  trackingData,
  schedulesData,
  trackedContainers = [],
  airTrackingData,
  airSchedulesData,
}) {
  const { token } = useContext(AuthContext);
  const [netafimPorts, setNetafimPorts] = useState([]);
  const [netafimAirports, setNetafimAirports] = useState([]);
  const [mapLayer, setMapLayer] = useState('standard');
  const [selectedPort, setSelectedPort] = useState(null);
  const [showAirLayer, setShowAirLayer] = useState(true);
  const [showSeaLayer, setShowSeaLayer] = useState(true);
  const mapRef = useRef(null);

  // Load Netafim default ports
  useEffect(() => {
    axios.get('/api/containers/ports', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setNetafimPorts(res.data.ports || []))
      .catch(() => {});
  }, [token]);

  // Load Netafim default airports
  useEffect(() => {
    axios.get('/api/containers/airports', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setNetafimAirports(res.data.airports || []))
      .catch(() => {});
  }, [token]);

  // Build merged port list
  const allPorts = useMemo(() => {
    const portMap = {};
    netafimPorts.forEach(p => {
      portMap[p.code.toUpperCase()] = { ...p, locode: p.code, isNetafim: true, isAirport: false };
    });
    trackedContainers.forEach(c => {
      (c.ports || []).forEach(p => {
        const key = (p.locode || '').toUpperCase();
        if (key && !portMap[key]) {
          portMap[key] = {
            code: p.locode, locode: p.locode, name: p.name,
            country: p.country, lat: p.lat, lng: p.lng, isNetafim: false, isAirport: false,
          };
        }
      });
    });
    return Object.values(portMap).filter(p => p.lat && p.lng);
  }, [netafimPorts, trackedContainers]);

  // Build merged airport list (from defaults + air tracking data)
  const allAirports = useMemo(() => {
    const airportMap = {};
    netafimAirports.forEach(a => {
      airportMap[a.code.toUpperCase()] = { ...a, locode: a.code, isNetafim: true, isAirport: true };
    });
    // Add airports from air tracking data
    if (airTrackingData) {
      const info = airTrackingData.data || airTrackingData;
      [info.from, info.to].forEach(ap => {
        if (ap?.iata_code && ap.lat && ap.lng) {
          const key = ap.iata_code.toUpperCase();
          if (!airportMap[key]) {
            airportMap[key] = {
              code: ap.iata_code, locode: ap.iata_code,
              name: ap.name || ap.nearest_city || ap.iata_code,
              country: ap.country || '',
              lat: ap.lat, lng: ap.lng, isNetafim: false, isAirport: true,
            };
          }
        }
      });
      (info.routes || []).forEach(leg => {
        [leg.from, leg.to].forEach(ap => {
          if (ap?.iata_code && ap.lat && ap.lng) {
            const key = ap.iata_code.toUpperCase();
            if (!airportMap[key]) {
              airportMap[key] = {
                code: ap.iata_code, locode: ap.iata_code,
                name: ap.name || ap.nearest_city || ap.iata_code,
                country: ap.country || '',
                lat: ap.lat, lng: ap.lng, isNetafim: false, isAirport: true,
              };
            }
          }
        });
      });
    }
    return Object.values(airportMap).filter(a => a.lat && a.lng);
  }, [netafimAirports, airTrackingData]);

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

  const handleAirportClick = useCallback((airport) => {
    // Show air tracking info for this airport
    setSelectedPort({ port: { ...airport, isAirport: true }, containers: [] });
  }, []);

  // Extract sea tracking geo data
  const trackingGeo = useMemo(() => {
    if (!trackingData) return null;
    const d = (trackingData.locations || trackingData.route) ? trackingData
      : (trackingData.data?.locations || trackingData.data?.route) ? trackingData.data
      : trackingData;
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

  // Extract air tracking geo data
  const airTrackingGeo = useMemo(() => {
    if (!airTrackingData) return null;
    const info = airTrackingData.data || airTrackingData;
    const from = info.from;
    const to = info.to;
    const routes = info.routes || [];
    const airline = airTrackingData.metadata?.airline || {};
    return { from, to, routes, airline, status: info.status };
  }, [airTrackingData]);

  // Auto-fit map
  const fitPositions = useMemo(() => {
    const pts = [];
    if (trackingGeo?.polLoc?.lat) pts.push([trackingGeo.polLoc.lat, trackingGeo.polLoc.lng]);
    if (trackingGeo?.podLoc?.lat) pts.push([trackingGeo.podLoc.lat, trackingGeo.podLoc.lng]);
    if (trackingGeo?.ais?.lat) pts.push([trackingGeo.ais.lat, trackingGeo.ais.lng]);
    if (airTrackingGeo?.from?.lat) pts.push([airTrackingGeo.from.lat, airTrackingGeo.from.lng]);
    if (airTrackingGeo?.to?.lat) pts.push([airTrackingGeo.to.lat, airTrackingGeo.to.lng]);
    return pts;
  }, [trackingGeo, airTrackingGeo]);

  // Sea route arc
  const trackingArc = useMemo(() => {
    if (!trackingGeo?.polLoc?.lat || !trackingGeo?.podLoc?.lat) return null;
    return greatCirclePoints(
      trackingGeo.polLoc.lat, trackingGeo.polLoc.lng,
      trackingGeo.podLoc.lat, trackingGeo.podLoc.lng
    );
  }, [trackingGeo]);

  // Air route arcs (from AWB tracking)
  const airTrackingArcs = useMemo(() => {
    if (!airTrackingGeo) return [];
    const arcs = [];
    // Full route arc (origin → destination)
    if (airTrackingGeo.from?.lat && airTrackingGeo.to?.lat) {
      arcs.push({
        type: 'main',
        arc: greatCirclePoints(
          airTrackingGeo.from.lat, airTrackingGeo.from.lng,
          airTrackingGeo.to.lat, airTrackingGeo.to.lng
        ),
        from: airTrackingGeo.from,
        to: airTrackingGeo.to,
        airline: airTrackingGeo.airline?.name || '',
      });
    }
    // Individual leg arcs
    airTrackingGeo.routes.forEach((leg, i) => {
      if (leg.from?.lat && leg.to?.lat && leg.transport_type === 'PLANE') {
        arcs.push({
          type: 'leg',
          arc: greatCirclePoints(leg.from.lat, leg.from.lng, leg.to.lat, leg.to.lng),
          from: leg.from,
          to: leg.to,
          flight: leg.flight_number,
          status: leg.status,
        });
      }
    });
    return arcs;
  }, [airTrackingGeo]);

  // Schedule route arcs (sea)
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
  const airArcColors = ['#0369a1', '#7c3aed', '#0891b2', '#6d28d9'];

  const tileLayers = {
    standard: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  };

  return (
    <div className="map-section" style={{ position: 'relative' }}>
      {/* Toolbar */}
      <div className="map-toolbar">
        <div className="map-legend">
          {trackingGeo && showSeaLayer && (
            <>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#16a34a' }} /> Origin</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#dc2626' }} /> Destination</span>
              <span className="legend-item"><span className="legend-line" style={{ background: '#0a2342' }} /> Sea Route</span>
              {trackingGeo.ais && <span className="legend-item">🚢 Live Vessel</span>}
            </>
          )}
          {airTrackingGeo && showAirLayer && (
            <>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#0369a1', borderRadius: 2, transform: 'rotate(45deg)', display: 'inline-block' }} /> Airport</span>
              <span className="legend-item"><span className="legend-line" style={{ background: '#0369a1', borderStyle: 'dashed' }} /> Air Route</span>
              <span className="legend-item">✈️ Air Shipment</span>
            </>
          )}
          {scheduleArcs.length > 0 && showSeaLayer && (
            <span className="legend-item"><span className="legend-line" style={{ background: '#1565c0', borderStyle: 'dashed' }} /> Schedules</span>
          )}
          <span className="legend-item"><span className="legend-dot" style={{ background: '#1565c0' }} /> Ports</span>
          {trackedContainers.length > 0 && (
            <span className="legend-item" style={{ color: '#e65100', fontWeight: 600 }}>
              📦 {trackedContainers.length} tracked
            </span>
          )}
        </div>
        <div className="map-layer-btns">
          <button
            className={`map-layer-btn ${showSeaLayer ? 'active' : ''}`}
            onClick={() => setShowSeaLayer(v => !v)}
            title="Toggle sea layer"
          >🚢 Sea</button>
          <button
            className={`map-layer-btn ${showAirLayer ? 'active' : ''}`}
            onClick={() => setShowAirLayer(v => !v)}
            title="Toggle air layer"
          >✈️ Air</button>
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
          {showSeaLayer && (
            <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" attribution="© OpenSeaMap" opacity={0.4} />
          )}

          {fitPositions.length > 1 && <FitBounds positions={fitPositions} />}

          {/* ── SEA LAYER ── */}
          {showSeaLayer && (
            <>
              {/* All sea ports */}
              {allPorts.map(port => {
                const locode = (port.locode || port.code || '').toUpperCase();
                const hasContainers = getContainersAtPort(locode).length > 0;
                const isSelected = (selectedPort?.port?.locode || selectedPort?.port?.code || '').toUpperCase() === locode;
                const icon = hasContainers || isSelected ? netafimPortHighlightIcon : netafimPortIcon;
                return (
                  <Marker
                    key={`port-${locode}`}
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

              {/* Schedule arcs */}
              {scheduleArcs.map((arc, i) => (
                <React.Fragment key={`sched-${i}`}>
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

              {/* Container tracking route arc */}
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
                <Marker key={`wp-${i}`} position={[loc.lat, loc.lng]} icon={waypointIcon}>
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
            </>
          )}

          {/* ── AIR LAYER ── */}
          {showAirLayer && (
            <>
              {/* All airports */}
              {allAirports.map(airport => {
                const code = (airport.code || '').toUpperCase();
                const isSelected = (selectedPort?.port?.code || '').toUpperCase() === code && selectedPort?.port?.isAirport;
                const icon = isSelected ? airportHighlightIcon : airportIcon;
                return (
                  <Marker
                    key={`airport-${code}`}
                    position={[airport.lat, airport.lng]}
                    icon={icon}
                    eventHandlers={{ click: () => handleAirportClick(airport) }}
                  >
                    <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>✈️ {code}</div>
                      <div style={{ fontSize: 11, color: '#555' }}>{airport.name}, {airport.country}</div>
                    </Tooltip>
                  </Marker>
                );
              })}

              {/* Air tracking arcs */}
              {airTrackingArcs.map((arc, i) => (
                <React.Fragment key={`air-arc-${i}`}>
                  <Polyline
                    positions={arc.arc}
                    pathOptions={{
                      color: arc.type === 'main' ? '#0369a1' : airArcColors[i % airArcColors.length],
                      weight: arc.type === 'main' ? 3 : 2,
                      opacity: arc.type === 'main' ? 0.85 : 0.6,
                      dashArray: arc.type === 'main' ? '8 4' : '4 4',
                    }}
                  />
                  {arc.type === 'main' && arc.from?.lat && (
                    <Marker position={[arc.from.lat, arc.from.lng]} icon={airOriginIcon}>
                      <Popup><div style={{ minWidth: 180 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>🟢 Origin Airport</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{arc.from.name || arc.from.nearest_city}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>IATA: {arc.from.iata_code}</div>
                        {arc.airline && <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>✈️ {arc.airline}</div>}
                      </div></Popup>
                    </Marker>
                  )}
                  {arc.type === 'main' && arc.to?.lat && (
                    <Marker position={[arc.to.lat, arc.to.lng]} icon={airDestIcon}>
                      <Popup><div style={{ minWidth: 180 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>🔴 Destination Airport</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{arc.to.name || arc.to.nearest_city}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>IATA: {arc.to.iata_code}</div>
                      </div></Popup>
                    </Marker>
                  )}
                </React.Fragment>
              ))}

              {/* Plane position icon at midpoint of active leg */}
              {airTrackingGeo?.from?.lat && airTrackingGeo?.to?.lat && (
                (() => {
                  const arc = greatCirclePoints(
                    airTrackingGeo.from.lat, airTrackingGeo.from.lng,
                    airTrackingGeo.to.lat, airTrackingGeo.to.lng
                  );
                  const mid = arc[Math.floor(arc.length / 2)];
                  return mid ? (
                    <Marker position={mid} icon={planeIcon}>
                      <Popup><div style={{ minWidth: 180 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>✈️ Air Shipment</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          {airTrackingGeo.from.iata_code} → {airTrackingGeo.to.iata_code}
                        </div>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                          Status: {(airTrackingGeo.status || '').replace(/_/g, ' ')}
                        </div>
                        {airTrackingGeo.airline?.name && (
                          <div style={{ fontSize: 11, color: '#888' }}>{airTrackingGeo.airline.name}</div>
                        )}
                      </div></Popup>
                    </Marker>
                  ) : null;
                })()
              )}
            </>
          )}
        </MapContainer>

        {/* Port/Airport click panel overlay */}
        <PortPanel selectedPort={selectedPort} onClose={() => setSelectedPort(null)} />
      </div>

      {/* Info bar */}
      <div className="map-info-bar">
        {selectedPort ? (
          <span>
            {selectedPort.port.isAirport ? '✈️' : '🏭'} <strong>{selectedPort.port.name}</strong>
            {selectedPort.port.isAirport ? ' Airport' : ` — ${selectedPort.containers.length} container${selectedPort.containers.length !== 1 ? 's' : ''} tracked`}
          </span>
        ) : airTrackingGeo ? (
          <span>
            ✈️ Air Route: <strong>{airTrackingGeo.from?.iata_code || '—'}</strong> → <strong>{airTrackingGeo.to?.iata_code || '—'}</strong>
            {` · Status: ${(airTrackingGeo.status || '').replace(/_/g, ' ')}`}
            {trackingGeo ? ` · 🚢 Sea: ${trackingGeo.polLoc?.name || '—'} → ${trackingGeo.podLoc?.name || '—'}` : ''}
          </span>
        ) : trackingGeo ? (
          <span>
            📦 Route: <strong>{trackingGeo.polLoc?.name || '—'}</strong> → <strong>{trackingGeo.podLoc?.name || '—'}</strong>
            {trackingGeo.ais ? ' · 🚢 Live vessel active' : ''}
            {trackedContainers.length > 0 ? ` · ${trackedContainers.length} container${trackedContainers.length > 1 ? 's' : ''} tracked` : ''}
          </span>
        ) : scheduleArcs.length > 0 ? (
          <span>📅 Showing {scheduleArcs.length} schedule route{scheduleArcs.length > 1 ? 's' : ''} · Click markers for details</span>
        ) : (
          <span>🌍 Netafim port &amp; airport network · Track a shipment to see its route · Toggle Sea/Air layers above</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11 }}>Scroll to zoom · Click markers for details</span>
      </div>
    </div>
  );
}
