// Phone-side logic: build feed URLs, trim ADS-B responses to what the watch draws.
// Pure functions only (no fetch, no Zepp APIs) so they run under Node tests.

export const KM_PER_NM = 1.852
const KM_PER_DEG = 111.32

// Free, keyless, ADSBexchange-v2-compatible feeds, tried in order.
// The query point is rounded to ~1 km so the exact position never leaves the phone;
// positions sent back to the watch are still relative to the exact point.
export function feedUrls(lat, lon, radiusNm) {
  const la = lat.toFixed(2)
  const lo = lon.toFixed(2)
  const r = Math.max(1, Math.min(250, Math.ceil(radiusNm)))
  return [
    { name: 'adsb.lol', url: `https://api.adsb.lol/v2/lat/${la}/lon/${lo}/dist/${r}` },
    { name: 'airplanes.live', url: `https://api.airplanes.live/v2/point/${la}/${lo}/${r}` },
    { name: 'adsb.fi', url: `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${r}` },
  ]
}

export const IP_LOCATION_URL = 'https://get.geojs.io/v1/ip/geo.json'

// Query radius for a radar range: covers the circle plus the screen corners we draw into.
export function queryRadiusNm(rangeKm) {
  return (rangeKm * 1.35 + 2) / KM_PER_NM
}

export function bodyOf(res) {
  if (!res) return null
  const b = res.body
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch (e) {
      return null
    }
  }
  return b || null
}

export function parseIpLocation(body) {
  if (!body) return null
  const lat = parseFloat(body.latitude)
  const lon = parseFloat(body.longitude)
  if (!isFinite(lat) || !isFinite(lon)) return null
  return { lat, lon }
}

// East/north offset in km of (lat, lon) from origin (lat0, lon0). Equirectangular:
// error well under 1 % inside 150 km, which is far below one screen pixel.
export function offsetKm(lat0, lon0, lat, lon) {
  const dx = (lon - lon0) * KM_PER_DEG * Math.cos((lat0 * Math.PI) / 180)
  const dy = (lat - lat0) * KM_PER_DEG
  return { dx, dy }
}

function label(ac) {
  const flight = typeof ac.flight === 'string' ? ac.flight.trim() : ''
  if (flight) return flight
  if (typeof ac.r === 'string' && ac.r.trim()) return ac.r.trim()
  return typeof ac.hex === 'string' ? ac.hex.replace('~', '').toUpperCase() : '?'
}

// Altitude in hundreds of feet (flight level style), or null when unknown.
function altHundreds(ac) {
  const a = typeof ac.alt_baro === 'number' ? ac.alt_baro : ac.alt_geom
  return typeof a === 'number' ? Math.round(a / 100) : null
}

// Turn a feed response into the compact list sent over Bluetooth:
// [label, dx*10, dy*10, trackDeg, groundSpeedKt, altHundredsFt|-1]
// Ground traffic and stale positions are dropped; nearest first; at most `max`.
export function trimAircraft(body, origin, rangeKm, max = 30) {
  const list = (body && (body.ac || body.aircraft)) || []
  const limit = rangeKm * 1.35
  const out = []
  for (const ac of list) {
    if (!ac || typeof ac.lat !== 'number' || typeof ac.lon !== 'number') continue
    if (ac.alt_baro === 'ground') continue
    if (typeof ac.seen_pos === 'number' && ac.seen_pos > 60) continue
    const { dx, dy } = offsetKm(origin.lat, origin.lon, ac.lat, ac.lon)
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d > limit) continue
    const track = typeof ac.track === 'number' ? ac.track : typeof ac.true_heading === 'number' ? ac.true_heading : null
    const gs = typeof ac.gs === 'number' ? ac.gs : 0
    const alt = altHundreds(ac)
    out.push({ d, row: [label(ac).slice(0, 8), Math.round(dx * 10), Math.round(dy * 10), track === null ? -1 : Math.round(track), Math.round(gs), alt === null ? -1 : alt] })
  }
  out.sort((a, b) => a.d - b.d)
  return out.slice(0, max).map((x) => x.row)
}
