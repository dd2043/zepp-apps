import { test } from 'node:test'
import assert from 'node:assert/strict'
import { feedUrls, queryRadiusNm, bodyOf, parseIpLocation, offsetKm, trimAircraft } from '../lib/adsb.js'
import { toScreen, vectorEnd, advance, markerPoly, toDecimal, altText, CX, CY, R } from '../lib/radar.js'
import { drawRadar, statusLine } from '../lib/render.js'
import { fixture, ORIGIN } from './fixture.mjs'

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`)

test('feed URLs round the position to 2 decimals and clamp the radius', () => {
  const urls = feedUrls(46.523456, 6.632109, 400)
  assert.equal(urls[0].url, 'https://api.adsb.lol/v2/lat/46.52/lon/6.63/dist/250')
  assert.equal(urls[1].url, 'https://api.airplanes.live/v2/point/46.52/6.63/250')
  assert.equal(urls[2].url, 'https://opendata.adsb.fi/api/v2/lat/46.52/lon/6.63/dist/250')
  assert.ok(feedUrls(0, 0, 0.2)[0].url.endsWith('/dist/1'))
})

test('query radius covers the scope plus corners', () => {
  near(queryRadiusNm(30) * 1.852, 30 * 1.35 + 2, 1e-9)
})

test('bodyOf handles string and object bodies', () => {
  assert.deepEqual(bodyOf({ body: '{"ac":[]}' }), { ac: [] })
  assert.deepEqual(bodyOf({ body: { ac: [1] } }), { ac: [1] })
  assert.equal(bodyOf({ body: 'not json' }), null)
  assert.equal(bodyOf(null), null)
})

test('IP location parses GeoJS string coordinates', () => {
  assert.deepEqual(parseIpLocation({ latitude: '46.5160', longitude: '6.6328' }), { lat: 46.516, lon: 6.6328 })
  assert.equal(parseIpLocation({ latitude: 'x' }), null)
})

test('offsets: one degree north is ~111 km, east shrinks with cos(lat)', () => {
  near(offsetKm(46.5, 6.6, 47.5, 6.6).dy, 111.32, 1e-9)
  near(offsetKm(46.5, 6.6, 46.5, 7.6).dx, 111.32 * Math.cos((46.5 * Math.PI) / 180), 1e-9)
})

test('trimAircraft filters, labels and sorts', () => {
  const rows = trimAircraft(fixture, ORIGIN, 30)
  const ids = rows.map((r) => r[0])
  assert.deepEqual(ids, ['EZS15KL', 'HB-JVA', '4B1A2C', 'SWR9KX', 'BAW738'])
  assert.ok(!ids.includes('GROUND1'), 'ground traffic dropped')
  assert.ok(!ids.includes('STALE1'), 'stale position dropped')
  assert.ok(!ids.includes('FAR1'), 'out of range dropped')
  const ezy = rows[0]
  assert.equal(ezy[3], 225) // track
  assert.equal(ezy[4], 280) // gs
  assert.equal(ezy[5], 85) // 8500 ft -> 85
  const hex = rows.find((r) => r[0] === '4B1A2C')
  assert.equal(hex[3], -1, 'missing track -> -1')
  assert.equal(hex[5], -1, 'missing altitude -> -1')
  assert.equal(trimAircraft(fixture, ORIGIN, 30, 2).length, 2)
  assert.deepEqual(trimAircraft({ aircraft: [] }, ORIGIN, 30), [])
  assert.deepEqual(trimAircraft(null, ORIGIN, 30), [])
})

test('screen projection is north-up and scaled to the range', () => {
  assert.deepEqual(toScreen(0, 0, 30), { x: CX, y: CY })
  const n = toScreen(0, 30, 30)
  near(n.x, CX)
  near(n.y, CY - R)
  const e = toScreen(15, 0, 30)
  near(e.x, CX + R / 2)
})

test('speed vector points along the track and is capped', () => {
  const east = vectorEnd(100, 100, 90, 300, 30)
  assert.ok(east.x > 100 && Math.abs(east.y - 100) < 1e-9)
  const north = vectorEnd(100, 100, 0, 300, 30)
  assert.ok(north.y < 100 && Math.abs(north.x - 100) < 1e-9)
  const fast = vectorEnd(0, 0, 90, 600, 15)
  near(fast.x, R * 0.6)
  assert.equal(vectorEnd(0, 0, -1, 300, 30), null)
})

test('dead reckoning moves a 360 kt aircraft ~11.1 km per minute', () => {
  const p = advance(0, 0, 0, 360, 60)
  near(p.dy, (360 * 1.852) / 60)
  near(p.dx, 0)
  assert.deepEqual(advance(1, 2, -1, 300, 60), { dx: 1, dy: 2 })
})

test('marker tip points along the track', () => {
  const tip = markerPoly(100, 100, 90)[0]
  assert.deepEqual(tip, { x: 107, y: 100 })
})

test('GPS DMS values convert to decimal', () => {
  near(toDecimal({ direction: 'N', degrees: 46, minutes: 30, seconds: 36 }), 46.51)
  near(toDecimal({ direction: 'W', degrees: 6, minutes: 30, seconds: 0 }), -6.5)
  assert.equal(toDecimal(6.63), 6.63)
  assert.ok(Number.isNaN(toDecimal(undefined)))
})

test('altitude labels', () => {
  assert.equal(altText(350), 'FL350')
  assert.equal(altText(45), '4500ft')
  assert.equal(altText(-1), '')
})

function recorder() {
  const ops = []
  const handler = { get: (_, name) => (arg) => ops.push([name, arg]) }
  return { canvas: new Proxy({}, handler), ops }
}

test('drawRadar draws scope, markers and labels without throwing', () => {
  const { canvas, ops } = recorder()
  const st = { rangeIdx: 1, aircraft: trimAircraft(fixture, ORIGIN, 30), receivedAt: 1000, sentAt: 900, src: 'gps', err: '' }
  drawRadar(canvas, st, 5000)
  assert.equal(ops[0][0], 'clear')
  assert.equal(ops.filter((o) => o[0] === 'strokeCircle').length, 3)
  const texts = ops.filter((o) => o[0] === 'drawText').map((o) => o[1].text)
  assert.ok(texts.includes('N'))
  assert.ok(texts.includes('RADAR 30 km'))
  assert.ok(texts.includes('EZS15KL'))
  for (const [name, arg] of ops) {
    for (const [k, v] of Object.entries(arg || {})) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `${name}.${k} is ${v}`)
    }
  }
})

test('status line covers the waiting, error and live states', () => {
  assert.equal(statusLine({ aircraft: [], receivedAt: 0, sentAt: 0, pos: null }, 0), 'Locating...')
  assert.equal(statusLine({ aircraft: [], receivedAt: 0, sentAt: 1, pos: {} }, 30000), 'Waiting for phone...')
  assert.equal(statusLine({ aircraft: [], receivedAt: 0, err: 'all feeds failed' }, 0), 'No data: all feeds failed')
  assert.equal(statusLine({ aircraft: [1, 2], receivedAt: 1000, src: 'ip', err: '' }, 4000), '2 planes | IP loc | 3s ago')
})
