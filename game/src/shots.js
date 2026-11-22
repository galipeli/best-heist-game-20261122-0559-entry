// shots.js — dua alat deterministik untuk verifikasi:
// 1. applyShotState: panggung keadaan game untuk screenshot (?shot=cover
//    dsb.) — dunia dibekukan agar frame stabil saat CDP memotret.
// 2. runPilot: pilot in-sim — gerakkan pemain sepanjang rute BFS (dua rute
//    berbeda) sampai menang; bukti level bisa diselesaikan.
import { GRAB_RANGE } from './config.js';
import { tileCenter, findPath } from './level.js';
import { createWorld, updateWorld } from './world.js';

function placeGuard(world, index, col, row, facingAngle, state, mark) {
  const g = world.guards[index];
  const c = tileCenter(col, row);
  g.x = c.x;
  g.y = c.y;
  g.facing = facingAngle;
  g.state = state;
  g.stateTime = 0;
  g.mark = mark;
  if (state === 'suspicious' || state === 'alert') {
    g.lastSeen = { x: world.player.x, y: world.player.y };
  }
}

function placePlayer(world, col, row, facingAngle) {
  const c = tileCenter(col, row);
  world.player.x = c.x;
  world.player.y = c.y;
  world.player.facing = facingAngle;
  world.player.clickTarget = null;
}

export function applyShotState(world, name) {
  world.startGame();
  world.frozen = true;
  if (name === 'cover') {
    // Semua elemen kriteria 1 dalam satu frame: thief di lorong tengah,
    // cone guard menyapu di atasnya, CCTV menyapu, Sunstar berkilau,
    // pintu EXIT, alarm 55 SUSPICIOUS, loot $8.000 sudah di tangan.
    world.time = 47;
    world.alarm = 55;
    world.alarmPeak = 55;
    world.lootValue = 8000;
    world.level.loot.gold.taken = true;
    placePlayer(world, 13, 5, Math.PI / 2);
    placeGuard(world, 0, 17, 3, Math.PI * 0.85, 'suspicious', '?');
    placeGuard(world, 1, 10, 8, 0, 'patrol', null);
    placeGuard(world, 2, 23, 10, -Math.PI / 2, 'patrol', null);
    world.cameras[0].angle = 1.9;
    world.cameras[1].angle = Math.PI;
  } else if (name === 'nearmiss') {
    // Nyaris tertangkap: alarm 78, guard Dara menatap pemain, tanda "!".
    world.time = 72;
    world.alarm = 78;
    world.alarmPeak = 78;
    placePlayer(world, 21, 3, Math.PI);
    placeGuard(world, 0, 17, 3, 0, 'alert', '!');
    placeGuard(world, 1, 12, 8, -Math.PI / 2, 'suspicious', '?');
    placeGuard(world, 2, 23, 12, Math.PI / 2, 'patrol', null);
    world.cameras[0].angle = Math.PI / 2;
    world.cameras[1].angle = Math.PI * 0.94;
  } else if (name === 'win') {
    // Layar menang: semua loot, CLEAN GETAWAY, 1:34, di pintu vault.
    world.phase = 'win';
    world.time = 94;
    world.winTime = 94;
    world.winRating = 'CLEAN GETAWAY';
    world.lootValue = 70000;
    world.sunstarTaken = true;
    world.alarmPeak = 62;
    world.alarm = 12;
    for (const item of Object.values(world.level.loot)) item.taken = true;
    placePlayer(world, 28, 1, -Math.PI / 2);
    placeGuard(world, 0, 16, 3, Math.PI, 'patrol', null);
    placeGuard(world, 1, 10, 8, 0, 'patrol', null);
    placeGuard(world, 2, 23, 10, -Math.PI / 2, 'patrol', null);
  } else {
    // 'start' (default): panel judul di atas ruangan yang hidup.
    world.phase = 'title';
    world.time = 0;
    placePlayer(world, 3, 16, -Math.PI / 2);
    placeGuard(world, 0, 12, 3, 0, 'patrol', null);
    placeGuard(world, 1, 14, 8, Math.PI, 'patrol', null);
    placeGuard(world, 2, 23, 9, Math.PI / 2, 'patrol', null);
  }
  return name;
}

// Pilot: ikuti rute BFS tile demi tile; E otomatis saat dekat loot.
// route 'main' = jalur terpendek lewat tengah (jalan biasa),
// route 'shadow' = lewat jalur rug (sneak penuh, deteksi melambat).
export function runPilot(route) {
  const world = createWorld();
  world.startGame();
  const level = world.level;
  const start = [level.start.col, level.start.row];
  const lootAt = [level.loot.sunstar.col, level.loot.sunstar.row];
  const exitAt = [level.exit.col, level.exit.row];
  let legs;
  if (route === 'shadow') {
    legs = [
      [start, [23, 16]],
      [[23, 16], [23, 3]],
      [[23, 3], lootAt],
      [lootAt, exitAt],
    ];
  } else {
    legs = [
      [start, [16, 9]],
      [[16, 9], lootAt],
      [lootAt, exitAt],
    ];
  }
  const waypoints = [];
  for (const [a, b] of legs) {
    const leg = findPath(level, a[0], a[1], b[0], b[1]);
    if (!leg) return { route, won: false, reason: `tidak ada path ${a} -> ${b}` };
    waypoints.push(...leg.slice(waypoints.length ? 1 : 0));
  }
  const sneak = route === 'shadow';
  let wp = 0;
  const dt = 1 / 60;
  let steps = 0;
  const maxSteps = 60 * 300;
  const trail = [];
  while (world.phase !== 'win' && steps < maxSteps) {
    steps += 1;
    if (steps % 600 === 0) {
      trail.push({ t: Math.round(world.time), x: Math.round(world.player.x), y: Math.round(world.player.y), wp, phase: world.phase });
    }
    if (world.phase === 'gameover') {
      return { route, won: false, reason: 'game over (nerves habis)', timeSec: world.time, caught: world.caughtCount };
    }
    // Auto-grab saat dalam jangkauan loot.
    const near = Object.values(level.loot).some((item) => {
      if (item.taken) return false;
      const c = tileCenter(item.col, item.row);
      return Math.hypot(c.x - world.player.x, c.y - world.player.y) < GRAB_RANGE;
    });
    const target = waypoints[Math.min(wp, waypoints.length - 1)];
    const tc = tileCenter(target[0], target[1]);
    const dx = tc.x - world.player.x;
    const dy = tc.y - world.player.y;
    if (Math.hypot(dx, dy) < 12 && wp < waypoints.length - 1) wp += 1;
    const fakeInput = {
      wasPressed: (code) => code === 'KeyE' && near,
      takeClick: () => null,
      moveVector: () => ({
        left: dx < -2,
        right: dx > 2,
        up: dy < -2,
        down: dy > 2,
        sneak,
      }),
    };
    updateWorld(world, fakeInput, dt);
    if (world.phase === 'caught') {
      // Tunggu respawn selesai di dalam loop (updateWorld menanganinya).
      continue;
    }
  }
  return {
    route,
    won: world.phase === 'win',
    timeSec: Math.round(world.time * 10) / 10,
    caught: world.caughtCount,
    alarmPeak: Math.round(world.alarmPeak),
    nervesLeft: world.nerves,
    lootValue: world.lootValue,
    steps,
    trail,
  };
}
