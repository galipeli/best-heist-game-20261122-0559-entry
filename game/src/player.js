// player.js — Marlow Quinn: gerak keyboard + click-to-move, sneak, ambil loot,
// pakai tools (EMP / noisemaker). Tidak tahu apa-apa soal guard atau kamera;
// world yang memutuskan apakah ia terlihat.
import {
  PLAYER_RADIUS,
  PLAYER_COLLISION_RADIUS,
  WALK_SPEED,
  SNEAK_SPEED,
  GRAB_RANGE,
  TOOL_EMP_CHARGES,
  TOOL_NOISE_CHARGES,
  TOOL_EMP_ALARM_COST,
  TOOL_NOISE_ALARM_COST,
  NOISE_THROW_RANGE,
  TILE,
} from './config.js';
import { isSolidTile, tileCenter } from './level.js';

export function createPlayer(level) {
  const start = tileCenter(level.start.col, level.start.row);
  return {
    x: start.x,
    y: start.y,
    radius: PLAYER_RADIUS,
    facing: -Math.PI / 2, // menghadap ke atas ruangan
    sneaking: false,
    moving: false,
    clickTarget: null, // {x, y} dari klik mouse; null bila tidak ada
    empCharges: TOOL_EMP_CHARGES,
    noiseCharges: TOOL_NOISE_CHARGES,
    pendingNoise: false, // tombol 2 ditekan: klik berikut melempar noisemaker
    stepPhase: 0, // untuk animasi langkah + suara
  };
}

export function resetPlayerToStart(player, level) {
  const start = tileCenter(level.start.col, level.start.row);
  player.x = start.x;
  player.y = start.y;
  player.facing = -Math.PI / 2;
  player.clickTarget = null;
  player.pendingNoise = false;
  player.sneaking = false;
  player.moving = false;
}

// Gerak dengan resolusi penetrasi: terapkan perpindahan penuh, lalu dorong
// lingkaran keluar dari tile solid yang tumpang tindih (sepanjang vektor
// dari titik terdekat tile ke pusat pemain). Ini yang membuat pemain
// meluncur melewati sudut cover, bukan terjepit di sela seperti pada
// penolakan sumbu-demi-sumbu.
function tryMove(player, level, dx, dy) {
  const r = PLAYER_COLLISION_RADIUS;
  player.x += dx;
  player.y += dy;
  for (let iter = 0; iter < 3; iter++) {
    let pushed = false;
    const c0 = Math.floor((player.x - r) / TILE);
    const c1 = Math.floor((player.x + r) / TILE);
    const r0 = Math.floor((player.y - r) / TILE);
    const r1 = Math.floor((player.y + r) / TILE);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (!isSolidTile(level, col, row)) continue;
        const cx = Math.max(col * TILE, Math.min(player.x, col * TILE + TILE));
        const cy = Math.max(row * TILE, Math.min(player.y, row * TILE + TILE));
        let ddx = player.x - cx;
        let ddy = player.y - cy;
        let d = Math.hypot(ddx, ddy);
        if (d >= r) continue;
        if (d < 0.001) {
          ddx = 0;
          ddy = -1;
          d = 1;
        }
        const push = r - d;
        player.x += (ddx / d) * push;
        player.y += (ddy / d) * push;
        pushed = true;
      }
    }
    if (!pushed) break;
  }
}

// Satu langkah simulasi. input: {up,down,left,right,sneak} + click target.
// Mengembalikan event langkah kaki (untuk audio) bila pemain bergerak.
export function stepPlayer(player, level, input, dt) {
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (dx === 0 && dy === 0 && player.clickTarget) {
    const tx = player.clickTarget.x - player.x;
    const ty = player.clickTarget.y - player.y;
    const d = Math.hypot(tx, ty);
    if (d < 6) {
      player.clickTarget = null;
    } else {
      dx = tx / d;
      dy = ty / d;
    }
  }
  const len = Math.hypot(dx, dy);
  player.sneaking = !!input.sneak;
  player.moving = len > 0;
  if (len > 0) {
    const speed = player.sneaking ? SNEAK_SPEED : WALK_SPEED;
    const vx = (dx / len) * speed * dt;
    const vy = (dy / len) * speed * dt;
    tryMove(player, level, vx, vy);
    player.facing = Math.atan2(dy, dx);
    const prevPhase = player.stepPhase;
    player.stepPhase += (speed * dt) / 26;
    return Math.floor(player.stepPhase) !== Math.floor(prevPhase);
  }
  return false;
}

export function nearestLootInRange(player, loot) {
  let best = null;
  let bestD = Infinity;
  for (const item of Object.values(loot)) {
    if (item.taken) continue;
    const c = tileCenter(item.col, item.row);
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < GRAB_RANGE && d < bestD) {
      best = item;
      bestD = d;
    }
  }
  return best;
}

export function grabLoot(player, loot) {
  const item = nearestLootInRange(player, loot);
  if (!item) return null;
  item.taken = true;
  return item;
}

// EMP: matikan semua kamera; biayanya alarm naik (sensor ikut tersengat).
export function useEmp(player, world) {
  if (player.empCharges <= 0) return false;
  player.empCharges -= 1;
  world.disableAllCameras();
  world.raiseAlarm(TOOL_EMP_ALARM_COST);
  return true;
}

// Noisemaker: lempar ke titik klik; guard di sekitar menyelidiki titik itu.
export function throwNoisemaker(player, world, tx, ty) {
  if (player.noiseCharges <= 0) return false;
  const d = Math.hypot(tx - player.x, ty - player.y);
  if (d > NOISE_THROW_RANGE) return false;
  player.noiseCharges -= 1;
  world.lureGuardsTo(tx, ty);
  world.raiseAlarm(TOOL_NOISE_ALARM_COST);
  return true;
}
