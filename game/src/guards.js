// guards.js — tiga guard vault house: patrol waypoint, vision cone raycast,
// state patrol → suspicious → alert (lockdown) → search. Guard tidak pernah
// insta-lose: ia harus menyentuh pemain saat lockdown untuk menangkap.
import {
  COLS,
  ROWS,
  GUARD_SPEED_PATROL,
  GUARD_SPEED_SUSPICIOUS,
  GUARD_SPEED_ALERT,
  GUARD_CONE_RANGE,
  GUARD_CONE_FOV,
  GUARD_CONE_RAYS,
  TILE,
} from './config.js';
import { lineOfSight, tileCenter } from './level.js';

export function createGuards(level, patrols) {
  return patrols.map((p, i) => {
    const first = tileCenter(p.waypoints[0][0], p.waypoints[0][1]);
    const second = tileCenter(p.waypoints[1][0], p.waypoints[1][1]);
    return {
      id: i,
      name: p.name,
      x: first.x,
      y: first.y,
      waypoints: p.waypoints.map(([c, r]) => tileCenter(c, r)),
      wpIndex: 1,
      facing: Math.atan2(second.y - first.y, second.x - first.x),
      state: 'patrol', // patrol | suspicious | alert | search | investigate
      stateTime: 0,
      lastSeen: null, // {x, y} terakhir pemain terlihat
      investigateTarget: null,
      searchTime: 0,
      mark: null, // '?' suspicious | '!' alert — digambar di atas kepala
    };
  });
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) return true;
  const step = Math.min(d, speed * dt);
  guard.x += (dx / d) * step;
  guard.y += (dy / d) * step;
  guard.facing = Math.atan2(dy, dx);
  return d - step < 4;
}

export function stepGuard(guard, dt, world) {
  guard.stateTime += dt;
  const seesPlayer = guardSeesPlayer(guard, world);
  if (seesPlayer) {
    guard.lastSeen = { x: world.player.x, y: world.player.y };
  }
  switch (guard.state) {
    case 'patrol': {
      const target = guard.waypoints[guard.wpIndex];
      if (moveToward(guard, target.x, target.y, GUARD_SPEED_PATROL, dt)) {
        guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      }
      if (world.alarm >= 50 && seesPlayer) {
        guard.state = 'suspicious';
        guard.stateTime = 0;
        guard.mark = '?';
        world.onGuardSuspicious(guard);
      }
      break;
    }
    case 'suspicious': {
      guard.mark = '?';
      if (guard.lastSeen) {
        const arrived = moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD_SPEED_SUSPICIOUS, dt);
        if (arrived || guard.stateTime > 6) {
          guard.state = 'search';
          guard.stateTime = 0;
          guard.searchTime = 0;
        }
      }
      if (world.alarm < 50 && !seesPlayer) {
        guard.state = 'patrol';
        guard.mark = null;
      }
      break;
    }
    case 'search': {
      guard.mark = '?';
      guard.searchTime += dt;
      // Sapu pandang di tempat: putar perlahan mencari jejak.
      guard.facing += dt * 1.1;
      if (guard.searchTime > 3.5 || (world.alarm < 50 && !seesPlayer)) {
        guard.state = 'patrol';
        guard.mark = null;
        guard.lastSeen = null;
      }
      break;
    }
    case 'investigate': {
      guard.mark = '?';
      if (guard.investigateTarget) {
        const arrived = moveToward(guard, guard.investigateTarget.x, guard.investigateTarget.y, GUARD_SPEED_SUSPICIOUS, dt);
        if (arrived || guard.stateTime > 5) {
          guard.state = 'search';
          guard.stateTime = 0;
          guard.searchTime = 0;
          guard.investigateTarget = null;
        }
      }
      break;
    }
    case 'alert': {
      guard.mark = '!';
      moveToward(guard, world.player.x, world.player.y, GUARD_SPEED_ALERT, dt);
      break;
    }
    default:
      break;
  }
  // Lockdown mengalahkan state lain: semua guard mengejar pemain.
  if (world.lockdown > 0 && guard.state !== 'alert') {
    guard.state = 'alert';
    guard.stateTime = 0;
    guard.mark = '!';
  }
  if (world.lockdown <= 0 && guard.state === 'alert') {
    guard.state = 'search';
    guard.stateTime = 0;
    guard.searchTime = 0;
    guard.mark = '?';
  }
}

export function guardSeesPlayer(guard, world) {
  const dx = world.player.x - guard.x;
  const dy = world.player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD_CONE_RANGE || dist < 1) return false;
  const angle = Math.atan2(dy, dx);
  let diff = angle - guard.facing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > GUARD_CONE_FOV / 2) return false;
  return lineOfSight(world.level, guard.x, guard.y, world.player.x, world.player.y);
}

// Polygon cone: raycast dari mata guard, sinar berhenti di tile solid
// sehingga cone menempel furnitur — cone yang bisa dibaca, bukan kipas buta.
export function guardConePolygon(guard, level) {
  const pts = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= GUARD_CONE_RAYS; i++) {
    const a = guard.facing - GUARD_CONE_FOV / 2 + (GUARD_CONE_FOV * i) / GUARD_CONE_RAYS;
    const end = raycastToSolid(level, guard.x, guard.y, a, GUARD_CONE_RANGE);
    pts.push(end);
  }
  return pts;
}

export function raycastToSolid(level, x, y, angle, maxDist) {
  const step = 8;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    const nx = x + dx * d;
    const ny = y + dy * d;
    const col = Math.floor(nx / TILE);
    const row = Math.floor(ny / TILE);
    // isSolidTile di-import secara lokal agar fungsi ini murni geometri:
    // cek batas manual di sini (di luar grid = dinding).
    const solid =
      col < 0 || row < 0 || col >= COLS || row >= ROWS
        ? true
        : level.solid[row * COLS + col] === 1;
    if (solid) return { x: nx, y: ny };
  }
  return { x: x + dx * maxDist, y: y + dy * maxDist };
}

export function resetGuards(guards, level, patrols) {
  const fresh = createGuards(level, patrols);
  for (let i = 0; i < guards.length; i++) {
    Object.assign(guards[i], fresh[i]);
  }
}
