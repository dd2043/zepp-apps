// A made-up ADSBexchange-v2 style response around central Lausanne, used by the tests
// and the preview render. Not real traffic.
export const ORIGIN = { lat: 46.52, lon: 6.63 }

const at = (dxKm, dyKm) => ({
  lat: ORIGIN.lat + dyKm / 111.32,
  lon: ORIGIN.lon + dxKm / (111.32 * Math.cos((ORIGIN.lat * Math.PI) / 180)),
})

export const fixture = {
  ac: [
    { hex: '4b1805', flight: 'SWR9KX  ', ...at(-14, 9), track: 62, gs: 412, alt_baro: 24000, seen_pos: 1.2 },
    { hex: '4ca7e1', flight: 'EZS15KL ', ...at(3, -2.5), track: 225, gs: 280, alt_baro: 8500, seen_pos: 0.4 },
    { hex: '406b2a', flight: 'BAW738  ', ...at(21, 12), track: 268, gs: 455, alt_baro: 37000, seen_pos: 2.1 },
    { hex: '4b0f3e', r: 'HB-JVA', ...at(-6, -7), track: 140, gs: 120, alt_baro: 3500, seen_pos: 0.8 },
    { hex: '4b1a2c', ...at(8, 6) },
    { hex: '4b0001', flight: 'GROUND1', ...at(1, 1), alt_baro: 'ground', gs: 12, track: 10 },
    { hex: '4b0002', flight: 'STALE1', ...at(2, 2), alt_baro: 9000, gs: 200, track: 90, seen_pos: 120 },
    { hex: '4b0003', flight: 'FAR1', ...at(60, 0), alt_baro: 35000, gs: 450, track: 90 },
    { hex: '4b0004', flight: 'NOPOS' },
  ],
}
