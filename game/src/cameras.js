// cameras.js — CCTV dinding: cone merah menyapu bolak-balik dengan periode
// tetap (pola yang bisa dipelajari pemain), bisa dimatikan 10 detik oleh EMP.
import {
  CAMERA_CONE_RANGE,
  CAMERA_CONE_FOV,
  CAMERA_CONE_RAYS,
  EMP_DISABLE_SECONDS,
  TILE,
} from './config.js';
import { lineOfSight } from './level.js';
import { raycastToSolid } from './guards.js';

export function createCameras(defs) {
  return defs.map((d) => {
    const mount = { x: d.mountTile[0] * TILE + TILE / 2, y: d.mountTile[1] * TILE + TILE / 2 };
    return {
      name: d.name,
      mountX: mount.x,
      mountY: mount.y,
      baseAngle: d.baseAngle,
      sweep: d.sweep,
      period: d.period,
      phase: d.phase,
      angle: d.baseAngle,
      offlineUntil: -1, // world.time saat kamera nyala lagi
      blink: false, // lampu merah berkedip saat merekam
    };
  });
}

export function stepCamera(camera, time) {
  camera.angle = camera.baseAngle + camera.sweep * Math.sin((2 * Math.PI * time) / camera.period + camera.phase);
  camera.blink = Math.floor(time * 2) % 2 === 0;
}

export function cameraIsOffline(camera, time) {
  return time < camera.offlineUntil;
}

export function disableCamera(camera, time) {
  camera.offlineUntil = time + EMP_DISABLE_SECONDS;
}

export function cameraSeesPlayer(camera, world) {
  if (cameraIsOffline(camera, world.time)) return false;
  const dx = world.player.x - camera.mountX;
  const dy = world.player.y - camera.mountY;
  const dist = Math.hypot(dx, dy);
  if (dist > CAMERA_CONE_RANGE || dist < 1) return false;
  const angle = Math.atan2(dy, dx);
  let diff = angle - camera.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > CAMERA_CONE_FOV / 2) return false;
  return lineOfSight(world.level, camera.mountX, camera.mountY, world.player.x, world.player.y);
}

export function cameraConePolygon(camera, level) {
  const pts = [{ x: camera.mountX, y: camera.mountY }];
  for (let i = 0; i <= CAMERA_CONE_RAYS; i++) {
    const a = camera.angle - CAMERA_CONE_FOV / 2 + (CAMERA_CONE_FOV * i) / CAMERA_CONE_RAYS;
    const end = raycastToSolid(level, camera.mountX, camera.mountY, a, CAMERA_CONE_RANGE);
    pts.push(end);
  }
  return pts;
}
