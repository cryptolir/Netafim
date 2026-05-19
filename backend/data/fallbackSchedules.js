/**
 * Fallback vessel schedules for Netafim's primary trade lanes.
 * Used when the Searates schedules API is unavailable.
 * Routes are seeded from actual shipment data (MINDTESTforNir + MINDairshipments files).
 * Dates are relative to today so results always appear current.
 */

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function buildSchedules(origin, destination) {
  const today = new Date().toISOString().split('T')[0];

  // Route-specific vessel/service data based on Netafim's actual carriers (MSCU, HDMU, MAEU, ZIMU, CMDU, COSU)
  const ROUTE_DATA = {
    // China Dalian → Liberia Monrovia  (MSCU, actual shipment 3007308 / MSNU8656572)
    'CNDLC-LRMLW': [
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC NICOLA MASTRO', service: 'WAFMAX', transit: 77, dep_offset: 0, via: ['SGSIN', 'ZACPT'] },
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC CALAIS', service: 'WAFMAX', transit: 80, dep_offset: 7, via: ['SGSIN', 'ZACPT'] },
      { carrier: 'HDMU', carrier_name: 'Hyundai Merchant Marine', vessel: 'HYUNDAI DREAM', service: 'WAF1', transit: 82, dep_offset: 5, via: ['SGSIN'] },
    ],
    // Israel Ashdod → Germany Hamburg  (MSCU, MAEU — Netafim's main European route)
    'ILASH-DEHAM': [
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC ANNA', service: 'MISTRAL', transit: 14, dep_offset: 0, via: [] },
      { carrier: 'MAEU', carrier_name: 'Maersk Line', vessel: 'MAERSK EDINBURGH', service: 'ME2', transit: 16, dep_offset: 3, via: ['ITGOA'] },
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC BARCELONA', service: 'MISTRAL', transit: 14, dep_offset: 7, via: [] },
      { carrier: 'MAEU', carrier_name: 'Maersk Line', vessel: 'MAERSK STOCKHOLM', service: 'ME2', transit: 15, dep_offset: 10, via: ['ITGOA'] },
    ],
    // Israel Ashdod → Netherlands Rotterdam
    'ILASH-NLRTM': [
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC ANNA', service: 'MISTRAL', transit: 16, dep_offset: 0, via: ['DEHAM'] },
      { carrier: 'MAEU', carrier_name: 'Maersk Line', vessel: 'MAERSK EDINBURGH', service: 'ME2', transit: 18, dep_offset: 3, via: ['DEHAM'] },
    ],
    // China Shanghai → Israel Ashdod  (MSCU, MAEU)
    'CNSHA-ILASH': [
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC INDEPENDENT III', service: 'SHOGUN', transit: 28, dep_offset: 0, via: ['SGSIN'] },
      { carrier: 'MAEU', carrier_name: 'Maersk Line', vessel: 'MAERSK KENSINGTON', service: 'AEX', transit: 30, dep_offset: 4, via: ['SGSIN'] },
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC NICOLA MASTRO', service: 'SHOGUN', transit: 28, dep_offset: 7, via: ['SGSIN'] },
    ],
    // China Shekou → Israel Ashdod  (MSCU)
    'CNSKU-ILASH': [
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC INDEPENDENT III', service: 'SHOGUN', transit: 26, dep_offset: 0, via: ['SGSIN'] },
      { carrier: 'CMDU', carrier_name: 'CMA CGM', vessel: 'CMA CGM MARCO POLO', service: 'FAL1', transit: 27, dep_offset: 5, via: ['SGSIN', 'PKKHI'] },
    ],
    // China Qingdao → Israel Ashdod  (ZIMU)
    'CNTAO-ILASH': [
      { carrier: 'ZIMU', carrier_name: 'Zim Integrated Shipping', vessel: 'ZIM MOUNT BLANC', service: 'ZX', transit: 29, dep_offset: 0, via: ['SGSIN'] },
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC ANNA', service: 'SHOGUN', transit: 30, dep_offset: 3, via: ['SGSIN'] },
    ],
    // Vietnam Quinhon → Israel Ashdod  (MSCU — shipment 4011676)
    'VNUIH-ILASH': [
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC INDEPENDENT III', service: 'SHOGUN', transit: 22, dep_offset: 0, via: ['SGSIN'] },
      { carrier: 'CMDU', carrier_name: 'CMA CGM', vessel: 'CMA CGM TROCADERO', service: 'FAL1', transit: 24, dep_offset: 6, via: ['SGSIN'] },
    ],
    // South Korea Busan → Israel Ashdod  (MSCU)
    'KRPUS-ILASH': [
      { carrier: 'MSCU', carrier_name: 'Mediterranean Shipping Company', vessel: 'MSC NICOLA MASTRO', service: 'SHOGUN', transit: 24, dep_offset: 0, via: ['SGSIN'] },
      { carrier: 'HDMU', carrier_name: 'Hyundai Merchant Marine', vessel: 'HYUNDAI DREAM', service: 'AEX2', transit: 25, dep_offset: 4, via: ['SGSIN'] },
    ],
  };

  const key = `${origin.toUpperCase()}-${destination.toUpperCase()}`;
  const vessels = ROUTE_DATA[key] || [];

  if (vessels.length === 0) {
    // Generic fallback for unknown routes
    return {
      schedules: [
        {
          carrier_scac: 'MSCU',
          carrier_name: 'Mediterranean Shipping Company',
          transit_time: 21,
          direct: true,
          origin: { port_code: origin.toUpperCase(), port_name: origin.toUpperCase(), estimated_date: addDays(today, 3) },
          destination: { port_code: destination.toUpperCase(), port_name: destination.toUpperCase(), estimated_date: addDays(today, 24) },
          legs: [{
            service_name: 'STANDARD',
            vessel_name: 'MSC VESSEL',
            departure: { estimated_date: addDays(today, 3) },
            arrival: { estimated_date: addDays(today, 24) }
          }]
        }
      ],
      _fallback: true
    };
  }

  const schedules = vessels.map(v => {
    const depDate = addDays(today, v.dep_offset + 2);
    const arrDate = addDays(today, v.dep_offset + 2 + v.transit);
    const legs = [];

    if (v.via.length === 0) {
      legs.push({
        service_name: v.service,
        vessel_name: v.vessel,
        departure: { estimated_date: depDate },
        arrival: { estimated_date: arrDate }
      });
    } else {
      // Build multi-leg route
      let legDep = depDate;
      const allPorts = [origin.toUpperCase(), ...v.via, destination.toUpperCase()];
      const legDays = Math.floor(v.transit / (allPorts.length - 1));
      for (let i = 0; i < allPorts.length - 1; i++) {
        const legArr = addDays(legDep, legDays);
        legs.push({
          service_name: v.service,
          vessel_name: v.vessel,
          from_port: allPorts[i],
          to_port: allPorts[i + 1],
          departure: { estimated_date: legDep },
          arrival: { estimated_date: legArr }
        });
        legDep = addDays(legArr, 1); // 1 day port stay
      }
    }

    return {
      carrier_scac: v.carrier,
      carrier_name: v.carrier_name,
      transit_time: v.transit,
      direct: v.via.length === 0,
      origin: {
        port_code: origin.toUpperCase(),
        port_name: origin.toUpperCase(),
        estimated_date: depDate
      },
      destination: {
        port_code: destination.toUpperCase(),
        port_name: destination.toUpperCase(),
        estimated_date: arrDate
      },
      legs
    };
  });

  return { schedules, _fallback: true };
}

module.exports = { buildSchedules };
