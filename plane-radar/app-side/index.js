// Side service: runs inside the Zepp app on the phone, which has the internet connection.
// The watch sends {method:'scan', params:{lat, lon, src, r}}; we fetch nearby aircraft
// from a free ADS-B feed and push back a compact list with {method:'aircraft'}.

import { BaseSideService } from '@zeppos/zml/base-side'
import { feedUrls, queryRadiusNm, bodyOf, trimAircraft, parseIpLocation, IP_LOCATION_URL } from '../lib/adsb.js'

const HEADERS = { Accept: 'application/json', 'User-Agent': 'PlaneRadar-ZeppOS/1.0' }
const IP_CACHE_MS = 30 * 60 * 1000
const BUSY_TIMEOUT_MS = 20000

let busySince = 0
let preferredFeed = 0
let ipCache = null

function get(url) {
  return fetch({ url, method: 'GET', headers: HEADERS }).then((res) => {
    if (res && res.status && res.status !== 200) throw new Error('HTTP ' + res.status)
    const body = bodyOf(res)
    if (!body) throw new Error('empty response')
    return body
  })
}

function locate(params) {
  if (typeof params.lat === 'number' && typeof params.lon === 'number') {
    return Promise.resolve({ lat: params.lat, lon: params.lon, src: params.src || 'gps' })
  }
  if (ipCache && Date.now() - ipCache.t < IP_CACHE_MS) {
    return Promise.resolve({ lat: ipCache.lat, lon: ipCache.lon, src: 'ip' })
  }
  return get(IP_LOCATION_URL).then((body) => {
    const loc = parseIpLocation(body)
    if (!loc) throw new Error('no location')
    ipCache = { lat: loc.lat, lon: loc.lon, t: Date.now() }
    return { lat: loc.lat, lon: loc.lon, src: 'ip' }
  })
}

// Try feeds starting with the last one that worked, falling through on any failure.
function fetchAircraft(feeds, tried) {
  if (tried >= feeds.length) return Promise.reject(new Error('all feeds failed'))
  const i = (preferredFeed + tried) % feeds.length
  return get(feeds[i].url).then(
    (body) => {
      if (!Array.isArray(body.ac) && !Array.isArray(body.aircraft)) throw new Error('bad format')
      preferredFeed = i
      return { body, feed: feeds[i].name }
    },
    () => fetchAircraft(feeds, tried + 1),
  )
}

AppSideService(
  BaseSideService({
    onInit() {},
    onRun() {},
    onDestroy() {},

    onCall(req) {
      if (!req || req.method !== 'scan') return
      const now = Date.now()
      if (busySince && now - busySince < BUSY_TIMEOUT_MS) return
      busySince = now
      const params = req.params || {}
      const rangeKm = typeof params.r === 'number' ? params.r : 30

      locate(params)
        .then((origin) =>
          fetchAircraft(feedUrls(origin.lat, origin.lon, queryRadiusNm(rangeKm)), 0).then((res) => {
            this.call({
              method: 'aircraft',
              params: { a: trimAircraft(res.body, origin, rangeKm), src: origin.src, feed: res.feed, r: rangeKm },
            })
          }),
        )
        .catch((err) => {
          this.call({ method: 'aircraft', params: { err: String((err && err.message) || err), r: rangeKm } })
        })
        .then(() => {
          busySince = 0
        })
    },
  }),
)
