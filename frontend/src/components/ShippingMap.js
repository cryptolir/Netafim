import React, { useEffect, useState, useContext, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
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

// Custom icons
const portIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:14px;height:14px;
    background:#1565c0;
    border:2.5px solid #fff;
    border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const vesselIcon = L.divIcon({
  className: '',
  html: `<div style="
    font-size:22px;
    line-height:1;
    filter:drop-shadow(0 1px 3px rgba(0,0,0,0.4));
    transform:rotate(0deg);
  ">🚢</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const originIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;
    background:#16a34a;
    border:2.5px solid #fff;
    border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;
    background:#dc2626;
    border:2.5px solid #fff;
    border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Helper to fit map bounds to given positions
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 1) {
      try {
        const bounds = L.latLngBounds(positions);
        map.fitBounds(bounds, { padding: [40, 40] });
      } catch {}
    }
  }, [positions, map]);
  return null;
}

// Draw a great-circle arc between two points (approximation with intermediate points)
function greatCirclePoints(lat1, lng1, lat2, lng2, n = 50) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const points = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * toRad(lat1)) * Math.cos(toRad(lng1));
    const B = Math.sin((1 - f) * toRad(lat2)) * Math.cos(toRad(lng2));
    const C = Math.cos((1 - f) * toRad(lat1)) * Math.cos(toRad(lng1));
    const D = Math.cos((1 - f) * toRad(lat2)) * Math.cos(toRad(lng2));
    const E = Math.sin((1 - f) * toRad(lat1)) * Math.sin(toRad(lng1));
    const F = Math.sin((1 - f) * toRad(lat2)) * Math.sin(toRad(lng2));
    const x = A + B;
    const y = C + D;
    const z = E + F;
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lng = toDeg(Math.atan2(y, x));
    points.push([lat, lng]);
  }
  return points;
}

export default function ShippingMap({ trackingData, schedulesData, activeTab }) {
  const { token } = useContext(AuthContext);
  const [ports, setPorts] = useState([]);
  const [mapLayer, setMapLayer] = useState('standard'); // standard | satellite | nautical

  // Load Netafim ports on mount
  useEffect(() => {
    axios.get('/api/containers/ports', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setPorts(res.data.ports || []))
      .catch(() => {});
  }, [token]);

  // Extract tracking geo data
  const trackingGeo = React.useMemo(() => {
    if (!trackingData?.data) return null;
    const d = trackingData.data;
    const locations = d.locations || [];
    const vessels = d.vessels || [];
    const containers = d.containers || [];
    const route = d.route || {};
    const ais = d.ais || null;

    // Find POL and POD locations
    const polLoc = locations.find(l => l.id === route.pol?.location);
    const podLoc = locations.find(l => l.id === route.pod?.location);

    // Build event waypoints (locations with lat/lng)
    const eventLocations = [];
    const seen = new Set();
    (containers[0]?.events || []).forEach(ev => {
      const loc = locations.find(l => l.id === ev.location);
      if (loc && loc.lat && loc.lng && !seen.has(loc.id)) {
        seen.add(loc.id);
        eventLocations.push({ ...loc, event: ev });
      }
    });

    return { polLoc, podLoc, vessels, ais, eventLocations, locations };
  }, [trackingData]);

  // Extract schedules geo data — port pairs for each schedule
  const scheduleRoutes = React.useMemo(() => {
    if (!schedulesData) return [];
    const schedules = schedulesData.data?.schedules || schedulesData.schedules || [];
    return schedules.slice(0, 5).map(s => {
      const origin = s.origin || {};
      const dest = s.destination || {};
      return {
        carrier: s.carrier_name || s.carrier_scac,
        transitTime: s.transit_time,
        direct: s.direct,
        originCode: origin.port_locode,
        destCode: dest.port_locode,
        originName: origin.port_name,
        destName: dest.port_name,
      };
    });
  }, [schedulesData]);

  // Build route arc points for tracking
  const trackingArc = React.useMemo(() => {
    if (!trackingGeo?.polLoc || !trackingGeo?.podLoc) return null;
    const { polLoc, podLoc } = trackingGeo;
    if (!polLoc.lat || !podLoc.lat) return null;
    return greatCirclePoints(polLoc.lat, polLoc.lng, podLoc.lat, podLoc.lng);
  }, [trackingGeo]);

  // Build route arcs for schedules using port coordinates
  const scheduleArcs = React.useMemo(() => {
    return scheduleRoutes.map(r => {
      const oPort = ports.find(p => p.code === r.originCode);
      const dPort = ports.find(p => p.code === r.destCode);
      if (!oPort || !dPort) return null;
      return {
        ...r,
        arc: greatCirclePoints(oPort.lat, oPort.lng, dPort.lat, dPort.lng),
        originCoords: [oPort.lat, oPort.lng],
        destCoords: [dPort.lat, dPort.lng],
      };
    }).filter(Boolean);
  }, [scheduleRoutes, ports]);

  // Tile layer URLs
  const tileLayers = {
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri',
    },
    nautical: {
      url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
      attribution: '© OpenSeaMap contributors',
      overlay: true,
    },
  };

  // Determine all positions for bounds fitting
  const allPositions = React.useMemo(() => {
    const pts = [];
    if (trackingGeo?.polLoc?.lat) pts.push([trackingGeo.polLoc.lat, trackingGeo.polLoc.lng]);
    if (trackingGeo?.podLoc?.lat) pts.push([trackingGeo.podLoc.lat, trackingGeo.podLoc.lng]);
    if (trackingGeo?.ais?.lat) pts.push([trackingGeo.ais.lat, trackingGeo.ais.lng]);
    scheduleArcs.forEach(a => {
      if (a.originCoords) pts.push(a.originCoords);
      if (a.destCoords) pts.push(a.destCoords);
    });
    return pts;
  }, [trackingGeo, scheduleArcs]);

  const arcColors = ['#1565c0', '#e65100', '#2e7d32', '#6a1b9a', '#00838f'];

  return (
    <div className="map-section">
      <div className="map-toolbar">
        <div className="map-legend">
          {trackingGeo && (
            <>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#16a34a' }} /> Origin</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#dc2626' }} /> Destination</span>
              {trackingGeo.ais && <span className="legend-item">🚢 Live Vessel</span>}
            </>
          )}
          {scheduleArcs.length > 0 && (
            <span className="legend-item"><span className="legend-line" style={{ background: '#1565c0' }} /> Schedule Routes</span>
          )}
          <span className="legend-item"><span className="legend-dot" style={{ background: '#1565c0' }} /> Ports</span>
        </div>
        <div className="map-layer-btns">
          {['standard', 'satellite'].map(l => (
            <button
              key={l}
              className={`map-layer-btn ${mapLayer === l ? 'active' : ''}`}
              onClick={() => setMapLayer(l)}
            >
              {l === 'standard' ? '🗺 Map' : '🛰 Satellite'}
            </button>
          ))}
        </div>
      </div>

      <div className="map-container-wrap">
        <MapContainer
          center={[30, 20]}
          zoom={3}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          {/* Base tile layer */}
          <TileLayer
            url={tileLayers[mapLayer].url}
            attribution={tileLayers[mapLayer].attribution}
          />
          {/* Nautical overlay always on */}
          <TileLayer
            url={tileLayers.nautical.url}
            attribution={tileLayers.nautical.attribution}
            opacity={0.5}
          />

          {/* Fit bounds when data changes */}
          {allPositions.length > 1 && <FitBounds positions={allPositions} />}

          {/* ── NETAFIM PORT MARKERS ── */}
          {ports.map(port => (
            <Marker key={port.code} position={[port.lat, port.lng]} icon={portIcon}>
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{port.code}</div>
                <div style={{ fontSize: 11, color: '#555' }}>{port.name}, {port.country}</div>
              </Tooltip>
              <Popup>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0a2342' }}>{port.name}</div>
                  <div style={{ fontSize: 12, color: '#555' }}>{port.country}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>LOCODE: <strong>{port.code}</strong></div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {port.lat.toFixed(4)}°, {port.lng.toFixed(4)}°
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ── SCHEDULE ROUTE ARCS ── */}
          {scheduleArcs.map((arc, i) => (
            <React.Fragment key={i}>
              <Polyline
                positions={arc.arc}
                pathOptions={{
                  color: arcColors[i % arcColors.length],
                  weight: 2,
                  opacity: 0.65,
                  dashArray: '6 4',
                }}
              />
              <CircleMarker center={arc.originCoords} radius={6}
                pathOptions={{ color: '#fff', fillColor: arcColors[i % arcColors.length], fillOpacity: 1, weight: 2 }}>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{arc.originName || arc.originCode}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>Origin · {arc.carrier}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Transit: {arc.transitTime} days</div>
                  </div>
                </Popup>
              </CircleMarker>
              <CircleMarker center={arc.destCoords} radius={6}
                pathOptions={{ color: '#fff', fillColor: arcColors[i % arcColors.length], fillOpacity: 1, weight: 2 }}>
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{arc.destName || arc.destCode}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>Destination · {arc.carrier}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Transit: {arc.transitTime} days</div>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          ))}

          {/* ── CONTAINER TRACKING ROUTE ── */}
          {trackingArc && (
            <Polyline
              positions={trackingArc}
              pathOptions={{ color: '#0a2342', weight: 3, opacity: 0.85 }}
            />
          )}

          {/* Origin port marker */}
          {trackingGeo?.polLoc?.lat && (
            <Marker position={[trackingGeo.polLoc.lat, trackingGeo.polLoc.lng]} icon={originIcon}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>
                    🟢 Origin (POL)
                  </div>
                  <div style={{ fontSize: 12 }}>{trackingGeo.polLoc.name}, {trackingGeo.polLoc.country}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>LOCODE: {trackingGeo.polLoc.locode}</div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Destination port marker */}
          {trackingGeo?.podLoc?.lat && (
            <Marker position={[trackingGeo.podLoc.lat, trackingGeo.podLoc.lng]} icon={destIcon}>
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#dc2626' }}>
                    🔴 Destination (POD)
                  </div>
                  <div style={{ fontSize: 12 }}>{trackingGeo.podLoc.name}, {trackingGeo.podLoc.country}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>LOCODE: {trackingGeo.podLoc.locode}</div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Event waypoints */}
          {trackingGeo?.eventLocations?.map((loc, i) => (
            <CircleMarker
              key={i}
              center={[loc.lat, loc.lng]}
              radius={5}
              pathOptions={{ color: '#0a2342', fillColor: '#fff', fillOpacity: 1, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                <div style={{ fontSize: 11 }}>{loc.event?.description || loc.name}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{loc.name}</div>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Live AIS vessel position */}
          {trackingGeo?.ais?.lat && (
            <Marker
              position={[trackingGeo.ais.lat, trackingGeo.ais.lng]}
              icon={vesselIcon}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0a2342' }}>
                    🚢 Live Vessel Position
                  </div>
                  {trackingGeo.vessels[0] && (
                    <>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{trackingGeo.vessels[0].name}</div>
                      <div style={{ fontSize: 11, color: '#555' }}>IMO: {trackingGeo.vessels[0].imo}</div>
                      <div style={{ fontSize: 11, color: '#555' }}>Flag: {trackingGeo.vessels[0].flag}</div>
                    </>
                  )}
                  {trackingGeo.ais.speed !== undefined && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                      Speed: {trackingGeo.ais.speed} kn · Heading: {trackingGeo.ais.heading}°
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
                    {trackingGeo.ais.lat?.toFixed(4)}°, {trackingGeo.ais.lng?.toFixed(4)}°
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Map info bar */}
      <div className="map-info-bar">
        {trackingGeo ? (
          <span>
            📦 Showing route for tracked container
            {trackingGeo.ais ? ' · 🚢 Live vessel position active' : ''}
          </span>
        ) : scheduleArcs.length > 0 ? (
          <span>📅 Showing {scheduleArcs.length} schedule route{scheduleArcs.length > 1 ? 's' : ''} · Click markers for details</span>
        ) : (
          <span>🌍 Showing Netafim port network · Track a container or search schedules to see routes</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11 }}>
          Scroll to zoom · Click markers for details
        </span>
      </div>
    </div>
  );
}
