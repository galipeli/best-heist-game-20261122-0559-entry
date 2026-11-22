// level.js — peta vault house Aldous Vane: satu ruangan 32x18 yang memuat
// tiga rute (lorong atas, lorong tengah, jalur rug bayangan), dua kamera CCTV,
// tiga guard, dan semua loot. Legenda: # dinding, . lantai, r rug bayangan,
// C cover (display case / statue / safe: blokir gerak + pandangan), P start,
// L Sunstar Diamond, g gold bars, e emerald, X pintu vault (exit).
import { COLS, ROWS, TILE } from './config.js';

export const MAP = [
  '################################',
  '#......r.......L......r.....X..#',
  '#..CC......CC......CC.....CC...#',
  '#......r.......r.......r.......#',
  '#..CC......CC......CC.....CC...#',
  '#......r.......r.......r.......#',
  '#..CC......CC......CC.....CC...#',
  '#..g...r.......r.......r...e...#',
  '#......r.......r.......r.......#',
  '#..CC......CC......CC.....CC...#',
  '#......r.......r.......r.......#',
  '#..CC......CC......CC.....CC...#',
  '#......r.......r.......r.......#',
  '#..CC......CC......CC.....CC...#',
  '#......r.......r.......r.......#',
  '#..CC......CC......CC.....CC...#',
  '#..P...r.......r.......r.......#',
  '################################',
];

// Waypoint patrol guard (tile). G1 menyapu lorong atas di bawah pedestal,
// G2 lorong tengah, G3 jalur rug vertikal kanan.
export const GUARD_PATROLS = [
  { name: 'Dara', waypoints: [[4, 3], [24, 3]] },
  { name: 'Kess', waypoints: [[4, 8], [27, 8]] },
  { name: 'Tomas', waypoints: [[23, 3], [23, 15]] },
];

// Kamera CCTV: mount di dinding, sudut dasar + ayunan (radian).
export const CAMERA_DEFS = [
  { name: 'CAM-A', mountTile: [16, 0], baseAngle: Math.PI / 2, sweep: 0.95, period: 5.2, phase: 0 },
  { name: 'CAM-B', mountTile: [31, 8], baseAngle: Math.PI, sweep: 0.8, period: 6.4, phase: 1.7 },
];

// Sconce dinding: titik cahaya untuk lapisan kegelapan.
export const SCONCES = [[7, 1], [23, 1], [7, 16], [23, 16], [16, 9]];

export function parseLevel() {
  if (MAP.length !== ROWS) throw new Error('MAP harus 18 baris');
  const solid = new Uint8Array(COLS * ROWS);
  const shadow = new Uint8Array(COLS * ROWS);
  const loot = {};
  let start = null;
  let exit = null;
  for (let r = 0; r < ROWS; r++) {
    if (MAP[r].length !== COLS) throw new Error(`baris ${r} harus 32 karakter, dapat ${MAP[r].length}`);
    for (let c = 0; c < COLS; c++) {
      const ch = MAP[r][c];
      const i = r * COLS + c;
      if (ch === '#' || ch === 'C') solid[i] = 1;
      if (ch === 'r') shadow[i] = 1;
      if (ch === 'P') start = { col: c, row: r };
      if (ch === 'L') loot.sunstar = { col: c, row: r, value: 50000, name: 'Sunstar Diamond', taken: false };
      if (ch === 'g') loot.gold = { col: c, row: r, value: 8000, name: 'Gold bars', taken: false };
      if (ch === 'e') loot.emerald = { col: c, row: r, value: 12000, name: 'Emerald', taken: false };
      if (ch === 'X') exit = { col: c, row: r };
    }
  }
  if (!start || !exit || !loot.sunstar) throw new Error('level kehilangan start/exit/Sunstar');
  return { solid, shadow, start, exit, loot };
}

export function tileIndex(col, row) {
  return row * COLS + col;
}

export function isSolidTile(level, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
  return level.solid[tileIndex(col, row)] === 1;
}

export function isShadowTile(level, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
  return level.shadow[tileIndex(col, row)] === 1;
}

export function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

export function coverKind(col, row) {
  // Jenis cover deterministik dari posisi: 0 display case, 1 statue, 2 safe.
  const h = (col * 7 + row * 13) % 3;
  return h;
}

// Garis pandang: sampel tiap 6px; padat bila ada tile solid di antaranya.
export function lineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.floor((x0 + dx * t) / TILE);
    const cy = Math.floor((y0 + dy * t) / TILE);
    if (isSolidTile(level, cx, cy)) return false;
  }
  return true;
}

// BFS 4 arah di tile walkable; mengembalikan daftar tile dari start ke goal.
export function findPath(level, fromCol, fromRow, toCol, toRow) {
  const key = (c, r) => r * COLS + c;
  const prev = new Map();
  const queue = [[fromCol, fromRow]];
  prev.set(key(fromCol, fromRow), null);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const [c, r] = queue.shift();
    if (c === toCol && r === toRow) {
      const path = [];
      let cur = [c, r];
      while (cur) {
        path.unshift(cur);
        cur = prev.get(key(cur[0], cur[1]));
      }
      return path;
    }
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      if (isSolidTile(level, nc, nr)) continue;
      const k = key(nc, nr);
      if (prev.has(k)) continue;
      prev.set(k, [c, r]);
      queue.push([nc, nr]);
    }
  }
  return null;
}

// Validasi Node: dipakai world/pilot — start bisa mencapai loot + exit,
// semua waypoint patrol walkable, kamera menempel di dinding.
export function validateLevel(level) {
  const problems = [];
  const s = level.start;
  const l = level.loot.sunstar;
  const e = level.exit;
  if (!findPath(level, s.col, s.row, l.col, l.row)) problems.push('Sunstar tidak reachable dari start');
  if (!findPath(level, s.col, s.row, e.col, e.row)) problems.push('exit tidak reachable dari start');
  if (!findPath(level, l.col, l.row, e.col, e.row)) problems.push('exit tidak reachable dari Sunstar');
  for (const patrol of GUARD_PATROLS) {
    for (const [c, r] of patrol.waypoints) {
      if (isSolidTile(level, c, r)) problems.push(`waypoint ${patrol.name} (${c},${r}) di tile solid`);
    }
    const [a, b] = patrol.waypoints;
    if (!findPath(level, a[0], a[1], b[0], b[1])) problems.push(`patrol ${patrol.name} terputus`);
  }
  for (const cam of CAMERA_DEFS) {
    const [c, r] = cam.mountTile;
    if (!isSolidTile(level, c, r)) problems.push(`kamera ${cam.name} tidak menempel di dinding`);
  }
  return problems;
}
