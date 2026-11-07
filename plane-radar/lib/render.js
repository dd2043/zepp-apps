// Draws the radar scope onto a Zepp OS CANVAS widget (or anything with the same methods).
// Kept free of Zepp imports so it can be rendered in Node for previews and tests.

import {
  SCREEN_W, SCREEN_H, CX, CY, R, RANGES_KM,
  toScreen, advance, vectorEnd, markerPoly, onScreen,
  altText, altColor, ringLabel, ageText, textWidth,
} from './radar.js'

const RING = 0x1e6b34
const GRID = 0x123f20
const DIM = 0x4fa063
const TEXT = 0xd8ffe0
const SUB = 0x8fbf9a
const WARN = 0xffb050

const MAX_DEAD_RECKON_S = 60

function centred(canvas, text, y, size, color) {
  canvas.drawText({ x: Math.max(0, Math.round(CX - textWidth(text, size) / 2)), y, text, text_size: size, color })
}

export function statusLine(st, nowMs) {
  if (st.err && !st.receivedAt) return 'No data: ' + st.err
  if (!st.receivedAt) {
    if (st.sentAt && nowMs - st.sentAt > 20000) return 'Waiting for phone...'
    return st.pos ? 'Loading aircraft...' : 'Locating...'
  }
  const n = st.aircraft.length
  const where = st.src === 'gps' ? 'GPS' : st.src === 'saved' ? 'last fix' : 'IP loc'
  const age = ageText((nowMs - st.receivedAt) / 1000)
  const head = st.err ? 'stale' : n + (n === 1 ? ' plane' : ' planes')
  return head + ' | ' + where + ' | ' + age
}

export function drawRadar(canvas, st, nowMs) {
  const rangeKm = RANGES_KM[st.rangeIdx]
  canvas.clear({ x: 0, y: 0, w: SCREEN_W, h: SCREEN_H })

  // Scope: crosshair, three range rings, ring distances, north marker.
  canvas.setPaint({ color: GRID, line_width: 1 })
  canvas.drawLine({ x1: CX - R, y1: CY, x2: CX + R, y2: CY, color: GRID })
  canvas.drawLine({ x1: CX, y1: CY - R, x2: CX, y2: CY + R, color: GRID })
  canvas.setPaint({ color: RING, line_width: 2 })
  for (let i = 1; i <= 3; i++) {
    canvas.strokeCircle({ center_x: CX, center_y: CY, radius: Math.round((R * i) / 3), color: RING })
  }
  for (let i = 1; i <= 3; i++) {
    const r = Math.round((R * i) / 3)
    const t = ringLabel((rangeKm * i) / 3)
    // Down-right diagonal, just inside each ring.
    canvas.drawText({ x: Math.round(CX + r * 0.707) - textWidth(t, 16) - 2, y: Math.round(CY + r * 0.707) - 20, text: t, text_size: 16, color: DIM })
  }
  canvas.drawText({ x: CX - 6, y: CY - R - 24, text: 'N', text_size: 20, color: TEXT })

  // You, at the centre.
  canvas.setPaint({ color: TEXT, line_width: 2 })
  canvas.drawLine({ x1: CX - 6, y1: CY, x2: CX + 6, y2: CY, color: TEXT })
  canvas.drawLine({ x1: CX, y1: CY - 6, x2: CX, y2: CY + 6, color: TEXT })

  // Aircraft, moved forward along their track since the data arrived.
  const age = st.receivedAt ? Math.min((nowMs - st.receivedAt) / 1000, MAX_DEAD_RECKON_S) : 0
  for (let i = st.aircraft.length - 1; i >= 0; i--) {
    const a = st.aircraft[i]
    const id = a[0], trk = a[3], gs = a[4], alt = a[5]
    const p = advance(a[1] / 10, a[2] / 10, trk, gs, age)
    const s = toScreen(p.dx, p.dy, rangeKm)
    if (!onScreen(s.x, s.y)) continue
    const x = Math.round(s.x)
    const y = Math.round(s.y)
    const col = altColor(alt)

    const v = vectorEnd(x, y, trk, gs, rangeKm)
    canvas.setPaint({ color: col, line_width: 2 })
    if (v) canvas.drawLine({ x1: x, y1: y, x2: Math.round(v.x), y2: Math.round(v.y), color: col })
    if (trk >= 0) canvas.drawPoly({ data_array: markerPoly(x, y, trk), color: col })
    else canvas.drawCircle({ center_x: x, center_y: y, radius: 4, color: col })

    // Label on the side away from the speed vector.
    const line2 = altText(alt) + (gs ? ' ' + gs + 'kt' : '')
    const w = Math.max(textWidth(id, 18), textWidth(line2, 15))
    const goLeft = trk >= 0 && trk < 180
    let lx = goLeft ? x - 9 - w : x + 9
    lx = Math.max(2, Math.min(SCREEN_W - w - 2, lx))
    const ly = Math.max(44, Math.min(SCREEN_H - 82, y - 18))
    canvas.drawText({ x: lx, y: ly, text: id, text_size: 18, color: TEXT })
    if (line2.trim()) canvas.drawText({ x: lx, y: ly + 19, text: line2, text_size: 15, color: SUB })
  }

  // Header and status.
  centred(canvas, 'RADAR ' + rangeKm + ' km', 10, 22, TEXT)
  const status = statusLine(st, nowMs)
  centred(canvas, status, SCREEN_H - 34, 18, st.err ? WARN : SUB)
}
