// Radar screen. Callback style throughout (no async/await) because Zepp OS 3.x on the
// Cheetah Square is reported to crash on async functions.

import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, widget, event } from '@zos/ui'
import { Geolocation } from '@zos/sensor'
import { LocalStorage } from '@zos/storage'
import { setPageBrightTime } from '@zos/display'
import { SCREEN_W, SCREEN_H, RANGES_KM, DEFAULT_RANGE_INDEX, toDecimal } from '../lib/radar.js'
import { drawRadar } from '../lib/render.js'

const POLL_MS = 8000
const DRAW_MS = 2000
const POS_KEY = 'radar.pos'
const RANGE_KEY = 'radar.range'
const SAVED_FIX_MAX_AGE_MS = 6 * 3600 * 1000
const SAVE_EVERY_MS = 60000

let page = null
let canvas = null
let geo = null
let store = null
let pollTimer = null
let drawTimer = null

const st = {
  rangeIdx: DEFAULT_RANGE_INDEX,
  pos: null, // {lat, lon} sent to the phone; null -> phone uses IP location
  posSrc: 'none',
  src: '',
  aircraft: [],
  receivedAt: 0,
  sentAt: 0,
  err: '',
  savedAt: 0,
}

function redraw() {
  if (canvas) drawRadar(canvas, st, Date.now())
}

function readGps() {
  if (!geo || geo.getStatus() !== 'A') return
  const lat = toDecimal(geo.getLatitude({ format: 'DD' }))
  const lon = toDecimal(geo.getLongitude({ format: 'DD' }))
  if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) return
  st.pos = { lat, lon }
  st.posSrc = 'gps'
  const now = Date.now()
  if (store && now - st.savedAt > SAVE_EVERY_MS) {
    st.savedAt = now
    store.setItem(POS_KEY, JSON.stringify({ lat, lon, t: now }))
  }
}

function loadSavedFix() {
  try {
    const raw = store.getItem(POS_KEY)
    if (!raw) return
    const p = JSON.parse(raw)
    if (Date.now() - p.t < SAVED_FIX_MAX_AGE_MS) {
      st.pos = { lat: p.lat, lon: p.lon }
      st.posSrc = 'saved'
    }
  } catch (e) {}
  try {
    const r = parseInt(store.getItem(RANGE_KEY), 10)
    if (r >= 0 && r < RANGES_KM.length) st.rangeIdx = r
  } catch (e) {}
}

function poll() {
  readGps()
  const params = { r: RANGES_KM[st.rangeIdx] }
  if (st.pos) {
    params.lat = st.pos.lat
    params.lon = st.pos.lon
    params.src = st.posSrc
  }
  st.sentAt = Date.now()
  page.call({ method: 'scan', params })
}

function cycleRange() {
  st.rangeIdx = (st.rangeIdx + 1) % RANGES_KM.length
  if (store) store.setItem(RANGE_KEY, String(st.rangeIdx))
  redraw()
  poll()
}

Page(
  BasePage({
    build() {
      page = this
      setPageBrightTime({ brightTime: 180000 })
      store = new LocalStorage()
      loadSavedFix()

      canvas = createWidget(widget.CANVAS, { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H })
      canvas.addEventListener(event.CLICK_UP, cycleRange)

      geo = new Geolocation()
      geo.start()
      geo.onChange(readGps)

      redraw()
      poll()
      pollTimer = setInterval(poll, POLL_MS)
      drawTimer = setInterval(redraw, DRAW_MS)
    },

    onCall(req) {
      if (!canvas || !req || req.method !== 'aircraft') return
      const p = req.params || {}
      if (p.r !== RANGES_KM[st.rangeIdx]) return // answer for a range we've left
      if (p.err) {
        st.err = p.err
      } else {
        st.err = ''
        st.aircraft = p.a || []
        st.src = p.src || ''
        st.receivedAt = Date.now()
      }
      redraw()
    },

    onDestroy() {
      if (pollTimer) clearInterval(pollTimer)
      if (drawTimer) clearInterval(drawTimer)
      pollTimer = drawTimer = null
      if (geo) {
        geo.offChange(readGps)
        geo.stop()
      }
      geo = null
      canvas = null
      page = null
    },
  }),
)
