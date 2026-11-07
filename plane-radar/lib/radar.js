// Watch-side geometry and formatting. Pure functions, no Zepp APIs.

export const SCREEN_W = 390
export const SCREEN_H = 450
export const CX = 195
export const CY = 236
export const R = 168 // radar radius in px

export const RANGES_KM = [15, 30, 60, 120]
export const DEFAULT_RANGE_INDEX = 1
export const VECTOR_MIN = 1 // speed vector = distance flown in this many minutes

// km offset (east, north) -> screen px, north up.
export function toScreen(dxKm, dyKm, rangeKm) {
  const s = R / rangeKm
  return { x: CX + dxKm * s, y: CY - dyKm * s }
}

// Dead-reckon an aircraft forward by `seconds` along its track.
export function advance(dxKm, dyKm, trackDeg, gsKt, seconds) {
  if (trackDeg < 0 || !gsKt || seconds <= 0) return { dx: dxKm, dy: dyKm }
  const km = (gsKt * 1.852 * seconds) / 3600
  const t = (trackDeg * Math.PI) / 180
  return { dx: dxKm + km * Math.sin(t), dy: dyKm + km * Math.cos(t) }
}

// End point of the speed vector, capped so slow ranges don't draw across the screen.
export function vectorEnd(x, y, trackDeg, gsKt, rangeKm) {
  if (trackDeg < 0 || !gsKt) return null
  const km = (gsKt * 1.852 * VECTOR_MIN) / 60
  const px = Math.min((km * R) / rangeKm, R * 0.6)
  const t = (trackDeg * Math.PI) / 180
  return { x: x + px * Math.sin(t), y: y - px * Math.cos(t) }
}

// Small arrowhead-shaped marker pointing along the track.
export function markerPoly(x, y, trackDeg) {
  const t = ((trackDeg < 0 ? 0 : trackDeg) * Math.PI) / 180
  const pt = (fwd, side) => ({
    x: Math.round(x + fwd * Math.sin(t) + side * Math.cos(t)),
    y: Math.round(y - fwd * Math.cos(t) + side * Math.sin(t)),
  })
  return [pt(7, 0), pt(-5, 5), pt(-2, 0), pt(-5, -5), pt(7, 0)]
}

export function onScreen(x, y, margin = 4) {
  return x >= margin && x <= SCREEN_W - margin && y >= 44 && y <= SCREEN_H - 44
}

export function altText(altH) {
  if (altH < 0) return ''
  return altH >= 100 ? 'FL' + altH : altH * 100 + 'ft'
}

export function altColor(altH) {
  if (altH >= 0 && altH < 50) return 0xffa040 // below 5000 ft: orange
  if (altH >= 250) return 0x6fd8ff // FL250 and up: cyan
  return 0x39ff6a // in between: radar green
}

export function ringLabel(km) {
  return (km % 1 === 0 ? String(km) : km.toFixed(1)) + ''
}

export function ageText(seconds) {
  if (seconds < 1) return 'now'
  if (seconds < 60) return Math.round(seconds) + 's ago'
  return Math.round(seconds / 60) + 'min ago'
}

// Decimal degrees from either a number or a {direction, degrees, minutes, seconds} object.
export function toDecimal(v) {
  if (typeof v === 'number') return v
  if (v && typeof v.degrees === 'number') {
    const d = v.degrees + (v.minutes || 0) / 60 + (v.seconds || 0) / 3600
    return v.direction === 'S' || v.direction === 'W' ? -d : d
  }
  return NaN
}

export function textWidth(text, size) {
  return Math.round(String(text).length * size * 0.56)
}
